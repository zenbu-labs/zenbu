import type { LoaderParameters } from "./loader.js";
import { register as registerLoader } from "node:module";
import * as port from "#port";

export interface Options {
	ignore?: RegExp;
	silent?: boolean;
}

/**
 * When manually registering the loader this function should be used instead of `register` from
 * "node:module". Or just `--import dynohot` on the command line.
 */
export function register(options: Options): void {
	registerLoader("dynohot/loader", {
		parentURL: import.meta.url,
		data: {
			...options,
			port: port.port1,
		} satisfies LoaderParameters,
		transferList: [ port.port1 ],
	});
}
