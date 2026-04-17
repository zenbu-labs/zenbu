import type { HotResolverPayload } from "#dynohot/loader/loader";
import type { BindingEntry, ExportIndirectEntry, ExportIndirectStarEntry, ExportStarEntry } from "./binding.js";
import type { DynamicImport, LoadedModuleRequestEntry, ModuleBody, ModuleDeclaration } from "./declaration.js";
import type { AbstractModuleController } from "./module.js";
import type { ModuleFormat } from "node:module";
import type { MessagePort } from "node:worker_threads";
import * as assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { EOL } from "node:os";
import { Fn } from "@braidai/lang/functional";
import { somePredicate } from "@braidai/lang/predicate";
import { BindingType } from "./binding.js";
import { dispose, isAccepted, isAcceptedSelf, isDeclined, isInvalidated, prune, tryAccept, tryAcceptSelf } from "./hot.js";
import { ReloadableModuleInstance } from "./instance.js";
import { ModuleStatus } from "./module.js";
import { makeAcquireVisitIndex, makeTraversalState, traverseDepthFirst } from "./traverse.js";
import { debounceAsync, debounceTimer, discriminatedTypePredicate, evictModule, makeRelative, maybeAll, maybeThen, plural } from "./utility.js";
import { FileWatcher } from "./watcher.js";

/** @internal */
export function makeAcquire(dynamicImport: DynamicImport, params: Record<string, unknown>, port: MessagePort | undefined) {
	const emitter = new EventEmitter();
	const useLogs = params.silent === undefined;
	const application: HotApplication = {
		dynamicImport,
		emitter,
		fileWatcher: new FileWatcher(),
		requestUpdate: defaultRequestUpdate,
		requestUpdateResult: defaultRequestUpdateResult,
		log(message, ...params) {
			if (useLogs) {
				console.error(`[hot] ${message}`, ...params);
			}
			emitter.emit("message", message, ...params);
		},
	};
	const modules = new Map<string, ReloadableModuleController>();
	if (port) {
		port.on("message", (message: string) => {
			void modules.get(message)?.reload();
		});
		// nb: The `on` method re-refs the port. Truly incredible, wow!
		port.unref();
	}
	return function acquire(url: string, watch?: readonly string[]) {
		return modules.get(url) ?? function() {
			const module = new ReloadableModuleController(application, url, watch);
			modules.set(url, module);
			return module;
		}();
	};
}

function defaultRequestUpdate() {
	return Promise.resolve();
}

// eslint-disable-next-line @typescript-eslint/require-await
async function defaultRequestUpdateResult(): Promise<never> {
	throw new Error("Not fully loaded.");
}

export interface HotApplication {
	dynamicImport: DynamicImport;
	emitter: EventEmitter;
	fileWatcher: FileWatcher;
	log: (message: string, ...params: unknown[]) => void;
	requestUpdate: () => Promise<void>;
	requestUpdateResult: () => Promise<UpdateResult>;
}

/** @internal */
export enum UpdateStatus {
	success = "success",
	declined = "declined",
	evaluationFailure = "evaluationError",
	linkError = "linkError",
	fatalError = "fatalError",
	unaccepted = "unaccepted",
	unacceptedEvaluation = "unacceptedEvaluation",
}

type UpdateResult =
	undefined |
	UpdateSuccess |
	UpdateDeclined |
	UpdateUnaccepted |
	UpdateEvaluationError |
	UpdateFatalError |
	UpdateLinkError;

interface UpdateSuccess {
	type: UpdateStatus.success | UpdateStatus.unacceptedEvaluation;
	stats: () => UpdateStats;
}

interface UpdateDeclined {
	type: UpdateStatus.declined;
	declined: readonly ReloadableModuleController[];
}

interface UpdateUnaccepted {
	type: UpdateStatus.unaccepted;
	chain: readonly InvalidationChain[];
}

interface UpdateEvaluationError {
	type: UpdateStatus.evaluationFailure;
	error: unknown;
	stats: () => UpdateStats;
}

interface UpdateLinkError {
	type: UpdateStatus.linkError;
	error: unknown;
}

interface UpdateFatalError {
	type: UpdateStatus.fatalError;
	error: unknown;
}

interface UpdateStats {
	duration: number;
	loads: number;
	reevaluations: number;
}

interface InvalidationChain {
	modules: readonly ReloadableModuleController[];
	/** `undefined` means it's the end of the chain, `null` means we've seen this branch before */
	next: readonly InvalidationChain[] | undefined | null;
}

