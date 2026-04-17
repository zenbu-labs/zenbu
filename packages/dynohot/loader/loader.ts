import type { ModuleOrigin } from "./specifier.js";
import type { ImportAttributes, InitializeHook, LoadHook, ModuleFormat, ResolveHook } from "node:module";
import type { MessagePort } from "node:worker_threads";
import * as assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import * as fs from "node:fs/promises";
import { Fn } from "@braidai/lang/functional";
import convertSourceMap from "convert-source-map";
import { LoaderHot } from "./loader-hot.js";
import { extractModuleOrigin, makeModuleOrigin } from "./specifier.js";
import { transformModuleSource } from "./transform.js";

/**
 * This is the value of the `hot` attribute attached to `import` requests. Note that this payload
 * only makes it through to the resolver, where it is processed and discarded. The `hot` attribute
 * received in the loader is something different.
 *
 * This type is declared and exported since the controller runtime needs to make payloads of this
 * format.
 * @internal
 */
export type HotResolverPayload =
	HotResolveExpressionDirective |
	HotResolveReloadDirective;

interface HotResolveExpressionDirective {
	hot: "expression";
	parentURL: string;
}

interface HotResolveReloadDirective {
	hot: "reload";
	format: ModuleFormat;
	version: number;
}

/** @internal */
export interface LoaderParameters {
	ignore?: RegExp;
	port: MessagePort;
	silent?: boolean;
}

let ignorePattern: RegExp;
let port: MessagePort;
let runtimeURL: string;

/** @internal */
export const initialize: InitializeHook<LoaderParameters> = options => {
	port = options.port;
	ignorePattern = options.ignore ?? /[/\\]node_modules[/\\]/;
	const root = String(new URL("..", new URL(import.meta.url)));
	runtimeURL = `${root}runtime/runtime.js?${String(new URLSearchParams({
		...options.silent ? { silent: "" } : {},
	}))}`;
};

const makeAdapterModule = (origin: ModuleOrigin, importAttributes: ImportAttributes) => {
	const encodedURL = JSON.stringify(origin.moduleURL);
	return (
	// eslint-disable-next-line @stylistic/indent
`import * as namespace from ${encodedURL} with ${JSON.stringify(importAttributes)};
import { adapter } from "hot:runtime";
const module = adapter(${encodedURL}, namespace);
export default function() { return module; };\n`
	);
};

const makeJsonModule = (origin: ModuleOrigin, json: string, importAttributes: ImportAttributes) =>
// eslint-disable-next-line @stylistic/indent
`import { acquire } from "hot:runtime";
function* execute() {
	yield [ () => {}, { default: () => json } ];
	yield;
	const json = JSON.parse(${JSON.stringify(json)});
}
export default function module() {
	return acquire(${JSON.stringify(origin.moduleURL)});
}
module().load(${JSON.stringify(origin.backingModuleURL)}, { async: false, execute }, null, false, "json", ${JSON.stringify(importAttributes)}, []);\n`;

const makeReloadableModule = async (origin: ModuleOrigin, watch: readonly string[], source: string, importAttributes: ImportAttributes) => {
	const sourceMap = await async function(): Promise<unknown> {
		try {
			const map = convertSourceMap.fromComment(source);
			return map.toObject();
		} catch {}
		try {
			const map = await convertSourceMap.fromMapFileSource(
				source,
				(fileName: string) => fs.readFile(new URL(fileName, origin.moduleURL), "utf8"));
			return map?.toObject();
		} catch {}
	}();
	// Loaders earlier in the chain are allowed to overwrite `responseURL`, which is fine, but we
	// need to notate this in the runtime. `responseURL` can be anything, doesn't have to be unique,
	// and is observable via `import.meta.url` and stack traces [unless there is a source map]. On
	// the other hand, `moduleURL` uniquely identifies an instance of a module, and is used as the
	// `parentURL` in the resolve callback. We will "burn in" `moduleURL` into the transformed
	// source as a post-transformation process.
	return (
	// eslint-disable-next-line @stylistic/indent
`${transformModuleSource(origin.moduleURL, origin.backingModuleURL, importAttributes, source, sourceMap)}
import { acquire } from "hot:runtime";
export default function module() { return acquire(${JSON.stringify(origin.moduleURL)}, ${JSON.stringify(watch)}); }\n`
	);
};

function asString(sourceText: any) {
	if (sourceText instanceof Buffer) {
		return sourceText.toString("utf8");
	} else if (typeof sourceText === "string") {
		return sourceText;
	} else if (sourceText === undefined) {
		return "";
	} else {
		return Buffer.from(sourceText).toString("utf8");
	}
}

