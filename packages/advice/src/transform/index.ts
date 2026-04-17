import type { PluginObj, PluginPass, NodePath } from "@babel/core"
import type * as BabelTypes from "@babel/types"

interface AdvicePluginOptions {
  root?: string
}

interface AdvicePluginState extends PluginPass {
  moduleId: string
  needsImport: boolean
}

function isReactRefreshHelperName(name: string): boolean {
  return name === "$RefreshReg$" || name === "$RefreshSig$"
}

function isTopLevel(path: NodePath<any>): boolean {
  let current = path.parentPath
  while (current) {
    if (current.isFunction() || current.isClassBody()) return false
    if (current.isProgram()) return true
    if (current.isExportNamedDeclaration() || current.isExportDefaultDeclaration()) {
      current = current.parentPath
      continue
    }
    current = current.parentPath
  }
  return true
}

export default function zenbuAdviceTransform(
  { types: t }: { types: typeof BabelTypes },
  options: AdvicePluginOptions = {}
): PluginObj<AdvicePluginState> {
  const root = options.root ?? process.cwd()

  function makeModuleId(filename: string | undefined | null): string {
    if (!filename) return "unknown"
    const normalized = filename.replace(/\\/g, "/")
    const rootNormalized = root.replace(/\\/g, "/").replace(/\/$/, "")
    if (normalized.startsWith(rootNormalized + "/")) {
      return normalized.slice(rootNormalized.length + 1)
    }
    return normalized
  }

  function defCall(state: AdvicePluginState, name: string, fn: BabelTypes.Expression): BabelTypes.ExpressionStatement {
    state.needsImport = true
    return t.expressionStatement(
      t.callExpression(t.identifier("__zenbu_def"), [
        t.stringLiteral(state.moduleId),
        t.stringLiteral(name),
        fn,
      ])
    )
  }

  function refCall(state: AdvicePluginState, name: string): BabelTypes.CallExpression {
    state.needsImport = true
    return t.callExpression(t.identifier("__zenbu_ref"), [
      t.stringLiteral(state.moduleId),
      t.stringLiteral(name),
    ])
  }

  return {
    name: "zenbu-advice",
    visitor: {
      Program: {
        enter(path: NodePath<BabelTypes.Program>, state: AdvicePluginState) {
          state.moduleId = makeModuleId(state.filename)
          state.needsImport = false
        },
        exit(path: NodePath<BabelTypes.Program>, state: AdvicePluginState) {
          if (!state.needsImport) return
          const importDecl = t.importDeclaration(
            [
              t.importSpecifier(t.identifier("__zenbu_def"), t.identifier("__def")),
              t.importSpecifier(t.identifier("__zenbu_ref"), t.identifier("__ref")),
            ],
            t.stringLiteral("@zenbu/advice/runtime")
          )
          path.unshiftContainer("body", importDecl)
        },
      },

      FunctionDeclaration(path: NodePath<BabelTypes.FunctionDeclaration>, state: AdvicePluginState) {
        if (!path.node.id) return
        if (path.parentPath.isExportDefaultDeclaration()) return
        if ((path.node as any)._zenbuGenerated) return
        if (!isTopLevel(path)) return

        const name = path.node.id.name
        if (isReactRefreshHelperName(name)) return
        const fnExpr = t.functionExpression(
          null,
          path.node.params,
          path.node.body,
          path.node.generator,
          path.node.async
        )

        const def = defCall(state, name, fnExpr)
        const isComponent = /^[A-Z]/.test(name)

        if (isComponent) {
          const wrapperFn = t.functionDeclaration(
            t.identifier(name),
            [t.restElement(t.identifier("__args"))],
            t.blockStatement([
              t.returnStatement(
                t.callExpression(
                  t.memberExpression(refCall(state, name), t.identifier("apply")),
                  [t.thisExpression(), t.identifier("__args")]
                )
              ),
            ])
          );
          (wrapperFn as any)._zenbuGenerated = true

          if (path.parentPath.isExportNamedDeclaration()) {
            path.parentPath.replaceWithMultiple([def, t.exportNamedDeclaration(wrapperFn, [])])
          } else {
            path.replaceWithMultiple([def, wrapperFn])
          }
        } else {
          const varDecl = t.variableDeclaration("const", [
            t.variableDeclarator(t.identifier(name), refCall(state, name)),
          ])

          if (path.parentPath.isExportNamedDeclaration()) {
            path.parentPath.replaceWithMultiple([def, t.exportNamedDeclaration(varDecl, [])])
          } else {
            path.replaceWithMultiple([def, varDecl])
          }
        }
      },

      ExportDefaultDeclaration(path: NodePath<BabelTypes.ExportDefaultDeclaration>, state: AdvicePluginState) {
        const decl = path.node.declaration
        if (!t.isFunctionDeclaration(decl)) return
        if ((decl as any)._zenbuGenerated) return

        const name = decl.id?.name ?? "default"
        const fnExpr = t.functionExpression(
          null,
          decl.params,
          decl.body,
          decl.generator,
          decl.async
        )

        const def = defCall(state, name, fnExpr)
        const isComponent = /^[A-Z]/.test(name)

        if (isComponent && name !== "default") {
          const wrapperFn = t.functionDeclaration(
            t.identifier(name),
            [t.restElement(t.identifier("__args"))],
            t.blockStatement([
              t.returnStatement(
                t.callExpression(
                  t.memberExpression(refCall(state, name), t.identifier("apply")),
                  [t.thisExpression(), t.identifier("__args")]
                )
              ),
            ])
          );
          (wrapperFn as any)._zenbuGenerated = true
          path.replaceWithMultiple([def, t.exportDefaultDeclaration(wrapperFn)])
        } else {
          const varDecl = t.variableDeclaration("const", [
            t.variableDeclarator(t.identifier("__zenbu_default"), refCall(state, name)),
          ])
          path.replaceWithMultiple([def, varDecl, t.exportDefaultDeclaration(t.identifier("__zenbu_default"))])
        }
      },

      VariableDeclarator(path: NodePath<BabelTypes.VariableDeclarator>, state: AdvicePluginState) {
        if (!t.isIdentifier(path.node.id)) return
        if (isReactRefreshHelperName(path.node.id.name)) return
        const init = path.node.init
        if (!init) return
        if (!t.isArrowFunctionExpression(init) && !t.isFunctionExpression(init)) return

        const parentPath = path.parentPath
        if (!parentPath.isVariableDeclaration()) return
        if (parentPath.node.declarations.length !== 1) return
        if (!isTopLevel(parentPath)) return

        const name = path.node.id.name
        const def = defCall(state, name, init)
        const newDeclarator = t.variableDeclarator(
          t.identifier(name),
          refCall(state, name)
        )

        const grandParent = parentPath.parentPath
        if (grandParent && grandParent.isExportNamedDeclaration()) {
          const newVarDecl = t.variableDeclaration(parentPath.node.kind, [newDeclarator])
          grandParent.replaceWithMultiple([
            def,
            t.exportNamedDeclaration(newVarDecl, []),
          ])
        } else {
          const newVarDecl = t.variableDeclaration(parentPath.node.kind, [newDeclarator])
          parentPath.replaceWithMultiple([def, newVarDecl])
        }
      },
    },
  }
}
