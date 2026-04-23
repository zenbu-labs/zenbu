const isCapitalized = (name) =>
  typeof name === "string" && /^[A-Z]/.test(name)

const COMPONENT_WRAPPERS = new Set([
  "memo",
  "forwardRef",
  "observer",
  "React.memo",
  "React.forwardRef",
])

function callExpressionName(node) {
  if (node.type !== "CallExpression") return null
  const callee = node.callee
  if (callee.type === "Identifier") return callee.name
  if (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.property.type === "Identifier"
  ) {
    return `${callee.object.name}.${callee.property.name}`
  }
  return null
}

function containsJsx(node) {
  if (!node) return false
  if (node.type === "JSXElement" || node.type === "JSXFragment") return true
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue
    const value = node[key]
    if (!value) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item.type === "string" && containsJsx(item)) {
          return true
        }
      }
    } else if (typeof value === "object" && typeof value.type === "string") {
      if (containsJsx(value)) return true
    }
  }
  return false
}

function unwrapComponent(node) {
  if (!node) return null
  if (node.type === "CallExpression") {
    const name = callExpressionName(node)
    if (name && COMPONENT_WRAPPERS.has(name) && node.arguments.length > 0) {
      return unwrapComponent(node.arguments[0])
    }
  }
  return node
}

function isComponentValue(node) {
  const inner = unwrapComponent(node)
  if (!inner) return false
  if (
    inner.type === "FunctionDeclaration" ||
    inner.type === "FunctionExpression" ||
    inner.type === "ArrowFunctionExpression"
  ) {
    return containsJsx(inner.body)
  }
  return false
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow multiple React component exports in the same file",
    },
    schema: [],
    messages: {
      tooMany:
        "File exports multiple React components ({{names}}). Split them into separate files — one component export per file.",
    },
  },
  create(context) {
    const components = []

    function record(name, reportNode) {
      components.push({ name: name ?? "<default>", node: reportNode })
    }

    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration
        if (!decl) return
        if (
          decl.type === "FunctionDeclaration" &&
          decl.id &&
          isCapitalized(decl.id.name) &&
          containsJsx(decl.body)
        ) {
          record(decl.id.name, decl)
          return
        }
        if (decl.type === "VariableDeclaration") {
          for (const declarator of decl.declarations) {
            if (
              declarator.id.type === "Identifier" &&
              isCapitalized(declarator.id.name) &&
              isComponentValue(declarator.init)
            ) {
              record(declarator.id.name, declarator)
            }
          }
        }
      },
      ExportDefaultDeclaration(node) {
        const decl = node.declaration
        if (!decl) return
        if (
          decl.type === "FunctionDeclaration" ||
          decl.type === "FunctionExpression" ||
          decl.type === "ArrowFunctionExpression"
        ) {
          if (containsJsx(decl.body)) {
            const name =
              decl.type === "FunctionDeclaration" && decl.id
                ? decl.id.name
                : null
            record(name, node)
          }
          return
        }
        if (decl.type === "CallExpression") {
          if (isComponentValue(decl)) record(null, node)
          return
        }
        if (decl.type === "Identifier" && isCapitalized(decl.name)) {
          const scope = context.sourceCode.getScope(node)
          const variable = scope.variables.find((v) => v.name === decl.name)
          if (variable) {
            for (const def of variable.defs) {
              const defNode = def.node
              if (
                defNode.type === "FunctionDeclaration" &&
                containsJsx(defNode.body)
              ) {
                record(decl.name, node)
                return
              }
              if (
                defNode.type === "VariableDeclarator" &&
                isComponentValue(defNode.init)
              ) {
                record(decl.name, node)
                return
              }
            }
          }
        }
      },
      "Program:exit"() {
        if (components.length <= 1) return
        const names = components.map((c) => c.name).join(", ")
        for (const extra of components.slice(1)) {
          context.report({
            node: extra.node,
            messageId: "tooMany",
            data: { names },
          })
        }
      },
    }
  },
}
