import type { AbstractModuleController, AbstractModuleInstance, ModuleNamespace, ResolvedBinding } from "./module.js";
import { Fn } from "@braidai/lang/functional";
import { ModuleStatus } from "./module.js";

/**
 * This is the adapter which delegates to an underlying non-swappable module. This is used for
 * built-in modules, CommonJS modules, WASM modules (for now?), or modules which otherwise refer
 * some other opaque "Abstract Module Record".
 * @internal
 */
export class AdapterModuleController implements AbstractModuleController, AbstractModuleInstance {
	readonly reloadable = false;
	readonly state = { status: ModuleStatus.evaluated };
	private readonly namespace: ResolvedBinding<ModuleNamespace>;
	private readonly resolutions: ReadonlyMap<string, () => unknown>;
	private readonly url;

	constructor(
		url: string,
		namespace: Record<string, unknown>,
	) {
		this.url = url;
		// Memoize resolved exports to maintain equality of the resolution. Note that this will fail
		// under some corner cases like:
		//
		//     commonjs.cjs:
		//     export * from "node:fs"`;
		//
		//     module.mjs:
		//     export * from "node:fs"`;
		//     export * from "./commonjs.cjs";
		//
		// In this case, module.mjs will not export anything from "node:fs" because the bindings
		// will be seen as ambiguous.
		this.resolutions = new Map<string, ResolvedBinding>(
			Fn.map(Object.keys(namespace), key => [ key, () => namespace[key] ]));
		this.namespace = () => namespace;
	}

	// No-op, in the case this is from `hot:main`
	main() {
		console.warn(`'${this.url}' is not ESM; hot module reloading is disabled`);
	}

	directExports() {
		return this.resolutions;
	}

	indirectExportEntries() {
		return [];
	}

	starExportEntries() {
		return [];
	}

	moduleNamespace() {
		return this.namespace;
	}

	resolveExport(exportName: string) {
		return this.resolutions.get(exportName) ?? null;
	}

	select() {
		return this;
	}
}