function logUpdate(app: HotApplication, update: UpdateResult) {
	if (update === undefined) {
		return;
	}
	switch (update.type) {
		case UpdateStatus.declined:
			app.log(
				"A pending update was explicitly declined:" +
				update.declined.map(() => `${EOL}- %s`).join(),
				...update.declined.map(declined => makeRelative(declined.url)));
			break;

		case UpdateStatus.fatalError:
			app.log("A fatal error was encountered. The application should be restarted!");
			break;

		case UpdateStatus.evaluationFailure: {
			const { duration, loads, reevaluations } = update.stats();
			const ms = Math.round(duration);
			app.log(`Loaded %d new ${plural("module", loads)}, reevaluated %d existing ${plural("module", reevaluations)} in %dms.`, loads, reevaluations, ms);
			app.log("Caught evaluation error:", update.error);
			break;
		}

		case UpdateStatus.linkError: {
			const { error } = update;
			if (error instanceof SyntaxError && "url" in error) {
				app.log(
					"Caught link error:" + EOL +
					"%s: %s" + EOL +
					"    at (%s)",
					error.name, error.message, error.url);
			} else {
				app.log(`Caught link error:${EOL}%O`, error);
			}
			break;
		}

		case UpdateStatus.success: {
			const { duration, loads, reevaluations } = update.stats();
			const ms = Math.round(duration);
			app.log(`Loaded %d new ${plural("module", loads)}, reevaluated %d existing ${plural("module", reevaluations)} in %dms.`, loads, reevaluations, ms);
			break;
		}

		case UpdateStatus.unaccepted: {
			const messages = [ ...Fn.transform(update.chain, message => flattenInvalidationTree(message)) ];
			app.log(
				"A pending update was not accepted, and reached the root module:" +
				messages.map(([ message ]) => `${EOL}${message}`).join(""),
				...Fn.transform(messages, ([ , ...params ]) => params));
			break;
		}

		case UpdateStatus.unacceptedEvaluation: {
			const { duration, loads, reevaluations } = update.stats();
			const ms = Math.round(duration);
			app.log(`Loaded %d new ${plural("module", loads)}, reevaluated %d existing ${plural("module", reevaluations)} in %dms.`, loads, reevaluations, ms);
			app.log("Unaccepted update reached the root module. The application should be restarted!");
			break;
		}
	}
}

// Nice:
// https://stackoverflow.com/questions/4965335/how-to-print-binary-tree-diagram-in-java/8948691#8948691
function *flattenInvalidationTree(chain: InvalidationChain, prefix = "", childrenPrefix = ""): Iterable<[ string, ...unknown[] ]> {
	const suffix = chain.next === undefined ? " 🔄" : "";
	yield [
		`  ${prefix}[${chain.modules.map(() => "%s").join(", ")}]${suffix}`,
		...chain.modules.map(module => makeRelative(module.url)),
	];
	if (chain.next === null) {
		yield [ `  ${childrenPrefix}[...]` ];
	} else if (chain.next !== undefined) {
		for (const [ ii, child ] of chain.next.entries()) {
			if (ii === chain.next.length - 1) {
				yield* flattenInvalidationTree(child, `${childrenPrefix}└─ `, `${childrenPrefix}   `);
			} else {
				yield* flattenInvalidationTree(child, `${childrenPrefix}├─ `, `${childrenPrefix}│  `);
			}
		}
	}
}

const acquireVisitIndex = makeAcquireVisitIndex();

/** @internal */
export class ReloadableModuleController implements AbstractModuleController {
	readonly application;
	readonly reloadable = true;
	readonly url;

	/** The currently "active" module instance */
	private current: ReloadableModuleInstance | undefined;
	/** During an update, but before this module is evaluated, this is what `current` will become */
	private pending: ReloadableModuleInstance | undefined;
	/** Durning an update, this is what `current` was and/or is */
	private previous: ReloadableModuleInstance | undefined;
	/** Written to at *any* time in response to the file watcher */
	private staging: ReloadableModuleInstance | undefined;
	/** Temporary, maybe "unlinked" instances used for link testing */
	private temporary: ReloadableModuleInstance | undefined;
	private fatalError: UpdateFatalError | undefined;
	private traversal = makeTraversalState();
	private visitIndex = 0;
	private version = 0;

	constructor(
		application: HotApplication,
		url: string,
		watch?: readonly string[],
	) {
		this.application = application;
		this.url = url;
		// TODO [marcel 2025-02-05]: This returns a handle to an unlistener which should probably be
		// invoked on `prune`.
		if (watch) {
			for (const url of watch) {
				application.fileWatcher.watch(url, () => void this.reload());
			}
		}
	}

