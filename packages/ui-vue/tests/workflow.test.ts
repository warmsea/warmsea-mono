// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('focused inventory includes both configured documentation regression files', () => {
  const output = execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../scripts/check-workspace.mjs', import.meta.url)),
      'select',
      'docs',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  expect(JSON.parse(output).sort()).toEqual([
    'docs/commands.test.ts',
    'docs/token-reference.test.ts',
  ]);
});
