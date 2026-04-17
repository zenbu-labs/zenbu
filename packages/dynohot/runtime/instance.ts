import type { HotResolverPayload } from "#dynohot/loader/loader";
import type { ModuleDeclaration } from "./declaration.js";
import type { Data } from "./hot.js";
import type { AbstractModuleInstance, ModuleController, ModuleExports, ModuleInstance, ModuleNamespace, Resolution, SelectModuleInstance } from "./module.js";
import type { ModuleAdapter } from "./runtime.js";
import type { MaybePromise, WithResolvers } from "./utility.js";
import * as assert from "node:assert/strict";
import { mappedPrimitiveComparator } from "@braidai/lang/comparator";
import { Fn } from "@braidai/lang/functional";
import { BindingType } from "./binding.js";
import { ReloadableModuleController } from "./controller.js";
import { Hot, didDynamicImport } from "./hot.js";
import { initializeEnvironment } from "./initialize.js";
import { ModuleStatus } from "./module.js";
import { moduleNamespacePropertyDescriptor, withResolvers } from "./utility.js";

type ModuleState =
	ModuleStateNew |
	ModuleStateLinking |
	ModuleStateLinked |
	ModuleStateEvaluating |
	ModuleStateEvaluatingAsync |
	ModuleStateEvaluated;

interface ModuleStateNew {
	readonly status: ModuleStatus.new;
}

interface ModuleStateLinking {
	readonly status: ModuleStatus.linking;
	readonly continuation: ModuleContinuation;
	readonly environment: ModuleEnvironment;
}

interface ModuleStateLinked {
	readonly status: ModuleStatus.linked;
	readonly continuation: ModuleContinuation;
	readonly environment: ModuleEnvironment;
	readonly completion: WithResolvers<undefined>;
}

interface ModuleStateEvaluating {
	readonly status: ModuleStatus.evaluating;
	readonly environment: ModuleEnvironment;
	readonly completion: WithResolvers<undefined>;
}

interface ModuleStateEvaluatingAsync {
	readonly status: ModuleStatus.evaluatingAsync;
	readonly environment: ModuleEnvironment;
	readonly completion: WithResolvers<undefined>;
}

interface ModuleStateEvaluated {
	readonly status: ModuleStatus.evaluated;
	readonly environment: ModuleEnvironment;
	readonly evaluationError?: { error: unknown };
}

interface ModuleEnvironment {
	readonly exports: ModuleExports;
	readonly hot: Hot | null;
	readonly replace: (this: void, imports: ModuleExports) => void;
}

type ModuleContinuation =
	ModuleContinuationSync |
	ModuleContinuationAsync;

interface ModuleContinuationSync {
	readonly async: false;
	readonly iterator: Iterator<unknown, void, ModuleExports>;
}

interface ModuleContinuationAsync {
	readonly async: true;
	readonly iterator: AsyncIterator<unknown, void, ModuleExports>;
}

const ambiguousIndirectResolution = () => { throw new Error("Ambiguous"); };

/** @internal */
export class ReloadableModuleInstance implements AbstractModuleInstance {
	readonly declaration: ModuleDeclaration;
	readonly reloadable = true;
	state: ModuleState = { status: ModuleStatus.new };
	dynamicImports: {
		readonly controller: ReloadableModuleController;
		readonly specifier: string;
	}[] = [];

	private readonly controller;
	private namespace: (() => Record<string, unknown>) | undefined;

	constructor(
		controller: ReloadableModuleController,
		declaration: ModuleDeclaration,
	) {
		this.controller = controller;
		this.declaration = declaration;
	}

	clone() {
		return new ReloadableModuleInstance(this.controller, this.declaration);
	}

