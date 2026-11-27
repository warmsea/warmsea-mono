import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const directory = fileURLToPath(new URL('../', import.meta.url));
const runId = process.env.WUI_AI_RUN_ID ?? randomUUID();
const server = await createServer({
  root: directory,
  cacheDir: fileURLToPath(
    new URL(`../.artifacts/browser/${runId}/vite-cache/`, import.meta.url),
  ),
  server: {
    host: '127.0.0.1',
    port: 0,
    strictPort: true,
    watch: { ignored: ['**/.artifacts/**', '**/dist/**'] },
  },
});
try {
  await server.listen();
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  assert.ok((await fetch(url)).ok);
  console.log(`WUI_AI_URL=${url} RUN_ID=${runId} PID=${process.pid}`);
} catch (error) {
  await server.close();
  throw error;
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => void server.close().then(() => process.exit(0)));
