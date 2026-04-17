import type { ExportIndirectEntry, ExportIndirectStarEntry, ExportStarEntry, ModuleRequestEntry } from "./binding.js";
import type { ModuleController, ModuleExports, ModuleNamespace } from "./module.js";
import type { ModuleFormat } from "node:module";

/** @internal */
export interface ModuleDeclaration {
	readonly body: ModuleBody;
	readonly meta: ImportMeta | null;
	readonly format: ModuleFormat;
	readonly importAttributes: Record<string, string>;
	readonly usesDynamicImport: boolean;
	readonly indirectExportEntries: ReadonlyMap<string, IndirectExportEntry>;
	readonly starExportEntries: readonly StarExportEntry[];
	readonly loadedModules: readonly LoadedModuleRequestEntry[];
}

/** @internal */
export interface IndirectExportEntry {
	readonly moduleRequest: LoadedModuleRequestEntry;
	readonly binding: ExportIndirectEntry | ExportIndirectStarEntry;
}

/** @internal */
export interface StarExportEntry {
	readonly moduleRequest: LoadedModuleRequestEntry;
	readonly binding: ExportStarEntry;
}

/** @internal */
export type ModuleBody = ModuleBodySync | ModuleBodyAsync;

/** @internal */
export type DynamicImport = (specifier: string, importAttributes: Record<string, string>) => Promise<ModuleNamespace>;

interface ModuleBodySync {
	async: false;
	execute: (meta: ImportMeta | null, dynamicImport: DynamicImport) => Generator<ModuleBodyYields, void, ModuleExports>;
}

interface ModuleBodyAsync {
	async: true;
	execute: (
		meta: ImportMeta | null,
		dynamicImport: DynamicImport,
	) => AsyncGenerator<ModuleBodyYields, void, ModuleExports>;
}

/** @internal */
export type ModuleBodyYields = ModuleBodyYieldScope | undefined;

/** @internal */
export type ModuleBodyYieldScope = [ ModuleBodyImportsReplace, ModuleExports ];

/** @internal */
export type ModuleBodyImportsReplace = (this: void, exports: ModuleExports) => void;

/** @internal */
export interface LoadedModuleRequestEntry extends ModuleRequestEntry {
	readonly controller: () => ModuleController;
}
