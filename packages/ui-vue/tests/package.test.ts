// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const {
  checkArchive,
  checkDeclarations,
  checkRuntimeExports,
  checkTokenReferences,
  createConsumer,
  checkConsumerRuntime,
} = await import(new URL('./package/check.mjs', import.meta.url).href);

function tokenArchive() {
  return new Map([
    [
      'package/package.json',
      JSON.stringify({
        name: '@warmsea/ui-tokens',
        version: '0.1.0',
        type: 'module',
        sideEffects: ['**/*.css'],
        exports: { './style.css': './dist/style.css' },
      }),
    ],
    ['package/README.md', 'Token package'],
    ['package/dist/style.css', ':root { --wui-color-primary: #0f766e; }'],
  ]);
}

function vueArchive() {
  return new Map([
    [
      'package/package.json',
      JSON.stringify({
        name: '@warmsea/ui-vue',
        version: '0.1.0',
        type: 'module',
        sideEffects: ['**/*.css'],
        main: './dist/index.js',
        module: './dist/index.js',
        types: './dist/index.d.ts',
        exports: {
          '.': { types: './dist/index.d.ts', import: './dist/index.js' },
          './style.css': './dist/style.css',
        },
        dependencies: { '@warmsea/ui-tokens': '^0.1.0' },
        peerDependencies: { vue: '^3.5.0' },
      }),
    ],
    ['package/README.md', 'Vue package'],
    ['package/dist/index.js', 'import { defineComponent } from "vue";'],
    ['package/dist/index.d.ts', 'export interface ButtonProps {}'],
    [
      'package/dist/style.css',
      '.wui-menu{} .wui-dialog{} .wui-textarea{} .wui-input{} .wui-select{} .wui-app-bar{} .wui-app-bar__link{} .wui-app-bar__icon{} .wui-app-bar__group--bottom{} .wui-tooltip{} .wui-tooltip__content{} ' +
        '.wui-button--primary{} .wui-button--default{} .wui-button--outlined{} .wui-button--subtle{} ' +
        [1, 2, 3, 4, 5, 6]
          .map((level) => `.wui-heading--${level}{}`)
          .join(' ') +
        ['regular', 'semibold']
          .map((modifier) => `.wui-text--${modifier}{}`)
          .join(' '),
    ],
  ]);
}