	instantiate(data?: Data) {
		if (this.state.status === ModuleStatus.new) {
			const { hot, importMeta } = (() => {
				if (this.declaration.meta === null) {
					return { hot: null, importMeta: null };
				} else {
					const hot = new Hot(this.controller, this, this.declaration.usesDynamicImport, data);
					const importMeta = Object.assign(Object.create(this.declaration.meta) as ImportMeta, {
						dynoHot: hot,
						hot,
						url: this.controller.url,
					});
					return { hot, importMeta };
				}
			})();
			const dynamicImport = this.dynamicImport.bind(this);
			if (this.declaration.body.async) {
				const iterator = this.declaration.body.execute(importMeta, dynamicImport);
				return (async () => {
					const next = await iterator.next();
					assert.equal(next.done, false);
					const [ replace, exports ] = next.value!;
					this.state = {
						status: ModuleStatus.linking,
						continuation: { async: true, iterator },
						environment: { exports, hot, replace },
					};
				})();
			} else {
				const iterator = this.declaration.body.execute(importMeta, dynamicImport);
				const next = iterator.next();
				assert.equal(next.done, false);
				const [ replace, exports ] = next.value!;
				this.state = {
					status: ModuleStatus.linking,
					continuation: { async: false, iterator },
					environment: { exports, hot, replace },
				};
			}
		}
	}

	link(select?: SelectModuleInstance) {
		assert.ok(this.state.status !== ModuleStatus.new);
		if (this.state.status === ModuleStatus.linking) {
			const bindings = initializeEnvironment(
				this.controller.url,
				this.declaration.loadedModules,
				entry => {
					if (typeof entry.controller !== "function") {
						const mod = entry.controller;
						return () => mod;
					}
					const module = entry.controller().select(select);
					assert.ok(
						module.state.status === ModuleStatus.linking ||
						module.state.status === ModuleStatus.linked ||
						module.state.status === ModuleStatus.evaluated ||
						module.state.status === ModuleStatus.evaluatingAsync);
					return module.moduleNamespace(select);
				},
				(entry, exportName) => {
					if (typeof entry.controller !== "function") {
						const mod = entry.controller as any;
						if (mod && mod[exportName] !== undefined) return () => mod[exportName];
						return null;
					}
					const module = entry.controller().select(select);
					assert.ok(
						module.state.status === ModuleStatus.linking ||
						module.state.status === ModuleStatus.linked ||
						module.state.status === ModuleStatus.evaluated ||
						module.state.status === ModuleStatus.evaluatingAsync);
					return module.resolveExport(exportName, select, undefined);
				});
			const imports = Object.fromEntries(bindings);
			const { continuation } = this.state;
			this.state = {
				status: ModuleStatus.linked,
				continuation: this.state.continuation,
				environment: this.state.environment,
				completion: withResolvers<undefined>(),
			};
			this.state.completion.promise.catch(() => {});
			if (continuation.async) {
				return (async () => {
					const next = await continuation.iterator.next(imports);
					assert.equal(next.done, false);
				})();
			} else {
				const next = continuation.iterator.next(imports);
				assert.equal(next.done, false);
			}
		}
	}

	relink(select?: SelectModuleInstance) {
		assert.ok(
			this.state.status === ModuleStatus.linked ||
			this.state.status === ModuleStatus.evaluated ||
			this.state.status === ModuleStatus.evaluatingAsync);
		const bindings = initializeEnvironment(
			this.controller.url,
			this.declaration.loadedModules,
			entry => {
				if (typeof entry.controller !== "function") {
					const mod = entry.controller;
					return () => mod;
				}
				const module = entry.controller().select(select);
				assert.ok(
					module.state.status === ModuleStatus.evaluated ||
					module.state.status === ModuleStatus.evaluatingAsync);
				return module.moduleNamespace(select);
			},
			(entry, exportName) => {
				if (typeof entry.controller !== "function") {
					const mod = entry.controller as any;
					if (mod && mod[exportName] !== undefined) return () => mod[exportName];
					return null;
				}
				const module = entry.controller().select(select);
				assert.ok(
					module.state.status === ModuleStatus.linked ||
					module.state.status === ModuleStatus.evaluated ||
					module.state.status === ModuleStatus.evaluatingAsync);
				return module.resolveExport(exportName, select, undefined);
			});
		if (this.state.status !== ModuleStatus.linked) {
			this.state.environment.replace(Object.fromEntries(bindings));
		}
	}

