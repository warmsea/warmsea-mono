import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { schemas } from '../dist/contract.js';
const { properties, $defs } = z.toJSONSchema(z.object(schemas), {
  io: 'input',
});
const defs = { ...properties, ...$defs };
await mkdir('dist/schemas', { recursive: true });
await writeFile(
  'dist/schemas/octo.agent.v1.json',
  JSON.stringify(
    { $schema: 'https://json-schema.org/draft/2020-12/schema', $defs: defs },
    null,
    2,
  ) + '\n',
);
