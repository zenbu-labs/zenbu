import * as assert from "node:assert";
import { createRequire } from "node:module";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Fn } from "@braidai/lang/functional";

/** @internal */
export type MaybePromise<Type> = Type | Promise<Type>;

/** @internal */
export type NotPromiseLike =
	null | undefined |
	(bigint | boolean | number | object | string) &
	{ then?: null | undefined | bigint | boolean | number | object | string };

/** @internal */
export const moduleNamespacePropertyDescriptor = {
	configurable: false,
	enumerable: true,
} satisfies Partial<PropertyDescriptor>;

/** @internal */
export function debounceAsync<Result>(fn: () => Promise<Result>) {
	let pending: Promise<Result> | undefined;
	let running: Promise<Result> | undefined;
	async function dispatch() {
		try {
			// eslint-disable-next-line @typescript-eslint/await-thenable
			await undefined;
			return await fn();
		} finally {
			running = undefined;
		}
	}
	return async () => {
		if (running) {
			return pending ??= async function() {
				await running;
				return dispatch();
			}();
		} else {
			return running = dispatch();
		}
	};
}

/** @internal */
export function debounceTimer<Result>(ms: number, fn: () => MaybePromise<Result>) {
	let completion: WithResolvers<Result> | undefined;
	let timer: NodeJS.Timeout | undefined;
	return () => {
		if (timer) {
			clearTimeout(timer);
		}
		timer = setTimeout(() => {
			void async function() {
				assert.ok(completion !== undefined);
				try {
					completion.resolve(await fn());
					timer = undefined;
				} catch (error) {
					completion.reject(error);
				}
			}();
		}, ms);
		timer.unref();
		completion = withResolvers<Result>();
		return completion.promise;
	};
}

/**
 * Evicts the given module URL from nodejs's internal module cache. `--expose-internals` must be
 * used to enable this. It might improve memory leakage, but probably not really.
 * @internal
 */
export const evictModule = function() {
	interface SecretLoader {
		getOrInitializeCascadedLoader: () => {
			loadCache?: Map<string, unknown>;
		};
	}
	try {
		const require = createRequire(import.meta.url);
		const loader = require("internal/modules/esm/loader") as unknown as SecretLoader;
		const { loadCache } = loader.getOrInitializeCascadedLoader();
		if (loadCache) {
			return (url: string) => {
				if (loadCache.has(url)) {
					loadCache.delete(url);
					return true;
				} else {
					return false;
				}
			};
		}
	} catch {}
}();

/** @internal */
export function discriminatedTypePredicate<Type extends { type: unknown }, Check extends Type>(type: Check["type"]) {
	return (node: Type): node is Check => node.type === type;
}

/**
 * Given an iterable of "maybe" promises this returns either `undefined` or a promise indicating
 * that all the yielded promises have resolved.
 */
export function maybeAll(maybePromises: Iterable<MaybePromise<undefined>>): MaybePromise<undefined> {
	const promises = Array.from(Fn.filter(maybePromises));
	if (promises.length > 0) {
		return async function() {
			// Don't continue until all settled
			await Promise.allSettled(promises);
			// Throw on failure
			await Promise.all(promises);
		}();
	}
}

/**
 * Very simple version of something like `gensync`. For functions which might be async, but probably
 * aren't.
 */
export function maybeThen<Return, Async extends NotPromiseLike>(
	task: () => Generator<MaybePromise<Async>, MaybePromise<Return>, Async>,
): MaybePromise<Return> {
	const iterator = task();
	let next = iterator.next();
	while (!next.done) {
		if (
			next.value != null &&
			typeof next.value.then === "function"
		) {
			// We are now a promise
			return async function() {
				while (!next.done) {
					next = iterator.next(await next.value);
				}
				return next.value;
			}();
		}
		// Continue synchronously
		next = iterator.next(next.value satisfies MaybePromise<Async> as Async);
	}
	return next.value;
}

const cwd = process.cwd();

/** @internal */
export function makeRelative(url: string) {
	if (url.startsWith("file:")) {
		const path = fileURLToPath(url);
		return relative(cwd, path);
	} else {
		return url;
	}
}

/** @internal */
export function plural(word: string, count: number) {
	return `${word}${count === 1 ? "" : "s"}`;
}

/** @internal */
export interface WithResolvers<Type> {
	readonly promise: Promise<Type>;
	readonly resolve: (value: Type) => void;
	readonly reject: (reason: unknown) => void;
}

// https://github.com/tc39/proposal-promise-with-resolvers
/** @internal */
export function withResolvers<Type>() {
	let resolve: (value: Type) => void;
	let reject: (reason: unknown) => void;
	const promise = new Promise<Type>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve: resolve!, reject: reject! } as WithResolvers<Type>;
}
