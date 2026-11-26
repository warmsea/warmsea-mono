import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import ts from 'typescript-eslint';

const directory = dirname(fileURLToPath(import.meta.url));
const workspaces = resolve(directory, '..');
const isInside = (parent, target) => {
  const path = relative(parent, target);
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
};
const tokenSourceImports = new Map([
  ['docs/token-reference.ts', '../../ui-tokens/src/index.css?raw'],
  ['.storybook/preview.ts', '../../ui-tokens/src/index.css'],
]);

const noCrossPackageImports = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      boundary:
        'Use the owning package public exports instead of cross-package import "{{source}}".',
      invalidFileURL: 'Import "{{source}}" is not a valid file URL.',
    },
  },
  create(context) {
    function check(node, source) {
      const value =
        source?.type === 'TemplateLiteral' && source.expressions.length === 0
          ? source.quasis[0].value.cooked
          : source?.value;
      if (typeof value !== 'string') return;
      const filename = relative(directory, context.physicalFilename)
        .split(sep)
        .join('/');
      if (tokenSourceImports.get(filename) === value) return;

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
            messageId: 'invalidFileURL',
            data: { source: value },
          });
          return;
        }
      }

      if (
        /^@warmsea\/ui-ai(?:[/?#]|$)/.test(value) ||
        /^@warmsea\/[^/]+\/(?:src|dist)(?:[/?#]|$)/.test(value) ||
        (target && isInside(workspaces, target) && !isInside(directory, target))
      ) {
        context.report({
          node,
          messageId: 'boundary',
          data: { source: value },
        });
      }
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
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/storybook-static/**',
      '**/.artifacts/**',
    ],
  },
  ...ts.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,vue}'],
  })),
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.{js,mjs,cjs,ts,vue}'],
    plugins: {
      ownership: {
        rules: { 'no-cross-package-imports': noCrossPackageImports },
      },
    },
    rules: { 'ownership/no-cross-package-imports': 'error' },
  },
  {
    files: ['**/*.mjs'],
    rules: {
      'no-unused-vars': 'error',
      'no-constant-condition': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: ts.parser } },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  prettier,
];
