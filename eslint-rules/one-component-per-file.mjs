const COMPONENT_NAME = /^[A-Z]/;

function isFunctionNode(node) {
  return node?.type === "ArrowFunctionExpression"
    || node?.type === "FunctionDeclaration"
    || node?.type === "FunctionExpression";
}

function containsOwnJsx(node) {
  let found = false;

  function visit(current, root) {
    if (!current || found) return;
    if (
      current.type === "JSXElement"
      || current.type === "JSXFragment"
      || current.type === "JSXSelfClosingElement"
    ) {
      found = true;
      return;
    }
    if (current !== root && isFunctionNode(current)) return;
    for (const key of Object.keys(current)) {
      if (key === "parent") continue;
      const value = current[key];
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child?.type) visit(child, root);
        }
      } else if (value?.type) {
        visit(value, root);
      }
    }
  }

  visit(node, node);
  return found;
}

function wrappedFunction(node) {
  if (isFunctionNode(node)) return node;
  if (node?.type !== "CallExpression") return undefined;
  return node.arguments.find((argument) => isFunctionNode(argument));
}

function classRendersJsx(node) {
  return node.body.body.some((member) => (
    member.type === "MethodDefinition"
    && member.key?.type === "Identifier"
    && member.key.name === "render"
    && member.value
    && containsOwnJsx(member.value)
  ));
}

function componentDefinition(node) {
  if (node.type === "FunctionDeclaration") {
    if (!node.id || !COMPONENT_NAME.test(node.id.name) || !containsOwnJsx(node)) return undefined;
    return { functionNode: node, name: node.id.name, node };
  }

  if (node.type === "VariableDeclarator" && node.id.type === "Identifier" && COMPONENT_NAME.test(node.id.name)) {
    const functionNode = wrappedFunction(node.init);
    if (!functionNode || !containsOwnJsx(functionNode)) return undefined;
    return { functionNode, name: node.id.name, node };
  }

  if (node.type === "ClassDeclaration") {
    if (!node.id || !COMPONENT_NAME.test(node.id.name) || !classRendersJsx(node)) return undefined;
    return { functionNode: node, name: node.id.name, node };
  }

  if (node.type === "ExportDefaultDeclaration") {
    const functionNode = wrappedFunction(node.declaration);
    if (!functionNode || !containsOwnJsx(functionNode)) return undefined;
    return { functionNode, name: functionNode.id?.name ?? "default component", node };
  }

  return undefined;
}

function encloses(outer, inner) {
  return outer.range[0] < inner.range[0] && outer.range[1] > inner.range[1];
}

export const oneComponentPerFile = {
  meta: {
    type: "problem",
    docs: {
      description: "Require every React component to live in its own file.",
    },
    messages: {
      multiple: "Move '{{name}}' to its own file. This file already defines '{{first}}'.",
      nested: "Move '{{name}}' to its own file. Components cannot be declared inside another component.",
    },
    schema: [],
  },
  create(context) {
    const definitions = [];
    const collect = (node) => {
      const definition = componentDefinition(node);
      if (definition && !definitions.some((candidate) => candidate.functionNode === definition.functionNode)) {
        definitions.push(definition);
      }
    };

    return {
      ClassDeclaration: collect,
      ExportDefaultDeclaration: collect,
      FunctionDeclaration: collect,
      VariableDeclarator: collect,
      "Program:exit"() {
        definitions.sort((left, right) => left.node.range[0] - right.node.range[0]);
        const first = definitions[0];
        if (!first) return;

        for (const definition of definitions) {
          const parentComponent = definitions.find((candidate) => (
            candidate !== definition && encloses(candidate.functionNode, definition.node)
          ));
          if (parentComponent) {
            context.report({
              data: { name: definition.name },
              messageId: "nested",
              node: definition.node,
            });
          } else if (definition !== first) {
            context.report({
              data: { first: first.name, name: definition.name },
              messageId: "multiple",
              node: definition.node,
            });
          }
        }
      },
    };
  },
};

export default {
  rules: {
    "one-component-per-file": oneComponentPerFile,
  },
};
