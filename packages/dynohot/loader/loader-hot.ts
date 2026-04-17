import type { MessagePort } from "node:worker_threads";

/**
 * This is visible to other loaders, in the `load` hook. It has nothing to do with
 * `import.meta.hot`. If you are writing a loader you can tweak the behavior of modules with this
 * object.
 *
 * I was going to call it `MetaHot` which is pretty much exactly what this is, but that is confusing
 * with `import.meta.hot`.
 */
export class LoaderHot {
	readonly #port;
	readonly #watch: string[] = [];
	readonly #url;

	/** @internal */
	constructor(url: string, port: MessagePort) {
		this.#port = port;
		this.#url = url;
	}

	/** @internal */
	get() {
		if (this.#watch.length === 0) {
			return [ this.#url ];
		} else {
			return this.#watch;
		}
	}

	/**
	 * Can be invoked at a later time by a given loader to invalidate the module.
	 */
	invalidate(): void {
		this.#port.postMessage(this.#url);
	}

	/**
	 * If invoked then the given file `url` will be watched for changes instead of the loader's
	 * `url` result.
	 */
	watch(url: URL): void {
		this.#watch.push(url.href);
	}
}