function extractResolverImportAttributes(importAttributes: ImportAttributes): ImportAttributes {
	return Fn.pipe(
		Object.entries(importAttributes),
		$$ => Fn.reject($$, ([ key ]) => key === "hot"),
		$$ => Object.fromEntries($$));
}

function supportsHotBackingURL(url: string) {
	return (
		url.startsWith("file:") ||
		url.startsWith("node:") ||
		url.startsWith("zenbu:"));
}

/** @internal */
export const resolve: ResolveHook = (specifier, context, nextResolve) => {
	// Forward root module to "hot:main"
	if (context.parentURL === undefined) {
		return {
			url: "hot:main",
			format: "module",
			importAttributes: {
				hot: specifier,
			},
			shortCircuit: true,
		};
	}

	// Pass through requests for the runtime
	if (specifier === "hot:runtime") {
		return {
			format: "module",
			shortCircuit: true,
			url: runtimeURL,
		};
	}

	// Bail on non-hot module resolution
	const parentModuleOrigin = extractModuleOrigin(context.parentURL);
	const hotParam = context.importAttributes.hot;
	if (hotParam === undefined) {
		return nextResolve(specifier, {
			...context,
			parentURL: parentModuleOrigin?.moduleURL ?? context.parentURL,
		});
	}

	// Resolve hot module controller
	return async function() {
		const importAttributes = extractResolverImportAttributes(context.importAttributes);

		// `import {} from "./specifier"`;
		if (hotParam === "import") {
			const next = await nextResolve(specifier, {
				...context,
				importAttributes,
				parentURL: parentModuleOrigin?.moduleURL,
			});
			if (!supportsHotBackingURL(next.url)) {
				return {
					...next,
					importAttributes,
				};
			}
			return {
				...next,
				url: makeModuleOrigin(next.url, next.importAttributes),
				importAttributes: {
					...importAttributes,
					...next.importAttributes,
					hot: next.format ?? "hot",
				},
			};
		}

		const hot = JSON.parse(hotParam) as HotResolverPayload;
		switch (hot.hot) {
			// `await import(url)`
			case "expression": {
				const parentModuleURL = hot.parentURL;
				const next = await nextResolve(specifier, {
					...context,
					importAttributes,
					parentURL: parentModuleURL,
				});
				if (!supportsHotBackingURL(next.url)) {
					return {
						...next,
						importAttributes,
					};
				}
				return {
					...next,
					url: makeModuleOrigin(next.url, next.importAttributes),
					importAttributes: {
						...importAttributes,
						...next.importAttributes,
						hot: next.format ?? "hot",
					},
				};
			}

			// Reload, from `hot.invalidate()` (or the file watcher that invokes it)
			case "reload": {
				return {
					format: hot.format,
					importAttributes: {
						...importAttributes,
						hot: hot.format,
					},
					shortCircuit: true,
					url: makeModuleOrigin(specifier, importAttributes, hot.version),
				};
			}
		}
	}();
};

/** @internal */
export const load: LoadHook = (urlString, context, nextLoad) => {

	// Early bail on node_modules or CommonJS graph
	const hotParam = context.importAttributes.hot;
	if (hotParam === undefined) {
		return nextLoad(urlString, context);
	}

	// Main entrypoint shim
	if (urlString === "hot:main") {
		// nb: `hotParam` is the specifier, as supplied on the nodejs command line
		return {
			format: "module",
			shortCircuit: true,
			source:
				`import controller from ${JSON.stringify(hotParam)} with { hot: "import" };\n` +
				"await controller().main();\n",
		};
	}

	// nb: `hotParam` is the resolved format
	return async function() {

		// Request code from next loader in the chain
		const origin = extractModuleOrigin(urlString);
		assert.ok(origin);
		const hot = new LoaderHot(urlString, port);
		const importAttributes = extractResolverImportAttributes(context.importAttributes);
		const result = await nextLoad(origin.moduleURL, {
			...context,
			format: function() {
				switch (hotParam) {
					case "commonjs":
					case "module":
					case "json":
						return hotParam;
					default:
						return undefined;
				}
			}(),
			importAttributes,
			hot,
		});

		// Render hot module controller
		if (!ignorePattern.test(urlString)) {
			switch (result.format) {
				case "json": {
					const source = makeJsonModule(origin, asString(result.source), importAttributes);
					return { format: "module", source };
				}
				case "module": {
					const source = await makeReloadableModule(origin, hot.get(), asString(result.source), importAttributes);
					return { format: "module", source };
				}
				default: break;
			}
		}

		// Otherwise this is an non-hot adapter module
		const source = makeAdapterModule(origin, importAttributes);
		return { format: "module", source };
	}();
};
