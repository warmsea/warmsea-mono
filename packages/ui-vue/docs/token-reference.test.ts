import { describe, expect, it } from 'vitest';
import { tokens, tokensWithPrefix, tokenValue } from './token-reference';

describe('Storybook token reference', () => {
  it('reads the actual token source without duplicate definitions', () => {
    expect(tokens.length).toBeGreaterThan(20);
    expect(new Set(tokens.map((token) => token.name)).size).toBe(tokens.length);
    expect(tokenValue('--wui-color-primary')).toBe('#0f766e');
    expect(tokensWithPrefix('--wui-space-').map((token) => token.name)).toEqual(
      [1, 2, 3, 4, 5].map((step) => `--wui-space-${step}`),
    );
  });

  it('fails explicitly when documentation references an unknown token', () => {
    expect(() => tokenValue('--wui-missing')).toThrow(
      'Unknown Warmsea token: --wui-missing',
    );
  });
});