	/**
	 * Reset a module instance from "linked" or "linking" to "new". Returns `true` if the module is
	 * now in "new" state, false otherwise.
	 */
	unlink() {
		switch (this.state.status) {
			case ModuleStatus.new: return true;

			case ModuleStatus.linked:
			case ModuleStatus.linking: {
				const { continuation } = this.state;
				if (continuation.async) {
					void continuation.iterator.return?.();
				} else {
					continuation.iterator.return?.();
				}
				this.state = { status: ModuleStatus.new };
				return true;
			}

			default: return false;
		}
	}

	evaluate(): MaybePromise<undefined> {
		switch (this.state.status) {
			case ModuleStatus.linked: {
				const { completion, continuation } = this.state;
				if (continuation.async) {
					return (async () => {
						assert.equal(this.state.status, ModuleStatus.linked);
						this.state = {
							status: ModuleStatus.evaluatingAsync,
							environment: this.state.environment,
							completion,
						};
						try {
							const next = await continuation.iterator.next();
							assert.ok(next.done);
							completion.resolve(undefined);
							this.state = {
								status: ModuleStatus.evaluated,
								environment: this.state.environment,
							};
						} catch (error) {
							completion.reject(error);
							this.state = {
								status: ModuleStatus.evaluated,
								environment: this.state.environment,
								evaluationError: { error },
							};
							throw error;
						}
					})();
				} else {
					try {
						this.state = {
							status: ModuleStatus.evaluating,
							environment: this.state.environment,
							completion,
						};
						const next = continuation.iterator.next();
						assert.ok(next.done);
						completion.resolve(undefined);
						this.state = {
							status: ModuleStatus.evaluated,
							environment: this.state.environment,
						};
					} catch (error) {
						completion.reject(error);
						this.state = {
							status: ModuleStatus.evaluated,
							environment: this.state.environment,
							evaluationError: { error },
						};
						throw error;
					}
				}
				return;
			}

			case ModuleStatus.evaluated:
				if (this.state.evaluationError) {
					throw this.state.evaluationError.error;
				}
				return;

			case ModuleStatus.evaluatingAsync:
				return this.state.completion.promise;

			default: assert.fail();
		}
	}

	lookupSpecifier(specifier: string) {
		const entry = this.declaration.loadedModules.find(entry => entry.specifier === specifier);
		if (entry === undefined) {
			const dynamicImport = this.dynamicImports.find(entry => entry.specifier === specifier);
			return dynamicImport?.controller;
		} else {
			if (typeof entry.controller !== "function") {
				return;
			}
			const controller = entry.controller();
			if (controller.reloadable) {
				return controller;
			}
		}
	}

	*iterateDependencies() {
		yield* Fn.transform(this.declaration.loadedModules, function*(entry) {
			if (typeof entry.controller !== "function") {
				return;
			}
			const controller = entry.controller();
			if (controller.reloadable) {
				yield controller;
			}
		});
		yield* Fn.map(this.dynamicImports, instance => instance.controller);
	}

	directExports() {
		assert.ok(this.state.status !== ModuleStatus.new);
		return Object.entries(this.state.environment.exports);
	}

	indirectExportEntries() {
		return this.declaration.indirectExportEntries.values();
	}

	starExportEntries() {
		return this.declaration.starExportEntries;
	}

