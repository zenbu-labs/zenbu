import type { MaybePromise, NotPromiseLike } from "./utility.js";
import * as assert from "node:assert/strict";
import { mappedNumericComparator } from "@braidai/lang/comparator";
import { Fn } from "@braidai/lang/functional";

interface TraversalState<Result = unknown> {
	readonly state: CyclicState<Result>;
	visitIndex: number;
}

interface CyclicState<Result> {
	readonly index: number;
	ancestorIndex: number;
	order: number;
	forwardResults: Completion<readonly Collectable<Result>[]> | undefined;
	result: Completion<Collectable<Result>> | undefined;
}

type Completion<Type extends NotPromiseLike> = CompletionSync<Type> | CompletionAsync<Type>;

interface CompletionSync<Type extends NotPromiseLike> {
	readonly sync: true;
	readonly resolution: Type;
}

interface CompletionAsync<Type> {
	readonly sync: false;
	readonly promise: PromiseLike<Type>;
}

interface Collectable<Type> {
	readonly value: Type;
	collectionIndex: number;
}

interface VisitIndex extends Disposable {
	readonly index: number;
}

/** @internal */
export const makeAcquireVisitIndex = function() {
	return () => {
		let lock = false;
		let currentIndex = 0;
		return (): VisitIndex => {
			assert.ok(!lock);
			lock = true;
			const index = ++currentIndex;
			return {
				index,
				[Symbol.dispose]() {
					assert.ok(lock);
					assert.equal(currentIndex, index);
					lock = false;
				},
			};
		};
	};
}();

/** @internal */
export function makeTraversalState<Result>(visitIndex = -1, state?: CyclicState<Result>): TraversalState<Result> {
	return {
		visitIndex,
		state: state!,
	};
}

const acquireVisitIndex = makeAcquireVisitIndex();

/**
 * This is a generalized version of the depth-first algorithm in `16.2.1.5.2 Link()` and
 * `16.2.1.5.3 Evaluate()`. I'm not actually sure the async semantics are identical, though.
 * @internal
 */
export function traverseDepthFirst<
	Node,
	Result extends NotPromiseLike,
	Join extends MaybePromise<Result>,
>(
	root: Node,
	peek: (node: Node) => TraversalState,
	begin: (node: Node, state: TraversalState) => Iterable<Node>,
	join: (nodes: readonly Node[], forwardResults: Result[]) => Join,
	unwind?: (nodes: readonly Node[]) => void,
): Join {
	const expect = (node: Node) => {
		const state = peek(node);
		assert.ok(state.visitIndex === visitIndex.index);
		return state as TraversalState<Result>;
	};
	const inner = (node: Node): CyclicState<Result> => {
		// Initialize and add to stack
		const nodeIndex = index++;
		const holder = makeTraversalState<Result>(visitIndex.index, {
			index: nodeIndex,
			ancestorIndex: nodeIndex,
			order,
			forwardResults: undefined,
			result: undefined,
		});
		const { state } = holder;
		const stackIndex = stack.length;
		stack.push(node);
		// Collect forward results
		let hasPromise = false as boolean;
		const forwardResultsMaybePromise = Array.from(Fn.transform(begin(node, holder), function*(child) {
			const holder = peek(child) as TraversalState<Result>;
			const childState = holder.visitIndex === visitIndex.index ? holder.state : inner(child);
			const { result } = childState;
			if (result === undefined) {
				state.ancestorIndex = Math.min(state.ancestorIndex, childState.ancestorIndex);
			} else if (result.sync) {
				yield result.resolution;
			} else {
				hasPromise = true;
				yield result.promise;
				// nb: If we have a sibling which throws synchronously then this result is never
				// collected into `Promise.all`. Therefore this promise is never awaited and a
				// rejection will take down the process. It is explicitly marked as handled here.
				result.promise.then(() => {}, () => {});
			}
		}));
		// Detect promise or sync
		state.forwardResults = function() {
			if (hasPromise) {
				return {
					sync: false,
					promise: Promise.all(forwardResultsMaybePromise),
				};
			} else {
				return {
					sync: true,
					resolution: forwardResultsMaybePromise as Collectable<Result>[],
				};
			}
		}();
		// Join cyclic nodes
		assert.ok(state.ancestorIndex <= state.index);
		state.order = ++order;
		if (state.ancestorIndex === state.index) {
			const cycleNodes = stack.splice(stackIndex);
			cycleNodes.sort(mappedNumericComparator(node => peek(node).state.order));
			// Collect forward results from cycle nodes
			let hasPromise = false as boolean;
			const cyclicForwardResults = cycleNodes.map(node => {
				const { state: { forwardResults } } = expect(node);
				assert.ok(forwardResults !== undefined);
				if (forwardResults.sync) {
					return forwardResults.resolution;
				} else {
					hasPromise = true;
					return forwardResults.promise;
				}
			});
			// Await completion of forward results of all cycle members
			const result: Completion<Collectable<Result>> = function() {
				if (hasPromise) {
					return {
						sync: false,
						promise: async function() {
							let forwardResults: Result[];
							try {
								forwardResults = collect(nodeIndex, await Promise.all(cyclicForwardResults));
							} catch (error) {
								unwind?.(cycleNodes);
								throw error;
							}
							let result: Result;
							const maybePromise = join(cycleNodes, forwardResults);
							if (typeof maybePromise?.then === "function") {
								result = await maybePromise as Result;
							} else {
								result = maybePromise as Result;
							}
							return {
								collectionIndex: -1,
								value: result,
							};
						}(),
					};
				} else {
					type AsTyped = Iterable<PromiseLike<Iterable<Collectable<Result>>> | Iterable<Collectable<Result>>>;
					type Narrowed = Iterable<Iterable<Collectable<Result>>>;
					const forwardResults = collect(nodeIndex, cyclicForwardResults satisfies AsTyped as Narrowed);
					const result = join(cycleNodes, forwardResults);
					if (typeof result?.then === "function") {
						return {
							sync: false,
							promise: async function() {
								return {
									collectionIndex: -1,
									value: await result as Result,
								};
							}(),
						};
					} else {
						return {
							sync: true,
							resolution: {
								collectionIndex: -1,
								value: result as Result,
							},
						};
					}
				}
			}();
			// Assign state to all cycle members
			for (const node of cycleNodes) {
				const childState = expect(node).state;
				assert.equal(childState.result, undefined);
				childState.result = result;
			}
		}
		return state;
	};

	using visitIndex = acquireVisitIndex();
	let index = 0;
	let order = 0;
	const stack: Node[] = [];
	try {
		const { result } = inner(root);
		assert.ok(result !== undefined);
		if (result.sync) {
			return result.resolution.value as Join;
		} else {
			return result.promise.then(({ value }) => value) as Join;
		}
	} catch (error) {
		unwind?.(stack);
		throw error;
	}
}

function collect<
	Type,
>(
	collectionIndex: number,
	forwardResultVectors: Iterable<Iterable<Collectable<Type>>>,
) {
	return Fn.pipe(
		forwardResultVectors,
		$$ => Fn.concat($$),
		$$ => Fn.reject($$, result => result.collectionIndex === collectionIndex),
		$$ => Fn.map($$, result => {
			result.collectionIndex = collectionIndex;
			return result.value;
		}),
		$$ => [ ...$$ ]);
}
