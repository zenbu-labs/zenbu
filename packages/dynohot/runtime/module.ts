import type { AdapterModuleController } from "./adapter.js";
import type { ReloadableModuleController } from "./controller.js";
import type { IndirectExportEntry, StarExportEntry } from "./declaration.js";
import type { ReloadableModuleInstance } from "./instance.js";
import type { MaybePromise } from "./utility.js";

// 16.2.1.5 Cyclic Module Records
/** @internal */
export enum ModuleStatus {
	new = "new",
	// unlinked = "unlinked",
	linking = "linking",
	linked = "linked",
	evaluating = "evaluating",
	evaluatingAsync = "evaluating-async",
	evaluated = "evaluated",
}

/** @internal */
export interface AbstractModuleController {
	/** Invoked from `hot:main`, on the top-level module */
	main: () => MaybePromise<void>;

	/**
	 * Returns a module instance record from a controller which may manage many versions of a
	 * module.
	 */
	select: (select?: SelectModuleInstance) => ModuleInstance;
}

/**
 * Base interface for an *instance* of a module. Each instance can only be evaluated once, but a
 * controller can create more than one instance.
 * @internal
 */
export interface AbstractModuleInstance {
	state: { status: ModuleStatus };

	directExports: () => Iterable<readonly [ string, ResolvedBinding ]>;
	indirectExportEntries: () => Iterable<IndirectExportEntry>;
	starExportEntries: () => Iterable<StarExportEntry>;

	moduleNamespace: (select: SelectModuleInstance) => ResolvedBinding<ModuleNamespace>;
	resolveExport: (
		exportName: string,
		select: SelectModuleInstance,
		resolveSet: Map<ReloadableModuleInstance, Set<string>> | undefined
	) => Resolution;
}

/** @internal */
export type ModuleController = AdapterModuleController | ReloadableModuleController;

/** @internal */
export type ModuleInstance = AdapterModuleController | ReloadableModuleInstance;

/** @internal */
export type ModuleExports = Record<string, ResolvedBinding>;

/** @internal */
export type ModuleNamespace = Record<string, unknown>;

/**
 * The result of `resolveExport`. `null` is "not found", and `undefined` is "ambiguous"
 * @internal
 */
export type Resolution = ResolvedBinding | null | undefined;

/** @internal */
export type ResolvedBinding<Type = unknown> = () => Type;

/** @internal */
export type SelectModuleInstance = (controller: ReloadableModuleController) => ReloadableModuleInstance | undefined;
