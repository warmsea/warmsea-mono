import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import { fileURLToPath } from 'node:url';
import { availableBun } from '../../../scripts/workspaces.mjs';

const directory = fileURLToPath(new URL('../', import.meta.url));
const bun = availableBun();
const browserArgs =
  platform() === 'win32'
    ? []
    : ['--project', 'chromium', '--project', 'firefox', '--project', 'webkit'];

for (const args of [['check:code'], ['test:browsers', ...browserArgs]]) {
  const result = spawnSync(bun, ['run', ...args], {
    cwd: directory,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
