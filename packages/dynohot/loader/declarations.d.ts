import type { Hot, LoaderHot } from "dynohot";

declare global {
	interface ImportMeta {
		readonly hot?: Hot;
		readonly dynoHot?: Hot;
	}
}

declare module "module" {
	interface LoadHookContext {
		/**
		 * `dynohot` loader-hot instance.
		 */
		hot?: LoaderHot;
	}
}