	// 10.4.6.12 ModuleNamespaceCreate ( module, exports )
	// 16.2.1.6.2 GetExportedNames ( [ exportStarSet ] )
	// 16.2.1.10 GetModuleNamespace ( module )
	moduleNamespace(select?: SelectModuleInstance) {
		if (!this.namespace) {
			assert.ok(this.state.status !== ModuleStatus.new);
			const namespace = Object.create(null) as Record<string, unknown>;
			this.namespace ??= () => namespace;

			const collectNamedExports = function*(instance: ModuleInstance) {
				// Local names
				yield* instance.directExports();

				// Named indirect exports
				for (const entry of instance.indirectExportEntries()) {
					if (entry.binding.type === BindingType.indirectExport) {
						const name = entry.binding.as ?? entry.binding.name;
						const resolution = instance.resolveExport(entry.binding.name, select, undefined);
						assert.ok(resolution != null);
						yield [ name, resolution ] as const;
					} else {
						assert.equal(entry.binding.type, BindingType.indirectStarExport);
						const name = entry.binding.as;
						const resolution = entry.moduleRequest.controller().select(select).moduleNamespace();
						yield [ name, resolution ] as const;
					}
				}
			};

			// Resolve directly exported names
			const directResolutions = new Map(collectNamedExports(this));

			// Resolve indirect star exports
			const seen = new Set<ModuleInstance>([ this ]);
			const indirectResolutions = new Map<string, () => unknown>();
			for (const entry of this.starExportEntries()) {
				const instance = entry.moduleRequest.controller().select(select);
				(function traverse(instance: ModuleInstance) {
					if (seen.has(instance)) {
						return;
					} else {
						seen.add(instance);
					}
					for (const [ name, resolution ] of collectNamedExports(instance)) {
						if (name !== "default") {
							const previousResolution = indirectResolutions.get(name);
							if (previousResolution === undefined) {
								indirectResolutions.set(name, resolution);
							} else if (previousResolution !== resolution) {
								indirectResolutions.set(name, ambiguousIndirectResolution);
							}
						}
					}
					for (const entry of instance.starExportEntries()) {
						traverse(entry.moduleRequest.controller().select(select));
					}
				})(instance);
			}

			// Combine direct & indirect exports
			const unambiguousIndirectResolutions =
				Fn.reject(indirectResolutions, ([ name, resolution ]) =>
					resolution === ambiguousIndirectResolution || directResolutions.has(name));
			const namespaceDescriptors = Fn.pipe(
				Fn.concat([ directResolutions, unambiguousIndirectResolutions ]),
				$$ => Fn.map($$, ([ name, resolution ]) => {
					const descriptor = { ...moduleNamespacePropertyDescriptor, get: resolution };
					return [ name, descriptor ] as const;
				}),
				$$ => [ ...$$ ],
				$$ => $$.sort(mappedPrimitiveComparator(([ name ]) => name)),
				$$ => [ ...$$ ],
			);
			Object.defineProperties(namespace, Object.fromEntries(namespaceDescriptors));
			Object.freeze(namespace);
		}
		return this.namespace;
	}

