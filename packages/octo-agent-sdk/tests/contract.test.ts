import { expect, test } from 'vitest';
import { parseTurnEvent } from '../src/contract.js';

test('invalid approval and terminal payloads report paths but never payload values', () => {
  expect(() =>
    parseTurnEvent({
      type: 'approval.requested',
      action: 'private',
      choices: ['yes'],
    }),
  ).toThrow(/requestId/);
  expect(() => parseTurnEvent({ type: 'private' })).not.toThrow(/private/);
  expect(() => parseTurnEvent({ type: 'failed' })).toThrow(/error/);
});
