import tseslint from 'typescript-eslint';
export default [
  { ignores: ['dist/**', '.artifacts/**'] },
  ...tseslint.configs.recommended,
];
