import { copyFile, mkdir } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
await mkdir(dist, { recursive: true });
await copyFile(
  new URL('../src/index.css', import.meta.url),
  new URL('style.css', dist),
);
