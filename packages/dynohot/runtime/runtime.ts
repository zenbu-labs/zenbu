import type { ModuleController } from "./module.js";
import { AdapterModuleController } from "./adapter.js";
import { makeAcquire } from "./controller.js";
import { port2 } from "./port.js";

const self = new URL(import.meta.url);
const params = self.searchParams;

/** @internal */
export interface ModuleAdapter {
	readonly default: () => ModuleController;
}

/** @internal */
export const acquire = makeAcquire(
	(specifier, attributes) => import(specifier, { with: attributes }),
	Object.fromEntries(params),
	port2,
);

/** @internal */
export function adapter(url: string, namespace: Record<string, unknown>) {
	return new AdapterModuleController(url, namespace);
}
