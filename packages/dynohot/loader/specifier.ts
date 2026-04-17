import type { ImportAttributes } from "node:module";
import * as crypto from "node:crypto";
import { mappedPrimitiveComparator } from "@braidai/lang/comparator";

/** @internal */
export interface ModuleOrigin {
	backingModuleURL: string;
	moduleURL: string;
}

/** @internal */
export function makeModuleOrigin(moduleURL: string, importAttributes: ImportAttributes | undefined, version?: number) {
	const hash = crypto.createHash("sha256");
	const entries = Object.entries(importAttributes ?? {}).sort(mappedPrimitiveComparator(entry => entry[0]));
	hash.update(JSON.stringify(entries));
	if (version !== undefined) {
		hash.update(String(version));
	}
	const slug = hash.digest("hex").slice(0, 8);
	const backingModuleURL =
		moduleURL.includes("?")
			? `${moduleURL}&hot=+${slug}`
			: `${moduleURL}?hot==${slug}`;
	return backingModuleURL;
}

/** @internal */
export function extractModuleOrigin(backingModuleURL: string): ModuleOrigin | undefined {
	const index = backingModuleURL.indexOf("?hot==");
	const moduleURL = function() {
		if (index === -1) {
			const index = backingModuleURL.indexOf("&hot=+");
			if (index !== -1) {
				const url = new URL(backingModuleURL);
				url.searchParams.delete("hot");
				return url.href;
			}
		} else {
			return backingModuleURL.slice(0, index);
		}
	}();
	if (moduleURL !== undefined) {
		return { backingModuleURL, moduleURL };
	}
}
