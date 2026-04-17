import type { ModuleRequestEntry } from "./binding.js";
import { BindingType } from "./binding.js";

// 16.2.1.6.4 `InitializeEnvironment`
/** @internal */
export function initializeEnvironment<Request extends ModuleRequestEntry, Resolution extends object>(
	url: string,
	loadedModules: Iterable<Request>,
	/** Return the module namespace */
	moduleNamespace: (module: Request) => Resolution,
	/**
	 * Resolve the given binding entry.
	 * @returns `null` is unresolvable, `undefined` is ambiguous.
	 */
	resolveExport: (module: Request, exportName: string) => Resolution | null | undefined,
) {
	// 1. For each ExportEntry Record e of module.[[IndirectExportEntries]], do
	//   a. Let resolution be module.ResolveExport(e.[[ExportName]]).
	//   b. If resolution is either null or ambiguous, throw a SyntaxError exception.
	//   c. Assert: resolution is a ResolvedBinding Record.
	const resolvedBindings: [ localName: string, resolution: Resolution ][] = [];

	// 2. Assert: All named exports from module are resolvable.
	// 3. Let realm be module.[[Realm]].
	// 4. Assert: realm is not undefined.
	// 5. Let env be NewModuleEnvironment(realm.[[GlobalEnv]]).
	// 6. Set module.[[Environment]] to env.

	// 7. For each ImportEntry Record in of module.[[ImportEntries]], do
	//   a. Let importedModule be GetImportedModule(module, in.[[ModuleRequest]]).
	for (const importedModule of loadedModules) {
		for (const binding of importedModule.bindings) {
			switch (binding.type) {
				// b. If in.[[ImportName]] is namespace-object, then
				case BindingType.importStar: {
					// i. Let namespace be GetModuleNamespace(importedModule).
					// ii. Perform ! env.CreateImmutableBinding(in.[[LocalName]], true).
					// iii. Perform ! env.InitializeBinding(in.[[LocalName]], namespace).
					const resolution = moduleNamespace(importedModule);
					resolvedBindings.push([ binding.as, resolution ]);
					break;
				}

				// c. Else,
				case BindingType.import: {
					// i. Let resolution be importedModule.ResolveExport(in.[[ImportName]]).
					const resolution = resolveExport(importedModule, binding.name);
					// ii. If resolution is either null or ambiguous, throw a SyntaxError exception.
					if (resolution === null) {
						throw Object.assign(
							new SyntaxError(`The requested module '${importedModule.specifier}' does not provide an export named '${binding.name}'`),
							{ url });
					} else if (resolution === undefined) {
						throw Object.assign(
							new SyntaxError(`The requested module '${importedModule.specifier}' contains conflicting star exports for name '${binding.name}'`),
							{ url });
					}
					// iii. If resolution.[[BindingName]] is namespace, then
					//   1. Let namespace be GetModuleNamespace(resolution.[[Module]]).
					//   2. Perform ! env.CreateImmutableBinding(in.[[LocalName]], true).
					//   3. Perform ! env.InitializeBinding(in.[[LocalName]], namespace).
					// iv. Else,
					//   1. Perform env.CreateImportBinding(in.[[LocalName]], resolution.[[Module]],
					//      resolution.[[BindingName]]).
					resolvedBindings.push([ binding.as ?? binding.name, resolution ]);
					break;
				}

				default:
			}
		}
	}

	// [Remainder of specification is handled by the actual environment]
	return resolvedBindings;
}
