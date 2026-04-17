// See:
// - 16.2.1.6 Source Text Module Records
// - https://github.com/tc39/proposal-compartments/blob/master/1-static-analysis.md

/** @internal */
export type BindingEntry = ImportNameEntry | ImportStarEntry | ExportIndirectEntry | ExportIndirectStarEntry | ExportStarEntry;

/** @internal */
export enum BindingType {
	// import id from "...";
	import = "import",
	// import * as ns from "...";
	importStar = "importStar",
	// export { id } from "...";
	indirectExport = "indirectExport",
	// export * as namespace from "...";
	indirectStarExport = "indirectStarExport",
	// export * from "...";
	exportStar = "exportStar",
}

/** @internal */
export interface ImportNameEntry {
	readonly type: BindingType.import;
	readonly name: string;
	readonly as?: string;
}

/** @internal */
export interface ImportStarEntry {
	readonly type: BindingType.importStar;
	readonly as: string;
}

/** @internal */
export interface ExportIndirectEntry {
	readonly type: BindingType.indirectExport;
	readonly name: string;
	readonly as?: string;
}

/** @internal */
export interface ExportIndirectStarEntry {
	readonly type: BindingType.indirectStarExport;
	readonly as: string;
}

/** @internal */
export interface ExportStarEntry {
	readonly type: BindingType.exportStar;
}

/** @internal */
export interface ModuleRequestEntry {
	readonly specifier: string;
	readonly bindings: readonly BindingEntry[];
}
