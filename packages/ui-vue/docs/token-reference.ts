import source from '../../ui-tokens/src/index.css?raw';

export const tokens = [
  ...source.matchAll(/(--wui-[\w-]+)\s*:\s*([^;]+);/g),
].map(([, name, value]) => ({ name, value: value.trim() }));

export function tokensWithPrefix(prefix: string) {
  return tokens.filter((token) => token.name.startsWith(prefix));
}

export function tokenValue(name: string): string {
  const token = tokens.find((entry) => entry.name === name);
  if (!token) throw new Error(`Unknown Warmsea token: ${name}`);
  return token.value;
}