describe('packed artifacts', () => {
  it('rejects removed component artifacts and styles', () => {
    const files = vueArchive();
    files.set(
      'package/dist/components/combobox/Combobox.vue.d.ts',
      'export interface ComboboxProps {}',
    );
    expect(() => checkArchive(files, '@warmsea/ui-vue', '0.1.0')).toThrow();
    files.delete('package/dist/components/combobox/Combobox.vue.d.ts');
    files.set(
      'package/dist/style.css',
      `${files.get('package/dist/style.css')} .wui-combobox{}`,
    );
    expect(() => checkArchive(files, '@warmsea/ui-vue', '0.1.0')).toThrow();
    const inputFiles = vueArchive();
    inputFiles.set(
      'package/dist/style.css',
      `${inputFiles.get('package/dist/style.css')} .wui-input__adornment{}`,
    );
    expect(() =>
      checkArchive(inputFiles, '@warmsea/ui-vue', '0.1.0'),
    ).toThrow();
  });

  it('requires exactly the public runtime components', () => {
    const library = {
      Menu: {},
      AppBar: {},
      Button: {},
      Dialog: {},
      Heading: {},
      Input: {},
      Select: {},
      Text: {},
      Textarea: {},
      Tooltip: {},
    };
    expect(() => checkRuntimeExports(library)).not.toThrow();
    for (const name of Object.keys(library)) {
      expect(() =>
        checkRuntimeExports(
          Object.fromEntries(
            Object.entries(library).filter(([key]) => key !== name),
          ),
        ),
      ).toThrow();
      expect(() =>
        checkRuntimeExports({ ...library, [name]: 'invalid' }),
      ).toThrow();
    }
    expect(() => checkRuntimeExports({ ...library, Extra: {} })).toThrow();
  });

  it.each([
    '.wui-button--primary{}',
    '.wui-button--default{}',
    '.wui-button--outlined{}',
    '.wui-button--subtle{}',
    '.wui-app-bar{}',
    '.wui-app-bar__link{}',
    '.wui-app-bar__icon{}',
    '.wui-app-bar__group--bottom{}',
    '.wui-tooltip{}',
    '.wui-tooltip__content{}',
    '.wui-select{}',
    '.wui-input{}',
    '.wui-dialog{}',
    '.wui-menu{}',
    '.wui-textarea{}',
    '.wui-heading--6{}',
    '.wui-text--regular{}',
    '.wui-text--semibold{}',
  ])('rejects missing shipped component styles: %s', (rule) => {
    const files = vueArchive();
    files.set(
      'package/dist/style.css',
      files.get('package/dist/style.css')!.replace(rule, ''),
    );
    expect(() => checkArchive(files, '@warmsea/ui-vue', '0.1.0')).toThrow();
  });

  it('accepts the documented token and Vue package contracts', () => {
    expect(checkArchive(tokenArchive(), '@warmsea/ui-tokens').version).toBe(
      '0.1.0',
    );
    expect(checkArchive(vueArchive(), '@warmsea/ui-vue', '0.1.0').name).toBe(
      '@warmsea/ui-vue',
    );
  });

  it.each([
    'package/dist/index.js',
    'package/dist/index.d.ts',
    'package/dist/style.css',
    'package/README.md',
  ])('rejects a missing shipped file: %s', (path) => {
    const files = vueArchive();
    files.delete(path);
    expect(() => checkArchive(files, '@warmsea/ui-vue', '0.1.0')).toThrow(
      'missing or empty',
    );
  });

  it.each([
    'package/src/Button.vue',
    'package/dist/Button.stories.js',
    'package/dist/Button.test.d.ts',
    'package/dist/index.d.ts.map',
    'package/dist/components/button/Button.vue.d.ts.map',
  ])('rejects development files in the tarball: %s', (path) => {
    const files = vueArchive();
    files.set(path, 'development-only');
    expect(() => checkArchive(files, '@warmsea/ui-vue', '0.1.0')).toThrow();
  });

  it('rejects declaration references to unshipped source maps', () => {
    const files = vueArchive();
    files.set(
      'package/dist/index.d.ts',
      `${files.get('package/dist/index.d.ts')}\n//# sourceMappingURL=index.d.ts.map`,
    );
    expect(() => checkArchive(files, '@warmsea/ui-vue', '0.1.0')).toThrow();
  });

  it.each([
    { exports: { '.': './src/index.ts' } },
    { types: './src/index.ts' },
    { sideEffects: false },
    { dependencies: { '@warmsea/ui-tokens': 'workspace:^' } },
    { dependencies: { '@warmsea/ui-tokens': '^0.1.0', vue: '^3.5.0' } },
    { peerDependencies: {} },
  ])('rejects broken package metadata: %j', (change) => {
    const files = vueArchive();
    files.set(
      'package/package.json',
      JSON.stringify({
        ...JSON.parse(files.get('package/package.json')!),
        ...change,
      }),
    );
    expect(() => checkArchive(files, '@warmsea/ui-vue', '0.1.0')).toThrow();
  });

  it('checks the actual packed token version rather than a fixed dependency', () => {
    expect(() =>
      checkArchive(vueArchive(), '@warmsea/ui-vue', '0.2.0'),
    ).toThrow();
  });

  it('requires the built JavaScript to externalize Vue', () => {
    const files = vueArchive();
    files.set('package/dist/index.js', 'export const Button = {};');
    expect(() => checkArchive(files, '@warmsea/ui-vue', '0.1.0')).toThrow();
  });

  it('rejects an embedded default theme in the component CSS', () => {
    const files = vueArchive();
    files.set(
      'package/dist/style.css',
      `${files.get('package/dist/style.css')} :root { --wui-color-primary: #0f766e; }`,
    );
    expect(() => checkArchive(files, '@warmsea/ui-vue', '0.1.0')).toThrow();
  });

  it('rejects unresolved component imports in the shipped stylesheet', () => {
    const files = vueArchive();
    files.set(
      'package/dist/style.css',
      `@import './components/button/Button.css';\n${files.get('package/dist/style.css')}`,
    );
    expect(() => checkArchive(files, '@warmsea/ui-vue', '0.1.0')).toThrow(
      'must inline all component styles',
    );
  });

  it('rejects scoped component selectors in the shipped stylesheet', () => {
    const files = vueArchive();
    files.set(
      'package/dist/style.css',
      files
        .get('package/dist/style.css')!
        .replace(
          '.wui-button--primary{}',
          '.wui-button--primary[data-v-123abc]{}',
        ),
    );
    expect(() => checkArchive(files, '@warmsea/ui-vue', '0.1.0')).toThrow(
      'must remain unscoped',
    );
  });

  it('requires the token CSS artifact', () => {
    const files = tokenArchive();
    files.delete('package/dist/style.css');
    expect(() => checkArchive(files, '@warmsea/ui-tokens')).toThrow();
  });
});

