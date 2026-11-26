import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import ts from 'typescript-eslint';

const directory = dirname(fileURLToPath(import.meta.url));
const workspaces = resolve(directory, '..');
const inside = (parent, target) => {
  const path = relative(parent, target);
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
};
const boundary = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      boundary: 'Use declared public UI dependencies, not "{{source}}".',
    },
  },
  create(context) {
    function check(node, source) {
      const value =
        source?.type === 'TemplateLiteral' && source.expressions.length === 0
          ? source.quasis[0].value.cooked
          : source?.value;
      if (typeof value !== 'string') return;
      let target;
      if (value.startsWith('.') || isAbsolute(value)) {
        target = resolve(
          dirname(context.physicalFilename),
          value.split(/[?#]/)[0],
        );
      } else if (value.startsWith('file:')) {
        try {
          target = fileURLToPath(new URL(value));
        } catch {
          context.report({
            node,
            messageId: 'boundary',
            data: { source: value },
          });
          return;
        }
      }
      const production =
        inside(resolve(directory, 'src'), context.physicalFilename) &&
        !/\.(?:test|stories)\.ts$|\.demo\.vue$/.test(context.physicalFilename);
      if (
        (target && inside(workspaces, target) && !inside(directory, target)) ||
        /^@warmsea\/[^/]+\/(?:src|dist)(?:[/?#]|$)/.test(value) ||
        (production &&
          !target &&
          !/^(?:vue|@warmsea\/ui-vue|@warmsea\/ui-tokens)(?:$|\/style\.css$)/.test(
            value,
          ))
      )
        context.report({
          node,
          messageId: 'boundary',
          data: { source: value },
        });
    }
    return {
      ImportDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => check(node, node.source),
      ExportAllDeclaration: (node) => check(node, node.source),
      ImportExpression: (node) => check(node, node.source),
      TSImportType: (node) => check(node, node.source),
      TSExternalModuleReference: (node) => check(node, node.expression),
      'CallExpression[callee.name="require"]': (node) =>
        check(node, node.arguments[0]),
    };
  },
};
export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.artifacts/**'] },
  ...ts.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,vue}'],
  })),
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.{js,mjs,cjs,ts,vue}'],
    plugins: { ownership: { rules: { boundary } } },
    rules: { 'ownership/boundary': 'error' },
  },
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: ts.parser } },
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  prettier,
];