	private static selectCurrent(this: void, controller: ReloadableModuleController) {
		return controller.current;
	}

	async main(this: ReloadableModuleController) {
		// Bind `requestUpdate` to the root module
		assert.equal(this.application.requestUpdate, defaultRequestUpdate);
		this.application.requestUpdate = debounceTimer(100, debounceAsync(async () => {
			const update = await this.requestUpdate();
			logUpdate(this.application, update);
		}));
		this.application.requestUpdateResult = () => this.requestUpdate();

		// Dispatch the module
		await this.dispatch();
	}

	async dispatch(this: ReloadableModuleController) {
		if (this.current === undefined) {
			// Set `current` from `staging` if it's not set up, then instantiate & link all
			// reloadable modules.
			await traverseDepthFirst(
				this,
				node => node.traversal,
				(node, traversal) => {
					node.traversal = traversal;
					if (node.current === undefined) {
						node.current = node.select(controller => controller.staging);
					}
					return node.iterate();
				},
				cycleNodes => maybeThen(function*() {
					// Instantiate the cycle (cannot fail)
					for (const node of cycleNodes) {
						yield node.select().instantiate();
					}
					// Link the cycle
					for (let ii = 0; ii < cycleNodes.length; ++ii) {
						const node = cycleNodes[ii]!;
						try {
							yield node.select().link();
						} catch (error) {
							// Unlink failed cycle nodes
							for (let jj = ii; jj < cycleNodes.length; ++jj) {
								if (node.select().unlink()) {
									node.current = undefined;
								}
							}
							throw error;
						}
					}
					return undefined;
				}),
				pendingNodes => {
					for (const node of pendingNodes) {
						if (node.select().unlink()) {
							node.current = undefined;
						}
					}
				});

			// Evaluate
			await traverseDepthFirst(
				this,
				node => node.traversal,
				(node, traversal) => {
					node.traversal = traversal;
					return node.iterate();
				},
				cycleNodes => maybeAll(
					Fn.map(cycleNodes, node => {
						const current = node.select();
						if (current === node.staging) {
							node.staging = undefined;
						}
						return current.evaluate();
					}),
				));
		} else if (this.current.state.status === ModuleStatus.evaluatingAsync) {
			return this.current.state.completion.promise;
		}
	}

	// Invoked from transformed module source
	load(
		backingModuleURL: string | null,
		body: ModuleBody,
		meta: ImportMeta | null,
		usesDynamicImport: boolean,
		format: ModuleFormat,
		importAttributes: Record<string, string>,
		loadedModules: readonly LoadedModuleRequestEntry[],
	) {
		if (evictModule) {
			// Experimental module eviction
			if (backingModuleURL !== null) {
				evictModule(backingModuleURL);
			}
		}
		const declaration: ModuleDeclaration = {
			body,
			meta,
			format,
			importAttributes,
			usesDynamicImport,
			loadedModules,
			indirectExportEntries: new Map(function*() {
				const predicate = somePredicate([
					discriminatedTypePredicate<BindingEntry, ExportIndirectEntry>(BindingType.indirectExport),
					discriminatedTypePredicate<BindingEntry, ExportIndirectStarEntry>(BindingType.indirectStarExport),
				]);
				for (const moduleRequest of loadedModules) {
					for (const binding of Fn.filter(moduleRequest.bindings, predicate)) {
						const as = binding.type === BindingType.indirectStarExport ? binding.as : binding.as ?? binding.name;
						yield [ as, { moduleRequest, binding } ];
					}
				}
			}()),
			starExportEntries: Array.from(function*() {
				const exportStarPredicate = discriminatedTypePredicate<BindingEntry, ExportStarEntry>(BindingType.exportStar);
				for (const moduleRequest of loadedModules) {
					for (const binding of Fn.filter(moduleRequest.bindings, exportStarPredicate)) {
						yield { moduleRequest, binding };
					}
				}
			}()),
		};
		this.staging = new ReloadableModuleInstance(this, declaration);
	}

	async reload() {
		const instance = this.staging ?? this.current;
		assert.ok(instance !== undefined);
		const { importAttributes } = instance.declaration;
		const directive: HotResolverPayload = {
			hot: "reload",
			format: instance.declaration.format,
			version: ++this.version,
		};
		const attributes: ImportAttributes = {
			...importAttributes,
			hot: JSON.stringify(directive),
		};
		try {
			await import(this.url, { with: attributes });
		} catch (error) {
			this.application.log(`Error in module '%s':${EOL}%O`, this.url, error);
			return;
		}
		void this.application.requestUpdate();
	}