describe('packed token references', () => {
  const tokenCss = ':root { --wui-color-text: #262626; }';

  it('accepts exported tokens, local aliases and nested fallbacks', () => {
    expect(() =>
      checkTokenReferences(
        tokenCss,
        '.component { --wui-local-color: var(--wui-color-text); color: var(--wui-local-color, var(--wui-color-text)); }',
        '',
      ),
    ).not.toThrow();
  });

  it.each([
    'var(--wui-color-missing)',
    'var(--wui-color-missing, black)',
    'var(--wui-color-text, var(--wui-color-missing))',
    'var(--wui-tooltip-missing, 100vi)',
  ])('rejects undeclared references, including fallbacks: %s', (value) => {
    expect(() =>
      checkTokenReferences(tokenCss, `.component { color: ${value}; }`, ''),
    ).toThrow(/is not exported/);
  });

  it('accepts only known runtime properties present in the packed JavaScript', () => {
    const componentCss =
      '.component { max-width: var(--wui-tooltip-available-width, 100vi); padding: var(--wui-tooltip-bridge); }';
    const library = `
setStyle(surface, '--wui-tooltip-available-width', '320px');
setStyle(surface, "--wui-tooltip-bridge", '9px');`;
    expect(() =>
      checkTokenReferences(tokenCss, componentCss, library),
    ).not.toThrow();
    expect(() => checkTokenReferences(tokenCss, componentCss, '')).toThrow(
      /--wui-tooltip-available-width/,
    );
  });
});

describe('packed consumer resolution', () => {
  let directory: string | undefined;
  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
    directory = undefined;
  });

  async function consumer() {
    const artifacts = fileURLToPath(
      new URL('../.artifacts/package/', import.meta.url),
    );
    await mkdir(artifacts, { recursive: true });
    directory = await mkdtemp(join(artifacts, 'consumer-'));
    const vue = vueArchive();
    vue.set(
      'package/dist/index.js',
      'export const Menu = {}, AppBar = {}, Button = {}, Dialog = {}, Heading = {}, Input = {}, Select = {}, Text = {}, Textarea = {}, Tooltip = {};',
    );
    await createConsumer(directory, tokenArchive());
    await createConsumer(directory, vue);
    return {
      directory,
      vue: JSON.parse(vue.get('package/package.json')!),
      tokens: JSON.parse(tokenArchive().get('package/package.json')!),
    };
  }

  it('consumes JS and both CSS exports from the extracted packages', async () => {
    const fixture = await consumer();
    await expect(
      checkConsumerRuntime(fixture.directory, fixture.vue, fixture.tokens),
    ).resolves.toBeUndefined();
  });

  it('rejects a retargeted types export rather than compiling the expected file directly', async () => {
    const fixture = await consumer();
    const packed = join(
      fixture.directory,
      'node_modules',
      '@warmsea',
      'ui-vue',
    );
    await writeFile(join(packed, 'dist', 'other.d.ts'), 'export {};');
    await writeFile(
      join(packed, 'package.json'),
      JSON.stringify({
        ...fixture.vue,
        exports: {
          ...fixture.vue.exports,
          '.': { ...fixture.vue.exports['.'], types: './dist/other.d.ts' },
        },
      }),
    );
    expect(() =>
      checkDeclarations(join(packed, 'dist', 'index.d.ts'), {
        consumerDirectory: fixture.directory,
        moduleSpecifier: '@warmsea/ui-vue',
      }),
    ).toThrow(/Types resolved outside the packed target/);
  });

  it.each([
    [
      '@warmsea/ui-vue',
      '.',
      { types: './dist/index.d.ts', import: './dist/other.js' },
    ],
    ['@warmsea/ui-vue', './style.css', './dist/other.css'],
    ['@warmsea/ui-tokens', './style.css', './dist/other.css'],
  ])('rejects a different %s %s target', async (name, key, target) => {
    const fixture = await consumer();
    const manifest = name === '@warmsea/ui-vue' ? fixture.vue : fixture.tokens;
    await writeFile(
      join(fixture.directory, 'node_modules', name as string, 'package.json'),
      JSON.stringify({
        ...manifest,
        exports: { ...manifest.exports, [key as string]: target },
      }),
    );
    await expect(
      checkConsumerRuntime(fixture.directory, fixture.vue, fixture.tokens),
    ).rejects.toThrow(/resolved outside the packed target/);
  });

  it('rejects an ancestor fallback when the invocation runtime package is missing', async () => {
    const fixture = await consumer();
    const nested = join(fixture.directory, 'nested');
    await mkdir(nested);
    await writeFile(
      join(nested, 'package.json'),
      '{"private":true,"type":"module"}',
    );
    await expect(
      checkConsumerRuntime(nested, fixture.vue, fixture.tokens),
    ).rejects.toThrow(/resolved outside the packed target/);
  });
});

