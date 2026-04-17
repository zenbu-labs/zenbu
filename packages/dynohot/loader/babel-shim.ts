import type { types as t } from "@babel/core";
import type { Node, Scope, TraverseOptions } from "@babel/traverse";
import _generate from "@babel/generator";
import _traverse, { Hub, NodePath } from "@babel/traverse";

/** @internal */
export function makeRootPath(file: t.File) {
	const hub = new Hub();
	const path = NodePath.get({
		hub,
		parentPath: null,
		parent: file,
		container: file,
		key: "program",
	});
	path.setContext();
	return path;
}

/** @internal */
export const generate = _generate.default;

/** @internal */
export const traverse: <State>(
	parent: Node,
	opts: TraverseOptions<State>,
	scope: Scope | undefined,
	state: State,
	parentPath?: NodePath
) => void = _traverse.default;