	select(select = ReloadableModuleController.selectCurrent) {
		const instance = select(this);
		assert.ok(instance !== undefined);
		return instance;
	}

	private *iterate(select = ReloadableModuleController.selectCurrent) {
		for (const child of this.select(select).declaration.loadedModules) {
			if (typeof child.controller !== "function") continue;
			const controller = child.controller();
			if (controller.reloadable) {
				yield controller;
			}
		}
	}

	private *iterateWithDynamics(
		select = ReloadableModuleController.selectCurrent,
		selectDynamic = ReloadableModuleController.selectCurrent,
	) {
		yield* this.iterate(select);
		const instance = this.select(selectDynamic);
		yield* Fn.map(instance.dynamicImports, entry => entry.controller);
	}

	private *traverse(
		iterate: (node: ReloadableModuleController) => Iterable<ReloadableModuleController> =
		node => node.iterateWithDynamics(),
	) {
		using visitIndex = acquireVisitIndex();
		yield* function *traverse(node: ReloadableModuleController): Iterable<ReloadableModuleController> {
			for (const child of iterate(node)) {
				if (child.visitIndex !== visitIndex.index) {
					child.visitIndex = visitIndex.index;
					yield child;
					yield* traverse(child);
				}
			}
		}(this);
	}

	private async requestUpdate(this: ReloadableModuleController): Promise<UpdateResult> {

		// Check for previous unrecoverable error
		if (this.fatalError) {
			return this.fatalError;
		}

		// Set up statistics tracking
		let loads = 0;
		let reevaluations = 0;
		const timeStarted = performance.now();
		const stats = (): UpdateStats => ({
			loads,
			reevaluations,
			duration: performance.now() - timeStarted,
		});

		// Dispatch "dry run" to see if it is possible to accept this update. Also mark `previous`
		// and `pending`.
		interface DryRunResult {
			forwardResults: readonly DryRunResult[];
			declined: readonly ReloadableModuleController[];
			invalidated: readonly ReloadableModuleController[];
			hasDecline: boolean;
			hasNewCode: boolean;
			needsDispatch: boolean;
		}
		const nextControllers: ReloadableModuleController[] = [];
		const initialResult = traverseDepthFirst(
			this,
			node => node.traversal,
			(node, traversal) => {
				node.traversal = traversal;
				node.pending = node.staging ?? node.select();
				node.previous = node.current;
				return node.iterateWithDynamics(
					controller => controller.pending,
					controller => controller.previous ?? controller.pending);
			},
			(cycleNodes, forwardResults: readonly DryRunResult[]): DryRunResult => {
				let needsDispatch = false;
				let hasNewCode = false;
				const forwardUpdates = Array.from(Fn.concat(Fn.map(forwardResults, result => result.invalidated)));
				const invalidated = Array.from(Fn.filter(cycleNodes, node => {
					nextControllers.push(node);
					const nodeHasNewCode = node.previous !== node.pending;
					hasNewCode ||= nodeHasNewCode;
					if (
						nodeHasNewCode ||
						node.current === undefined ||
						isInvalidated(node.current) ||
						!isAccepted(node.current, forwardUpdates)
					) {
						needsDispatch = true;
						return node.current === undefined || !isAcceptedSelf(node.current);
					}
				}));
				const declined = Array.from(Fn.filter(invalidated, node => node.current !== undefined && isDeclined(node.current)));
				const hasDecline = declined.length > 0 || Fn.some(forwardResults, result => result.hasDecline);
				needsDispatch ||= Fn.some(forwardResults, result => result.needsDispatch);
				hasNewCode ||= Fn.some(forwardResults, result => result.hasNewCode);
				return { forwardResults, declined, invalidated, hasDecline, hasNewCode, needsDispatch };
			},
			pendingNodes => {
				for (const node of pendingNodes) {
					node.pending = undefined;
					node.previous = undefined;
				}
			});

		// Rollback routine which undoes the above traversal.
		const rollback = (resetStaging = false) => {
			for (const controller of nextControllers) {
				controller.pending = undefined;
				controller.previous = undefined;
				if (resetStaging) {
					controller.staging = undefined;
				}
			}
		};

		// Check result
		if (!initialResult.needsDispatch) {
			rollback();
			return undefined;
		} else if (initialResult.hasDecline) {
			rollback(true);
			const declined = Array.from(function *traverse(result): Iterable<ReloadableModuleController> {
				// Don't re-traverse shared dependencies
				if (result.hasDecline) {
					yield* result.declined;
					yield* Fn.transform(result.forwardResults, traverse);
				}
			}(initialResult));
			return { type: UpdateStatus.declined, declined };
		} else if (initialResult.invalidated.length > 0) {
			rollback(true);
			// Tracing invalidations is actually pretty cumbersome because we need to compare cyclic
			// groups with the actual import entries to get something parsable by a human.
			using visitIndex = acquireVisitIndex();
			const chain = Array.from(function *traverse(result): Iterable<InvalidationChain> {
				// Don't re-traverse shared dependencies
				if (Fn.some(result.invalidated, node => node.visitIndex === visitIndex.index)) {
					yield {
						modules: result.invalidated,
						next: null,
					};
					return;
				} else {
					for (const node of result.invalidated) {
						node.visitIndex = visitIndex.index;
					}
				}
				const hasDependency = Fn.pipe(
					result.invalidated,
					$$ => Fn.transform($$, controller => controller.select().iterateDependencies()),
					$$ => new Set($$),
					$$ => (controller: ReloadableModuleController) => $$.has(controller));
				const next = Fn.pipe(
					result.forwardResults,
					$$ => Fn.filter($$, result => Fn.some(result.invalidated, hasDependency)),
					$$ => Fn.transform($$, traverse),
					$$ => Array.from($$),
					$$ => {
						if ($$.length === 0) {
							return undefined;
						} else if ($$.every(result => result.next === null)) {
							// Also, skip branches that only include truncated results from the
							// "re-traverse" conditional above.
							return null;
						} else {
							return $$;
						}
					});
				yield {
					modules: result.invalidated,
					next,
				};
			}(initialResult));
			return { type: UpdateStatus.unaccepted, chain };
		}

		// If the update contains new code then we need to make sure it will link. Normally the
		// graph will link and then evaluate, but when dispatching a hot update a module is allowed
		// to invalidate itself. So, we're not really sure which bindings will end up where. This
		// step ensures that a linkage error doesn't cause the whole graph to throw an error.
		if (initialResult.hasNewCode) {
			const instantiated: ReloadableModuleController[] = [];
			try {
				await traverseDepthFirst(
					this,
					node => node.traversal,
					(node, traversal) => {
						node.traversal = traversal;
						return node.iterateWithDynamics(
							controller => controller.pending,
							controller => controller.previous ?? controller.pending);
					},
					(cycleNodes, forwardResults: readonly boolean[]) => maybeThen(function*() {
						let hasUpdate = Fn.some(forwardResults);
						if (!hasUpdate) {
							for (const node of cycleNodes) {
								const pending = node.select(controller => controller.pending);
								if (pending !== node.current) {
									hasUpdate = true;
									break;
								}
							}
						}
						if (hasUpdate) {
							for (const node of cycleNodes) {
								const pending = node.select(controller => controller.pending);
								node.temporary = pending.clone();
								yield node.temporary.instantiate();
								instantiated.push(node);
							}
							for (const node of cycleNodes) {
								const temporary = node.select(controller => controller.temporary);
								yield temporary.link(controller => controller.temporary ?? controller.pending);
							}
						}
						return hasUpdate;
					}));

			} catch (error) {
				rollback();
				return { type: UpdateStatus.linkError, error };

			} finally {
				for (const node of instantiated) {
					node.select(controller => controller.temporary).unlink();
					node.temporary = undefined;
				}
			}
		}

		// Collect previous controllers
		const previousControllers = Array.from(this.traverse());

		// Dispatch link & evaluate
		let dispatchLinkErrorType: UpdateStatus.fatalError | undefined;
		try {
			interface RunResult {
				forwardResults: readonly RunResult[];
				invalidated: readonly ReloadableModuleController[];
				treeDidUpdate: boolean;
			}
			const result = await traverseDepthFirst(
				this,
				node => node.traversal,
				(node, traversal) => {
					node.traversal = traversal;
					return node.iterateWithDynamics(
						controller => controller.pending,
						controller => controller.previous ?? node.pending);
				},
				async (cycleNodes, forwardResults: readonly RunResult[]): Promise<RunResult> => {
					let needsUpdate = false;
					// Check update due to new code
					for (const node of cycleNodes) {
						if (node.staging !== undefined || isInvalidated(node.select())) {
							needsUpdate = true;
							break;
						}
					}
					// Relink and check update due to invalidated dependencies
					const treeDidUpdate = Fn.some(forwardResults, result => result.treeDidUpdate);
					if (treeDidUpdate && !needsUpdate) {
						const forwardUpdates = Array.from(Fn.concat(Fn.map(forwardResults, result => result.invalidated)));
						for (const node of cycleNodes) {
							const current = node.select();
							current.relink();
							if (!await tryAccept(node.select(), forwardUpdates)) {
								needsUpdate = true;
								break;
							}
						}
					}
					if (!needsUpdate) {
						for (const node of cycleNodes) {
							assert.equal(node.current, node.pending);
							node.pending = undefined;
						}
						return { forwardResults, treeDidUpdate, invalidated: [] };
					}
					// These nodes need to be replaced.
					// 1) Instantiate
					for (const node of cycleNodes) {
						const pending = node.select(controller => controller.pending);
						const data = await (async () => {
							try {
								return node.current === undefined ? undefined : await dispose(node.current);
							} catch (error) {
								this.application.log(
									`Caught error in module '%s' during dispose:${EOL}%O`,
									node.url, error);
								dispatchLinkErrorType = UpdateStatus.fatalError;
								throw error;
							}
						})();
						if (node.current === pending) {
							node.current = node.current.clone();
						} else {
							node.current = pending;
						}
						const maybe = node.current.instantiate(data);
						if (maybe) {
							await maybe;
						}
					}
					// 2) Link
					for (const node of cycleNodes) {
						const maybe = node.select().link();
						if (maybe) {
							await maybe;
						}
					}
					// 3) Evaluate
					const maybe = maybeAll(Fn.map(cycleNodes, node => maybeThen(function*() {
						const current = node.select();
						if (node.previous !== undefined && current.declaration === node.previous.declaration) {
							++reevaluations;
						} else {
							++loads;
						}
						try {
							yield current.evaluate();
						} catch (error) {
							const current = node.select();
							assert.ok(current.state.status === ModuleStatus.evaluated);
							if (current.state.evaluationError !== undefined) {
								node.current = node.previous;
							}
							throw error;
						}
						node.pending = undefined;
						if (current === node.staging) {
							node.staging = undefined;
						}
						return undefined;
					})));
					if (maybe) {
						await maybe;
					}

					// Try self-accept
					const invalidated: ReloadableModuleController[] = [];
					for (const node of cycleNodes) {
						if (node.previous !== undefined) {
							const current = node.select();
							const namespace = () => current.moduleNamespace()();
							if (!await tryAcceptSelf(node.previous, namespace)) {
								invalidated.push(node);
							}
						}
					}
					return { forwardResults, invalidated, treeDidUpdate: true };
				});

			if (!result.treeDidUpdate) {
				// Strange that got here since it should have been caught in the precheck traversal.
				return undefined;
			}

		} catch (error) {
			// Re-link everything to ensure consistent internal state. Also, throw away pending
			// instances.
			traverseDepthFirst(
				this,
				node => node.traversal,
				(node, traversal) => {
					node.traversal = traversal;
					if (node.pending !== undefined) {
						node.pending.unlink();
						node.pending = undefined;
					}
					return node.iterateWithDynamics();
				},
				(cycleNodes): undefined => {
					for (const node of cycleNodes) {
						const current = node.select();
						current.relink();
					}
				});
			if (dispatchLinkErrorType === undefined) {
				return { type: UpdateStatus.evaluationFailure, error, stats };
			} else {
				return this.fatalError = { type: dispatchLinkErrorType, error };
			}

		} finally {
			// Dispose old modules
			const currentControllers = new Set(function*(that) {
				for (const node of that.traverse()) {
					assert.ok(node.pending === undefined);
					node.previous = undefined;
					yield node;
				}
			}(this));
			for (const controller of previousControllers) {
				if (!currentControllers.has(controller)) {
					const current = controller.select();
					try {
						await prune(current);
					} catch (error) {
						this.application.log(
							`Caught error in module '%s' during prune:${EOL}%O`,
							controller.url, error);
						// eslint-disable-next-line no-unsafe-finally
						return this.fatalError = { type: UpdateStatus.fatalError, error };
					}
					// Move the instance to staging to setup for `dispatch` in case it's re-imported
					if (controller.staging === undefined) {
						controller.staging = current.clone();
					}
					controller.current = undefined;
					controller.previous = undefined;
				}
			}
		}

		return {
			type: UpdateStatus.success,
			stats,
		};
	}
}