describe('packed declarations', () => {
  let temporary: string | undefined;
  const headingDeclaration =
    "export declare const Heading: import('vue').DefineComponent<HeadingProps>;";
  const appBarDeclaration = `export declare const AppBar: import('vue').DefineComponent<
  AppBarProps, {}, {}, {}, {}, import('vue').ComponentOptionsMixin,
  import('vue').ComponentOptionsMixin,
  { activate: (item: AppBarItem, event: MouseEvent) => void }
> & {
  new(): { $slots: { icon: (props: { item: AppBarItem; active: boolean }) => import('vue').VNode[] } };
};`;
  const tooltipDeclaration = `export declare const Tooltip: import('vue').DefineComponent<TooltipProps> & {
  new(): { $slots: { default: (props: { describedBy: string | undefined }) => import('vue').VNode[] } };
};`;
  const declarations = `
export type InputType = 'text' | 'password' | 'email' | 'search' | 'tel' | 'url';
export interface InputProps {
  modelValue: string;
  type?: InputType;
  clearable?: boolean;
  label?: string;
  errorText?: string;
  readonly?: boolean;
}
export declare const Input: import('vue').DefineComponent<
  InputProps, {}, {}, {}, {}, import('vue').ComponentOptionsMixin,
  import('vue').ComponentOptionsMixin,
  { 'update:modelValue': (value: string) => void }
>;
export declare const Select: import('vue').DefineComponent<
  SelectProps, {}, {}, {}, {}, import('vue').ComponentOptionsMixin,
  import('vue').ComponentOptionsMixin,
  { 'update:modelValue': (value: string | null) => void }
>;
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export interface SelectProps {
  options: readonly SelectOption[];
  modelValue: string | null;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}
export declare const Button: import('vue').DefineComponent<ButtonProps>;
${headingDeclaration}
export declare const Text: import('vue').DefineComponent<TextProps>;
${appBarDeclaration}
${tooltipDeclaration}
export type TooltipPlacement = 'top' | 'bottom' | 'inline-start' | 'inline-end';
export interface TooltipProps {
  text: string;
  placement?: TooltipPlacement;
  describe?: boolean;
}
export interface AppBarItem {
  id: string;
  label: string;
  href: string;
}
export interface AppBarProps {
  items: readonly AppBarItem[];
  bottomItems?: readonly AppBarItem[];
  activeId?: string;
}
export interface ButtonProps {
  variant?: 'primary' | 'default' | 'outlined' | 'subtle';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}
export interface HeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
}
export interface TextProps {
  as?: 'p' | 'span';
  weight?: 'regular' | 'semibold';
}
export interface DialogProps { modelValue: boolean; title: string }
export interface TextareaProps { modelValue: string; label?: string; readonly?: boolean; appearance?: 'default' | 'embedded' }
export declare const Dialog: import('vue').DefineComponent<
  DialogProps, {}, {}, {}, {}, import('vue').ComponentOptionsMixin,
  import('vue').ComponentOptionsMixin, { 'update:modelValue': (value: boolean) => void }
> & { new(): { $slots: { default?: () => import('vue').VNode[]; footer?: () => import('vue').VNode[] } } };
export declare const Textarea: import('vue').DefineComponent<
  TextareaProps, { focus: () => void }, {}, {}, {}, import('vue').ComponentOptionsMixin,
  import('vue').ComponentOptionsMixin, { 'update:modelValue': (value: string) => void }
>;
export interface MenuItem { id: string; label: string; disabled?: boolean }
export interface MenuProps { label: string; items: MenuItem[]; disabled?: boolean }
export declare const Menu: import('vue').DefineComponent<
  MenuProps, {}, {}, {}, {}, import('vue').ComponentOptionsMixin,
  import('vue').ComponentOptionsMixin, { select: (item: MenuItem) => void }
>;
`;

  afterEach(async () => {
    if (temporary) await rm(temporary, { recursive: true, force: true });
    temporary = undefined;
  });

  async function entry(source: string) {
    const artifacts = fileURLToPath(
      new URL('../.artifacts/package/', import.meta.url),
    );
    await mkdir(artifacts, { recursive: true });
    temporary = await mkdtemp(join(artifacts, 'types-'));
    const filename = join(temporary, 'index.d.ts');
    await writeFile(filename, source);
    return filename;
  }

  describe('packed consumer resolution', () => {
    it('rejects a workspace fallback instead of the requested packed types', async () => {
      const filename = await entry(declarations);
      expect(() =>
        checkDeclarations(filename, {
          consumerDirectory: dirname(filename),
          moduleSpecifier: '@warmsea/ui-vue',
        }),
      ).toThrow(/Types resolved outside the packed target/);
    });
  });

  it('rejects missing transitive declaration files', async () => {
    const filename = await entry(
      `${declarations}\nexport * from './missing.js';`,
    );
    expect(() => checkDeclarations(filename)).toThrow(
      /TS2307.*\.\/missing\.js/,
    );
  });

  it.each([
    {
      name: 'forbidden public property (M01)',
      from: 'clearable?: boolean;',
      to: 'clearable?: boolean; revealable?: boolean;',
      diagnostic: /TS2322.*never[\s\S]*noInputRevealProps/,
    },
    {
      name: 'unused negative assertion (M02)',
      from: 'options: readonly SelectOption[]',
      to: 'options?: readonly SelectOption[]',
      diagnostic: /TS2578[\s\S]*missingSelectOptions/,
    },
    {
      name: 'removed valid public value (M12)',
      from: "'primary' | 'default' | 'outlined' | 'subtle'",
      to: "'primary' | 'default' | 'outlined'",
      diagnostic: /TS2322.*subtle/,
    },
    {
      name: 'missing Heading export (M23)',
      from: headingDeclaration,
      to: '',
      diagnostic: /TS2305.*Heading/,
    },
  ])('rejects $name', async ({ from, to, diagnostic }) => {
    expect(declarations.split(from)).toHaveLength(2);
    const filename = await entry(declarations.replace(from, to));
    expect(() => checkDeclarations(filename)).toThrow(diagnostic);
  });

  describe(
    'cold checks follow successive transitive changes',
    { concurrent: false, shuffle: false },
    () => {
      let filename: string;
      const dependency = (name: string) =>
        join(dirname(filename), 'node_modules', 'cold-b', name);
      const manifest = (types: string) =>
        JSON.stringify({ name: 'cold-b', type: 'module', types });
      beforeAll(async () => {
        filename = await isolatedEntry(
          `${declarations}\nexport * from 'cold-a';`,
        );
        const upstream = join(dirname(filename), 'node_modules', 'cold-a');
        await mkdir(upstream, { recursive: true });
        await mkdir(dirname(dependency('package.json')), { recursive: true });
        await writeFile(
          join(upstream, 'package.json'),
          JSON.stringify({
            name: 'cold-a',
            type: 'module',
            types: './index.d.mts',
          }),
        );
        await writeFile(
          join(upstream, 'index.d.mts'),
          "export * from 'cold-b';",
        );
        await writeFile(dependency('package.json'), manifest('./first.d.mts'));
        await writeFile(
          dependency('first.d.mts'),
          'export declare const fixture: string;',
        );
        await writeFile(
          dependency('second.d.mts'),
          'export declare const fixture: MissingRetargetedType;',
        );
      });
      afterAll(async () => {
        if (filename)
          await rm(dirname(filename), { recursive: true, force: true });
      });
      it('accepts the initial transitive declaration', () => {
        expect(() => checkDeclarations(filename)).not.toThrow();
      });
      it('accepts a second unchanged validation', () => {
        expect(() => checkDeclarations(filename)).not.toThrow();
      });
      it('detects a changed transitive types target after unchanged validations', async () => {
        await writeFile(dependency('package.json'), manifest('./second.d.mts'));
        expect(() => checkDeclarations(filename)).toThrow(
          /second\.d\.mts.*TS2304.*MissingRetargetedType/,
        );
      });
      it('accepts a repaired dependency source at the same path', async () => {
        await writeFile(
          dependency('second.d.mts'),
          'export declare const fixture: string;',
        );
        expect(() => checkDeclarations(filename)).not.toThrow();
      });
      it('rejects deletion of the active dependency declaration', async () => {
        await rm(dependency('second.d.mts'));
        expect(() => checkDeclarations(filename)).toThrow(/TS2307.*cold-b/);
      });
      it('accepts restoration of the active dependency declaration', async () => {
        await writeFile(
          dependency('second.d.mts'),
          'export declare const fixture: string;',
        );
        expect(() => checkDeclarations(filename)).not.toThrow();
      });
      it('accepts restoration of the original transitive types target', async () => {
        await writeFile(
          dependency('second.d.mts'),
          'export declare const fixture: MissingInactiveType;',
        );
        await writeFile(dependency('package.json'), manifest('./first.d.mts'));
        expect(() => checkDeclarations(filename)).not.toThrow();
      });
    },
  );

  async function isolatedEntry(source: string) {
    const artifacts = fileURLToPath(
      new URL('../.artifacts/package/', import.meta.url),
    );
    await mkdir(artifacts, { recursive: true });
    const directory = await mkdtemp(join(artifacts, 'cold-'));
    const filename = join(directory, 'index.d.ts');
    await writeFile(filename, source);
    return filename;
  }

  function validation(check: (filename: string) => void, filename: string) {
    try {
      check(filename);
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  type DeclarationStep = {
    name: string;
    update?: (filename: string) => Promise<unknown>;
    diagnostic?: RegExp;
  };

  function validationSequence(
    name: string,
    source: string,
    steps: readonly DeclarationStep[],
  ) {
    describe(name, { concurrent: false, shuffle: false }, () => {
      let filename: string;
      beforeAll(async () => {
        filename = await isolatedEntry(source);
      });
      afterAll(async () => {
        if (filename)
          await rm(dirname(filename), { recursive: true, force: true });
      });

      for (const step of steps) {
        it(step.name, async () => {
          await step.update?.(filename);
          const cold = validation(checkDeclarations, filename);
          if (step.diagnostic) expect(cold).toMatch(step.diagnostic);
          else expect(cold).toBeUndefined();
        });
      }
    });
  }

  validationSequence(
    'cold checks follow successive source changes',
    declarations,
    [
      { name: 'initial valid source' },
      {
        name: 'invalid Heading assignment',
        update: (filename) =>
          writeFile(
            filename,
            declarations.replace(
              headingDeclaration,
              'export declare const Heading: unknown;',
            ),
          ),
        diagnostic: /__package-check__\.ts.*TS2322.*unknown/,
      },
      {
        name: 'restored valid source',
        update: (filename) => writeFile(filename, declarations),
      },
      {
        name: 'different invalid declaration',
        update: (filename) =>
          writeFile(
            filename,
            `${declarations}\nexport declare const broken: MissingDeclaration;`,
          ),
        diagnostic: /index\.d\.ts.*TS2304.*MissingDeclaration/,
      },
      {
        name: 'second restored valid source',
        update: (filename) => writeFile(filename, declarations),
      },
    ],
  );
});
