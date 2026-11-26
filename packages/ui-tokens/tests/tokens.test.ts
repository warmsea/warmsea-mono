// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

const css = await readFile(
  new URL('../src/index.css', import.meta.url),
  'utf8',
);
const manifest = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);

function color(role: string): number[] {
  const value = css
    .match(new RegExp(`--wui-color-${role}\\s*:\\s*([^;]+);`))?.[1]
    .trim();
  if (!value || !/^#[\da-f]{6}$/i.test(value)) {
    throw new Error(`--wui-color-${role} must be an opaque #RRGGBB default.`);
  }
  return [1, 3, 5].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16),
  );
}

describe('token contract', () => {
  it.each([
    ['text', 'surface', 4.5],
    ['text', 'surface-subtle', 4.5],
    ['error', 'surface', 4.5],
    ['error', 'surface-subtle', 4.5],
    ['on-primary', 'primary', 4.5],
    ['border', 'surface', 3],
    ['border', 'surface-subtle', 3],
    ['focus', 'surface', 3],
    ['focus', 'surface-subtle', 3],
  ] as const)(
    'default %s/%s contrast is at least %s:1',
    (foreground, background, minimum) => {
      expect(
        contrastRatio(color(foreground), color(background)),
      ).toBeGreaterThanOrEqual(minimum);
    },
  );

  it.each(['text', 'disabled-surface', 'disabled-text'])(
    'uses neutral defaults for %s',
    (role) => {
      const [red, green, blue] = color(role);
      expect(red).toBe(green);
      expect(green).toBe(blue);
    },
  );

  it('preserves public names without aliases, framework or document styling', () => {
    const names = [...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]);
    expect(names.sort()).toEqual(
      [
        'color-primary',
        'color-primary-hover',
        'color-primary-active',
        'color-primary-container',
        'color-primary-container-hover',
        'color-primary-container-active',
        'color-on-primary',
        'color-surface',
        'color-surface-hover',
        'color-surface-active',
        'color-surface-subtle',
        'color-surface-subtle-active',
        'color-subtle-hover',
        'color-subtle-active',
        'color-action-highlight',
        'color-text',
        'color-border',
        'color-focus',
        'color-error',
        'color-disabled-surface',
        'color-disabled-text',
        'space-1',
        'space-2',
        'space-3',
        'space-4',
        'space-5',
        'font-family',
        'font-size',
        'font-size-control',
        'font-size-heading-1',
        'font-size-heading-2',
        'font-size-heading-3',
        'font-size-heading-4',
        'font-size-heading-5',
        'font-size-heading-6',
        'font-weight',
        'font-weight-regular',
        'font-weight-semibold',
        'line-height',
        'line-height-control',
        'line-height-heading',
        'radius-control',
        'border-width',
        'focus-width',
        'focus-offset',
        'control-padding-block',
      ]
        .map((role) => `--wui-${role}`)
        .sort(),
    );
    expect(css.match(/^[^{}\s][^{]*\{/gm)).toEqual([':root {']);
    expect(css).not.toMatch(/@import|@font-face|url\(|!important/);
    for (const [, reference] of css.matchAll(/var\((--[\w-]+)/g)) {
      expect(names).toContain(reference);
    }
  });

  it('exports theme CSS without framework dependencies', () => {
    expect(manifest.exports).toEqual({ './style.css': './dist/style.css' });
    expect(manifest.dependencies).toBeUndefined();
    expect(manifest.peerDependencies).toBeUndefined();
    expect(css).toContain('--wui-color-primary: #0f766e');
  });
});