	// 16.2.1.6.3 ResolveExport ( exportName [ , resolveSet ] )
	resolveExport(
		exportName: string,
		select: SelectModuleInstance | undefined,
		resolveSet: Map<ReloadableModuleInstance, Set<string>> | undefined = new Map(),
	): Resolution {
		// 1. Assert: module.[[Status]] is not new.
		assert.ok(this.state.status !== ModuleStatus.new);

		// 2. If resolveSet is not present, set resolveSet to a new empty List.
		// 3. For each Record { [[Module]], [[ExportName]] } r of resolveSet, do
		const moduleResolveSet = resolveSet.get(this);
		if (moduleResolveSet) {
			if (moduleResolveSet.has(exportName)) {
				// a. If module and r.[[Module]] are the same Module Record and SameValue(exportName, r.
				//    [[ExportName]]) is true, then
				//   i. Assert: This is a circular import request.
				//   ii. Return null.
				return null;
			}
			moduleResolveSet.add(exportName);
		} else {
			// 4. Append the Record { [[Module]]: module, [[ExportName]]: exportName } to resolveSet.
			resolveSet.set(this, new Set([ exportName ]));
		}

		// 5. For each ExportEntry Record e of module.[[LocalExportEntries]], do
		const localExport = this.state.environment.exports[exportName];
		if (localExport !== undefined && Object.hasOwn(this.state.environment.exports, exportName)) {
			// a. If SameValue(exportName, e.[[ExportName]]) is true, then
			//   i. Assert: module provides the direct binding for this export.
			//   ii. Return ResolvedBinding Record { [[Module]]: module, [[BindingName]]: e.
			//       [[LocalName]] }.
			return localExport;
		}
		// 6. For each ExportEntry Record e of module.[[IndirectExportEntries]], do
		const indirectExport = this.declaration.indirectExportEntries.get(exportName);
		if (indirectExport) {
			// a. If SameValue(exportName, e.[[ExportName]]) is true, then
			//   i. Let importedModule be GetImportedModule(module, e.[[ModuleRequest]]).
			const importedModule = indirectExport.moduleRequest.controller().select(select);
			//   ii. If e.[[ImportName]] is all, then
			if (indirectExport.binding.type === BindingType.indirectStarExport) {
				// 1. Assert: module does not provide the direct binding for this export.
				// 2. Return ResolvedBinding Record { [[Module]]: importedModule, [[BindingName]]:
				//    namespace }.
				return importedModule.moduleNamespace(select);
			// iii. Else,
			} else {
				// 1. Assert: module imports a specific binding for this export.
				// 2. Return importedModule.ResolveExport(e.[[ImportName]], resolveSet).
				return importedModule.resolveExport(indirectExport.binding.name, select, resolveSet);
			}
		}
		// 7. If SameValue(exportName, "default") is true, then
		if (exportName === "default") {
			// a. Assert: A default export was not explicitly defined by this module.
			// b. Return null.
			// c. NOTE: A default export cannot be provided by an export * from "mod" declaration.
			return null;
		}
		// 8. Let starResolution be null.
		let starResolution: Resolution = null;
		// 9. For each ExportEntry Record e of module.[[StarExportEntries]], do
		for (const exportEntry of this.declaration.starExportEntries) {
			// a. Let importedModule be GetImportedModule(module, e.[[ModuleRequest]]).
			const importedModule = exportEntry.moduleRequest.controller().select(select);
			// b. Let resolution be importedModule.ResolveExport(exportName, resolveSet).
			const resolution = importedModule.resolveExport(exportName, select, resolveSet);
			// c. If resolution is ambiguous, return ambiguous.
			if (resolution === undefined) {
				return undefined;
			}
			// d. If resolution is not null, then
			if (resolution !== null) {
				// i. Assert: resolution is a ResolvedBinding Record.
				// ii. If starResolution is null, set starResolution to resolution.
				if (starResolution === null) {
					starResolution = resolution;
				// iii. Else,
				} else {
					// 1. Assert: There is more than one * import that includes the requested name.
					// 2. If resolution.[[Module]] and starResolution.[[Module]] are not the same
					//    Module Record, return ambiguous.
					// 3. If resolution.[[BindingName]] is not starResolution.[[BindingName]] and
					//    either resolution.[[BindingName]] or starResolution.[[BindingName]] is
					//    namespace, return ambiguous.
					// 4. If resolution.[[BindingName]] is a String, starResolution.[[BindingName]]
					//    is a String, and SameValue(resolution.[[BindingName]], starResolution.
					//    [[BindingName]]) is false, return ambiguous.
					// eslint-disable-next-line no-lonely-if
					if (starResolution !== resolution) {
						return undefined;
					}
				}
			}
		}
		// 10. Return starResolution.
		return starResolution;
	}

	private async dynamicImport(specifier: string, importAttributes?: Record<string, string>) {
		assert.ok(
			this.state.status === ModuleStatus.linked ||
			this.state.status === ModuleStatus.evaluating ||
			this.state.status === ModuleStatus.evaluatingAsync ||
			this.state.status === ModuleStatus.evaluated);
		const hot: HotResolverPayload = {
			hot: "expression",
			parentURL: this.controller.url,
		};
		const withAttributes: ImportAttributes = {
			...importAttributes,
			hot: JSON.stringify(hot),
		};
		const moduleNamespace = await this.controller.application.dynamicImport(specifier, withAttributes);
		const moduleAdapter = moduleNamespace satisfies ModuleNamespace as unknown as ModuleAdapter;
		const controller: ModuleController = moduleAdapter.default();
		didDynamicImport(this, controller);
		if (controller.reloadable) {
			this.dynamicImports.push({ controller, specifier });
			await controller.dispatch();
			return controller.select().moduleNamespace()();
		} else {
			return controller.moduleNamespace()();
		}
	}
}
