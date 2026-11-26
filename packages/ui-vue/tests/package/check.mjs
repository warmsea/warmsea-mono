import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

export function checkArchive(files, name, tokenVersion) {
  function content(path) {
    const value = files.get(`package/${path}`);
    assert.ok(value?.length, `${name}: missing or empty ${path}`);
    return value;
  }

  const manifest = JSON.parse(content('package.json'));
  assert.equal(manifest.name, name);
  assert.equal(manifest.type, 'module');
  assert.deepEqual(manifest.sideEffects, ['**/*.css']);
  content('README.md');
  for (const [path, source] of files) {
    assert.doesNotMatch(path, /combobox/i);
    assert.match(path, /^package\/(?:package\.json|README\.md|dist\/.+)$/);
    assert.doesNotMatch(
      path,
      /\.(?:stories|test|spec)\.[^/]+$|\.vue$|\.d\.ts\.map$/,
    );
    if (path.endsWith('.d.ts')) {
      assert.doesNotMatch(source, /[#@]\s*sourceMappingURL\s*=/);
    }
  }

  if (name === '@warmsea/ui-tokens') {
    assert.deepEqual(manifest.exports, { './style.css': './dist/style.css' });
    assert.equal(manifest.dependencies, undefined);
    assert.equal(manifest.peerDependencies, undefined);
    assert.deepEqual([...files.keys()].sort(), [
      'package/README.md',
      'package/dist/style.css',
      'package/package.json',
    ]);
    assert.match(content('dist/style.css'), /--wui-color-primary:\s*#0f766e/);
  } else {
    assert.equal(name, '@warmsea/ui-vue');
    assert.deepEqual(manifest.exports, {
      '.': { types: './dist/index.d.ts', import: './dist/index.js' },
      './style.css': './dist/style.css',
    });
    assert.equal(manifest.main, manifest.exports['.'].import);
    assert.equal(manifest.module, manifest.exports['.'].import);
    assert.equal(manifest.types, manifest.exports['.'].types);
    assert.deepEqual(manifest.dependencies, {
      '@warmsea/ui-tokens': `^${tokenVersion}`,
    });
    assert.deepEqual(manifest.peerDependencies, { vue: '^3.5.0' });
    const library = content('dist/index.js');
    assert.match(library, /from\s*["']vue["']/);
    content('dist/index.d.ts');
    const css = content('dist/style.css');
    assert.doesNotMatch(css, /\.wui-combobox\b/);
    assert.doesNotMatch(css, /\.wui-input__adornment\b/);
    assert.doesNotMatch(
      css,
      /@import\b/i,
      'The shipped stylesheet must inline all component styles.',
    );
    assert.doesNotMatch(
      css,
      /\[data-v-[\w-]+\]/,
      'Component selectors must remain unscoped.',
    );
    for (const variant of ['primary', 'default', 'outlined', 'subtle']) {
      assert.ok(css.includes(`.wui-button--${variant}`));
    }
    for (const level of [1, 2, 3, 4, 5, 6]) {
      assert.ok(css.includes(`.wui-heading--${level}`));
    }
    for (const modifier of ['regular', 'semibold']) {
      assert.ok(css.includes(`.wui-text--${modifier}`));
    }
    for (const selector of [
      '.wui-app-bar',
      '.wui-app-bar__link',
      '.wui-app-bar__icon',
      '.wui-app-bar__group--bottom',
      '.wui-tooltip',
      '.wui-tooltip__content',
      '.wui-select',
      '.wui-input',
      '.wui-textarea',
      '.wui-dialog',
      '.wui-menu',
    ]) {
      assert.ok(css.includes(`${selector}{`) || css.includes(`${selector},`));
    }
    assert.doesNotMatch(`${library}\n${css}`, /--wui-color-primary\s*:/);
  }
  return manifest;
}

export function checkRuntimeExports(library) {
  assert.deepEqual(Object.keys(library).sort(), [
    'AppBar',
    'Button',
    'Dialog',
    'Heading',
    'Input',
    'Menu',
    'Select',
    'Text',
    'Textarea',
    'Tooltip',
  ]);
  for (const name of [
    'AppBar',
    'Button',
    'Dialog',
    'Heading',
    'Input',
    'Menu',
    'Select',
    'Text',
    'Textarea',
    'Tooltip',
  ]) {
    assert.ok(library[name]);
    assert.ok(['object', 'function'].includes(typeof library[name]));
  }
}

export function checkTokenReferences(tokenCss, componentCss, library) {
  const declarations = (css) =>
    [...css.matchAll(/(--wui-[\w-]+)\s*:/g)].map((match) => match[1]);
  const defined = new Set([
    ...declarations(tokenCss),
    ...declarations(componentCss),
  ]);
  const runtimeProperties = new Set([
    '--wui-tooltip-available-width',
    '--wui-tooltip-bridge',
  ]);
  for (const [, name] of componentCss.matchAll(/var\(\s*(--wui-[\w-]+)/g)) {
    if (defined.has(name)) continue;
    assert.ok(
      runtimeProperties.has(name) &&
        new RegExp(`["']${name}["']`).test(library),
      `${name} is not exported by the token stylesheet or defined by the component.`,
    );
  }
}

export async function createConsumer(directory, files) {
  const manifest = JSON.parse(files.get('package/package.json'));
  assert.ok(['@warmsea/ui-vue', '@warmsea/ui-tokens'].includes(manifest.name));
  const packed = join(directory, 'node_modules', manifest.name);
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  for (const [path, content] of files) {
    assert.ok(
      path.startsWith('package/') &&
        path
          .split('/')
          .every(
            (part) =>
              part && part !== '.' && part !== '..' && !part.includes('\\'),
          ),
      `Unsafe archive path: ${path}`,
    );
    const target = join(packed, path.slice('package/'.length));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return packed;
}

export async function checkConsumerRuntime(directory, vue, tokens) {
  const target = (name, path) =>
    pathToFileURL(join(directory, 'node_modules', name, path)).href;
  const filename = join(directory, 'runtime-check.mjs');
  await writeFile(
    filename,
    `import assert from 'node:assert/strict';
import { checkRuntimeExports } from ${JSON.stringify(import.meta.url)};
assert.equal(process.versions.node, '24.20.0');
assert.equal(typeof window, 'undefined');
assert.equal(typeof document, 'undefined');
assert.equal(import.meta.resolve('@warmsea/ui-vue'), ${JSON.stringify(target(vue.name, vue.exports['.'].import))}, 'JS resolved outside the packed target');
assert.equal(import.meta.resolve('@warmsea/ui-vue/style.css'), ${JSON.stringify(target(vue.name, vue.exports['./style.css']))}, 'Vue CSS resolved outside the packed target');
assert.equal(import.meta.resolve('@warmsea/ui-tokens/style.css'), ${JSON.stringify(target(tokens.name, tokens.exports['./style.css']))}, 'Token CSS resolved outside the packed target');
const library = await import('@warmsea/ui-vue');
checkRuntimeExports(library);
assert.equal(typeof window, 'undefined');
assert.equal(typeof document, 'undefined');
console.log('Packed consumer Node=' + process.versions.node);`,
  );
  const result = spawnSync(
    globalThis.Bun ? 'node' : process.execPath,
    [filename],
    {
      cwd: directory,
      encoding: 'utf8',
      env: process.env,
      timeout: 120_000,
    },
  );
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  console.log(result.stdout.trim());
}

export function checkDeclarations(
  entry,
  { consumerDirectory = dirname(entry), moduleSpecifier = './index.js' } = {},
) {
  const filename = join(consumerDirectory, '__package-check__.ts');
  const source = `
  import { Menu, type MenuProps, type MenuItem } from './index.js';
  const menuComponent: import('vue').Component = Menu;
  const menuProps: MenuProps = { label: 'Actions', items: [{ id: 'rename', label: 'Rename', disabled: true }] };
  // @ts-expect-error An accessible trigger label is required.
  const missingMenuLabel: MenuProps = { items: [] };
  void [menuComponent, menuProps, missingMenuLabel];
  import { Dialog, Textarea, type DialogProps, type TextareaProps } from './index.js';
  const dialogComponent: import('vue').Component = Dialog;
  const textareaComponent: import('vue').Component = Textarea;
  const dialogProps: DialogProps = { modelValue: false, title: 'Review' };
  const textareaProps: TextareaProps = { modelValue: '', label: 'Notes', readonly: true, appearance: 'embedded' };
  // @ts-expect-error Appearance is a closed optional contract.
  const invalidTextareaAppearance: TextareaProps = { modelValue: '', appearance: 'borderless' };
  void invalidTextareaAppearance;
  // @ts-expect-error Textarea is string-only.
  const invalidTextarea: TextareaProps = { modelValue: null };
  // @ts-expect-error Dialog requires an accessible title.
  const invalidDialog: DialogProps = { modelValue: true };
  // @ts-expect-error Dialog state is boolean.
  const invalidDialogState: DialogProps = { modelValue: 'open', title: 'Review' };
  // @ts-expect-error Textarea requires a model.
  const missingTextarea: TextareaProps = {};
import { Input, type InputProps, type InputType } from './index.js';
const input: import('vue').Component = Input;
const inputTypes: InputType[] = ['text', 'password', 'email', 'search', 'tel', 'url'];
const inputProps: InputProps = { modelValue: '', type: 'password', clearable: true, label: 'Password', errorText: 'Invalid', readonly: true };
type NoInputRevealProps = Extract<keyof InputProps, 'revealable' | 'showPasswordLabel' | 'hidePasswordLabel'> extends never ? true : never;
const noInputRevealProps: NoInputRevealProps = true;
declare const inputInstance: InstanceType<typeof Input>;
inputInstance.$emit('update:modelValue', '');
// @ts-expect-error Input is explicitly controlled.
const missingInputModel: InputProps = {};
// @ts-expect-error Input values are strings, never null.
const nullInputModel: InputProps = { modelValue: null };
// @ts-expect-error Input supports text-like types only.
const invalidInputType: InputType = 'number';
// @ts-expect-error Clearable is boolean.
const invalidInputClear: InputProps = { modelValue: '', clearable: 'true' };
// @ts-expect-error Input updates never contain null.
inputInstance.$emit('update:modelValue', null);
void [input, inputTypes, inputProps, noInputRevealProps, missingInputModel, nullInputModel, invalidInputType, invalidInputClear];
// @ts-expect-error Combobox is no longer exported.
import { Combobox } from './index.js';
// @ts-expect-error Combobox props are no longer exported.
import type { ComboboxProps } from './index.js';
// @ts-expect-error Combobox options are no longer exported.
import type { ComboboxOption } from './index.js';
import { Select, type SelectOption, type SelectProps } from './index.js';
const select: import('vue').Component = Select;
const selectOptions: readonly SelectOption[] = [{ value: 'ocean', label: 'Ocean', disabled: true }];
const selectProps: SelectProps = { options: selectOptions, modelValue: null, required: true, disabled: false, name: 'destination', placeholder: 'Choose' };
const selectedSelect: SelectProps = { options: [], modelValue: 'ocean' };
type SelectUpdate = NonNullable<InstanceType<typeof Select>['$props']['onUpdate:modelValue']>;
const updateSelect: SelectUpdate = (value) => { const selected: string | null = value; void selected; };
declare const selectInstance: InstanceType<typeof Select>;
selectInstance.$emit('update:modelValue', 'coast');
selectInstance.$emit('update:modelValue', null);
// @ts-expect-error Options are required.
const missingSelectOptions: SelectProps = { modelValue: null };
// @ts-expect-error Model is explicitly controlled.
const missingSelectModel: SelectProps = { options: [] };
// @ts-expect-error Model values are strings or null.
const invalidSelectValue: SelectProps = { options: [], modelValue: 1 };
// @ts-expect-error Labels are required.
const missingSelectLabel: SelectOption = { value: 'ocean' };
// @ts-expect-error Option identity is a string.
const invalidSelectOption: SelectOption = { value: 1, label: 'Ocean' };
// @ts-expect-error Required is boolean.
const invalidSelectRequired: SelectProps = { options: [], modelValue: null, required: 'true' };
// @ts-expect-error Disabled is boolean.
const invalidSelectDisabled: SelectProps = { options: [], modelValue: null, disabled: 'true' };
// @ts-expect-error Option disabled state is boolean.
const invalidSelectRow: SelectOption = { value: 'ocean', label: 'Ocean', disabled: 'true' };
// @ts-expect-error The native field name is a string.
const invalidSelectName: SelectProps = { options: [], modelValue: null, name: 1 };
// @ts-expect-error Prompt is plain text.
const invalidSelectPrompt: SelectProps = { options: [], modelValue: null, placeholder: 1 };
// @ts-expect-error Update payloads are not option objects.
selectInstance.$emit('update:modelValue', { value: 'ocean' });
// @ts-expect-error Update includes null, not only a string.
const invalidSelectUpdate: SelectUpdate = (value: string) => {};
void [select, selectProps, selectedSelect,
updateSelect, missingSelectOptions, missingSelectModel, invalidSelectValue,
missingSelectLabel, invalidSelectOption, invalidSelectRequired, invalidSelectDisabled,
invalidSelectRow, invalidSelectName, invalidSelectPrompt, invalidSelectUpdate];
import { AppBar, Button, Heading, Text, Tooltip, type TooltipProps, type TooltipPlacement, type AppBarProps, type AppBarItem, type ButtonProps, type HeadingProps, type TextProps } from './index.js';
import type { Component } from 'vue';
const component: Component = Button;
const heading: Component = Heading;
const text: Component = Text;
const appBar: Component = AppBar;
const tooltip: Component = Tooltip;
const tooltipProps: TooltipProps = { text: 'Help' };
const tooltipPlacements: TooltipPlacement[] = ['top', 'bottom', 'inline-start', 'inline-end'];
const positionedTooltip: TooltipProps = { text: 'Help', placement: 'inline-end', describe: false };
type TooltipSlot = InstanceType<typeof Tooltip>['$slots']['default'];
type TooltipDescription = Parameters<TooltipSlot>[0]['describedBy'];
const descriptionId: TooltipDescription = 'help';
const noDescription: TooltipDescription = undefined;
const tooltipSlot: TooltipSlot = ({ describedBy }) => {
  const id: string | undefined = describedBy;
  void id;
  return [];
};
// @ts-expect-error Tooltip requires text.
const missingTooltipText: TooltipProps = {};
// @ts-expect-error Tooltip text is plain text, not a count or node.
const invalidTooltipText: TooltipProps = { text: 12 };
// @ts-expect-error Placements use the closed logical union.
const invalidTooltipPlacement: TooltipProps = { text: 'Help', placement: 'right' };
// @ts-expect-error Description mode is boolean.
const invalidTooltipDescribe: TooltipProps = { text: 'Help', describe: 'false' };
// @ts-expect-error The trigger slot is required.
const missingTooltipSlot: TooltipSlot = undefined;
// @ts-expect-error Description IDs cannot be numbers.
const invalidDescription: TooltipDescription = 12;
// @ts-expect-error Slot props always include the potentially undefined ID.
const missingSlotDescription: Parameters<TooltipSlot>[0] = {};
const item: AppBarItem = { id: 'chat', label: 'Chat', href: '/chat' };
const readonlyItems: readonly AppBarItem[] = [item];
const appBarProps: AppBarProps = { items: readonlyItems, bottomItems: readonlyItems, activeId: 'chat' };
const emptyAppBar: AppBarProps = { items: [] };
type AppBarIcon = InstanceType<typeof AppBar>['$slots']['icon'];
const iconSlot: AppBarIcon = ({ item, active }) => {
  const destination: AppBarItem = item;
  const current: boolean = active;
  void [destination, current];
  return [];
};
// @ts-expect-error The icon slot is required.
const missingIconSlot: AppBarIcon = undefined;
// @ts-expect-error Badges are not part of an icon destination.
const unsupportedBadge: AppBarItem = { ...item, badge: { text: '12', label: '12 unread messages' } };
type AppBarActivate = NonNullable<InstanceType<typeof AppBar>['$props']['onActivate']>;
const onActivate: AppBarActivate = (activatedItem, event) => {
  const destination: AppBarItem = activatedItem;
  const click: MouseEvent = event;
  event.preventDefault();
  void [destination, click];
};
declare const appBarInstance: InstanceType<typeof AppBar>;
declare const nativeClick: MouseEvent;
appBarInstance.$emit('activate', item, nativeClick);
// @ts-expect-error Activation supplies an item, not an ID string.
const invalidActivateItem: AppBarActivate = (id: string, event: MouseEvent) => {};
// @ts-expect-error Native activation supplies MouseEvent, not KeyboardEvent.
const invalidActivateEvent: AppBarActivate = (item: AppBarItem, event: KeyboardEvent) => {};
// @ts-expect-error Activation requires the original native event.
appBarInstance.$emit('activate', item);
// @ts-expect-error Activation supplies an item, not an ID string.
appBarInstance.$emit('activate', 'chat', nativeClick);
// @ts-expect-error There is no synthetic selection event.
appBarInstance.$emit('select', item);
// @ts-expect-error Items are required.
const missingItems: AppBarProps = {};
// @ts-expect-error Destination IDs must be strings.
const invalidId: AppBarItem = { id: 1, label: 'Chat', href: '/chat' };
// @ts-expect-error Destination labels are required.
const missingLabel: AppBarItem = { id: 'chat', href: '/chat' };
// @ts-expect-error Destination hrefs are required.
const missingHref: AppBarItem = { id: 'chat', label: 'Chat' };
// @ts-expect-error Destination labels must be strings.
const invalidLabel: AppBarItem = { id: 'chat', label: 1, href: '/chat' };
// @ts-expect-error Destination hrefs must be strings.
const invalidHref: AppBarItem = { id: 'chat', label: 'Chat', href: 1 };
// @ts-expect-error Current IDs must be strings.
const invalidActiveId: AppBarProps = { items: [], activeId: 1 };
const variants: ButtonProps['variant'][] = ['primary', 'default', 'outlined', 'subtle'];
const types: ButtonProps['type'][] = ['button', 'submit', 'reset'];
const props: ButtonProps = { variant: 'default', disabled: false, type: 'button' };
// @ts-expect-error Variants use the closed public union.
const invalidVariant: ButtonProps = { variant: 'secondary' };
// @ts-expect-error Filled was renamed to primary.
const removedFilledVariant: ButtonProps = { variant: 'filled' };
// @ts-expect-error Tonal was renamed to default.
const removedTonalVariant: ButtonProps = { variant: 'tonal' };
// @ts-expect-error Button has one text size and no size prop.
const invalidSize: ButtonProps = { size: 'small' };
// @ts-expect-error Type only accepts native button types.
const invalidType: ButtonProps = { type: 'link' };
// @ts-expect-error Disabled is a native boolean.
const invalidDisabled: ButtonProps = { disabled: 'true' };
const levels: HeadingProps['level'][] = [1, 2, 3, 4, 5, 6];
const headingProps: HeadingProps = { level: 2 };
const roots: TextProps['as'][] = ['p', 'span'];
const weights: TextProps['weight'][] = ['regular', 'semibold'];
const defaultText: TextProps = {};
const textProps: TextProps = { as: 'span', weight: 'semibold' };
// @ts-expect-error Heading rank must be explicit.
const missingLevel: HeadingProps = {};
// @ts-expect-error Heading ranks are a closed union.
const invalidLevel: HeadingProps = { level: 7 };
// @ts-expect-error Heading ranks are numbers.
const stringLevel: HeadingProps = { level: '2' };
// @ts-expect-error Heading has no visual size prop.
const headingSize: HeadingProps = { level: 2, size: 'large' };
// @ts-expect-error Text roots are native paragraph or inline text only.
const invalidRoot: TextProps = { as: 'a' };
// @ts-expect-error Text has one text size and no size prop.
const invalidTextSize: TextProps = { size: 'large' };
// @ts-expect-error Text weight is a closed union.
const invalidWeight: TextProps = { weight: 'bold' };
// @ts-expect-error Text weight is not numeric.
const numericWeight: TextProps = { weight: 600 };
void [component, heading, text, variants, types, props, invalidVariant, removedFilledVariant,
  removedTonalVariant, invalidSize,
  invalidType, invalidDisabled, levels, headingProps, roots, weights, defaultText,
  textProps, missingLevel, invalidLevel, stringLevel, headingSize, invalidRoot,
  invalidTextSize, invalidWeight, numericWeight, appBar, item, appBarProps,
  emptyAppBar, missingItems, invalidId, missingLabel, missingHref, invalidLabel,
  invalidHref, unsupportedBadge, invalidActiveId, iconSlot, missingIconSlot,
  onActivate, invalidActivateItem, invalidActivateEvent];
void [tooltip, tooltipProps, tooltipPlacements, positionedTooltip, descriptionId,
  noDescription, tooltipSlot, missingTooltipText, invalidTooltipText,
  invalidTooltipPlacement, invalidTooltipDescribe, missingTooltipSlot,
  invalidDescription, missingSlotDescription];

// Exercise the generated component types, not just separately exported interfaces.
const buttonPublic: InstanceType<typeof Button>['$props'] = props;
const headingPublic: InstanceType<typeof Heading>['$props'] = headingProps;
const textPublic: InstanceType<typeof Text>['$props'] = textProps;
const inputPublic: InstanceType<typeof Input>['$props'] = inputProps;
const selectPublic: InstanceType<typeof Select>['$props'] = selectProps;
const appBarPublic: InstanceType<typeof AppBar>['$props'] = appBarProps;
const tooltipPublic: InstanceType<typeof Tooltip>['$props'] = tooltipProps;
const dialogPublic: InstanceType<typeof Dialog>['$props'] = dialogProps;
const textareaPublic: InstanceType<typeof Textarea>['$props'] = textareaProps;
const menuPublic: InstanceType<typeof Menu>['$props'] = menuProps;
// @ts-expect-error The generated Button preserves its closed variants.
const invalidButtonPublic: typeof buttonPublic = { variant: 'secondary' };
// @ts-expect-error The generated Heading requires a level.
const invalidHeadingPublic: typeof headingPublic = {};
// @ts-expect-error The generated Text preserves its closed native roots.
const invalidTextPublic: typeof textPublic = { as: 'a' };
// @ts-expect-error The generated Input remains string-only.
const invalidInputPublic: typeof inputPublic = { modelValue: null };
// @ts-expect-error The generated Select requires options.
const invalidSelectPublic: typeof selectPublic = { modelValue: null };
// @ts-expect-error The generated AppBar requires destinations.
const invalidAppBarPublic: typeof appBarPublic = {};
// @ts-expect-error The generated Tooltip requires plain text.
const invalidTooltipPublic: typeof tooltipPublic = {};
// @ts-expect-error The generated Dialog requires its accessible title.
const invalidDialogPublic: typeof dialogPublic = { modelValue: true };
// @ts-expect-error The generated Textarea requires its controlled model.
const invalidTextareaPublic: typeof textareaPublic = {};
// @ts-expect-error The generated Menu requires its trigger label.
const invalidMenuPublic: typeof menuPublic = { items: [] };

const menuItem: MenuItem = { id: 'rename', label: 'Rename', disabled: true };
// @ts-expect-error Public action IDs are strings.
const invalidMenuItem: MenuItem = { id: 1, label: 'Rename' };
declare const dialogInstance: InstanceType<typeof Dialog>;
declare const textareaInstance: InstanceType<typeof Textarea>;
declare const menuInstance: InstanceType<typeof Menu>;
dialogInstance.$emit('update:modelValue', false);
textareaInstance.$emit('update:modelValue', '');
menuInstance.$emit('select', menuItem);
const focusTextarea: () => void = textareaInstance.focus;
focusTextarea();
const updateDialog: NonNullable<typeof dialogInstance.$props['onUpdate:modelValue']> =
  (value) => { const state: boolean = value; void state; };
const updateTextarea: NonNullable<typeof textareaInstance.$props['onUpdate:modelValue']> =
  (value) => { const text: string = value; void text; };
const selectAction: NonNullable<typeof menuInstance.$props.onSelect> =
  (value) => { const action: MenuItem = value; void action; };
// @ts-expect-error Dialog updates carry boolean state.
dialogInstance.$emit('update:modelValue', 'open');
// @ts-expect-error Textarea updates never carry null.
textareaInstance.$emit('update:modelValue', null);
// @ts-expect-error Menu selects an item, not an ID.
menuInstance.$emit('select', 'rename');
const dialogSlots: typeof dialogInstance.$slots = { default: () => [], footer: () => [] };
const emptyDialogSlots: typeof dialogInstance.$slots = {};
// @ts-expect-error Dialog slots are render functions, not numbers.
const invalidDialogSlots: typeof dialogInstance.$slots = { footer: 1 };

// Missing a public component's evidence is a type error; this is not a test registry.
const publicContracts = {
  Menu: [menuComponent, menuProps, missingMenuLabel, menuPublic, invalidMenuPublic, menuItem, invalidMenuItem, selectAction],
  AppBar: [appBarPublic, invalidAppBarPublic, appBarProps, iconSlot, missingIconSlot, onActivate, invalidActivateItem, invalidActivateEvent],
  Button: [buttonPublic, invalidButtonPublic, variants, types, invalidVariant, removedFilledVariant, removedTonalVariant, invalidSize, invalidType, invalidDisabled],
  Dialog: [dialogPublic, invalidDialogPublic, invalidDialog, invalidDialogState, updateDialog, dialogSlots, emptyDialogSlots, invalidDialogSlots],
  Heading: [headingPublic, invalidHeadingPublic, levels, missingLevel, invalidLevel, stringLevel, headingSize],
  Input: [inputPublic, invalidInputPublic, inputTypes, noInputRevealProps, missingInputModel, nullInputModel, invalidInputType, invalidInputClear],
  Select: [selectPublic, invalidSelectPublic, selectedSelect, updateSelect, missingSelectOptions, missingSelectModel, invalidSelectValue, missingSelectLabel, invalidSelectOption, invalidSelectRequired, invalidSelectDisabled, invalidSelectRow, invalidSelectName, invalidSelectPrompt, invalidSelectUpdate],
  Text: [textPublic, invalidTextPublic, roots, weights, defaultText, invalidRoot, invalidTextSize, invalidWeight, numericWeight],
  Textarea: [textareaPublic, invalidTextareaPublic, invalidTextareaAppearance, invalidTextarea, missingTextarea, updateTextarea, focusTextarea],
  Tooltip: [tooltipPublic, invalidTooltipPublic, tooltipPlacements, positionedTooltip, noDescription, tooltipSlot, missingTooltipText, invalidTooltipText, invalidTooltipPlacement, invalidTooltipDescribe, missingTooltipSlot, invalidDescription, missingSlotDescription],
} satisfies Record<'Menu' | 'AppBar' | 'Button' | 'Dialog' | 'Heading' | 'Input' | 'Select' | 'Text' | 'Textarea' | 'Tooltip', readonly unknown[]>;
void publicContracts;
`.replaceAll("'./index.js'", JSON.stringify(moduleSpecifier));
  const options = {
    noEmit: true,
    strict: true,
    skipLibCheck: false,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: ['vite/client'],
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  };
  const host = ts.createCompilerHost(options);
  const resolved = ts.resolveModuleName(
    moduleSpecifier,
    filename,
    options,
    host,
  ).resolvedModule;
  assert.equal(
    resolved && resolve(resolved.resolvedFileName),
    resolve(entry),
    'Types resolved outside the packed target',
  );
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (path, ...args) =>
    resolve(path) === filename
      ? ts.createSourceFile(path, source, options.target)
      : getSourceFile(path, ...args);
  const diagnostics = ts.getPreEmitDiagnostics(
    ts.createProgram([filename], options, host),
  );
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (path) => path,
      getCurrentDirectory: () => dirname(entry),
      getNewLine: () => '\n',
    }) +
      diagnostics
        .filter(
          (diagnostic) => diagnostic.file && diagnostic.start !== undefined,
        )
        .map((diagnostic) => {
          const { line } = diagnostic.file.getLineAndCharacterOfPosition(
            diagnostic.start,
          );
          return diagnostic.file.text
            .split('\n')
            .slice(line, line + 2)
            .join('\n');
        })
        .join('\n'),
  );
}

async function main() {
  const directory = fileURLToPath(new URL('../../', import.meta.url));
  const artifacts = join(directory, '.artifacts', 'package');
  await mkdir(artifacts, { recursive: true });
  const temporary = await mkdtemp(join(artifacts, 'check-'));
  function run(command, args, cwd = directory) {
    const result = spawnSync(command, args, {
      cwd,
      stdio: 'inherit',
      timeout: 120_000,
      env: process.env,
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${command} ${args.join(' ')} failed`);
  }

  try {
    let tokenVersion;
    let tokenCss;
    let tokenManifest;
    for (const name of ['tokens', 'vue']) {
      const archivePath = join(temporary, `${name}.tgz`);
      run(
        process.execPath,
        ['pm', 'pack', '--filename', archivePath],
        resolve(directory, '..', `ui-${name}`),
      );
      const archive = new Bun.Archive(await readFile(archivePath));
      const contents = await archive.files();
      const files = new Map(
        await Promise.all(
          [...contents].map(async ([path, file]) => [path, await file.text()]),
        ),
      );
      const manifest = checkArchive(files, `@warmsea/ui-${name}`, tokenVersion);
      const packed = await createConsumer(temporary, files);
      if (name === 'tokens') {
        tokenVersion = manifest.version;
        tokenCss = files.get('package/dist/style.css');
        tokenManifest = manifest;
        continue;
      }
      checkTokenReferences(
        tokenCss,
        files.get('package/dist/style.css'),
        files.get('package/dist/index.js'),
      );
      checkDeclarations(join(packed, manifest.exports['.'].types), {
        consumerDirectory: temporary,
        moduleSpecifier: '@warmsea/ui-vue',
      });
      await checkConsumerRuntime(temporary, manifest, tokenManifest);
    }
    console.log(
      `Packed artifacts: bare-name JS/types/CSS targets, public contracts, files, dependency metadata, styles, token references and Node import passed. TypeScript=${ts.version}, Bun=${Bun.version}. No consumer app or dependency installation.`,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (import.meta.main) await main();
