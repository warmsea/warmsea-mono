import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';
import { ProviderError, type TurnEvent } from '@warmsea/octo-agent-sdk';
import { openCopilotSession } from '../src/copilot-agent-session.js';
import { Permissions } from '../src/permissions.js';
function open(scenario = 'ok') {
  const script = fileURLToPath(new URL('./fixtures/peer.mjs', import.meta.url));
  return openCopilotSession(
    'branch',
    { cwd: process.cwd(), executable: process.execPath },
    (file, args, options) => spawn(file, [script, scenario, ...args], options),
  );
}
test('concurrent and stale prompts never start another turn', async () => {
  const s = await open();
  try {
    const request = { turnId: '1', parentTurnId: null, input: 'wait' };
    for await (const e of s.prompt(request)) {
      if (e.type === 'text.delta') {
        await expect(
          s
            .prompt({ ...request, turnId: '2' })
            [Symbol.asyncIterator]()
            .next(),
        ).rejects.toMatchObject({ code: 'conflict' });
        await s.cancel('1');
      }
    }
  } finally {
    await s.close();
  }
  const fresh = await open();
  try {
    await expect(
      fresh
        .prompt({ turnId: '2', parentTurnId: '1', input: 'stale' })
        [Symbol.asyncIterator]()
        .next(),
    ).rejects.toMatchObject({ code: 'conflict' });
  } finally {
    await fresh.close();
  }
});
test('ambiguous permission choices never reach a decision maker', async () => {
  const option = {
    optionId: 'first',
    name: 'Allow',
    kind: 'allow_once',
  } as const;
  const result = await new Permissions().request(
    {
      sessionId: 's',
      toolCall: { toolCallId: 'read', rawInput: { path: 'example.txt' } },
      options: [option, { ...option, optionId: 'second' }],
    },
    () => {
      throw Error('Unexpected approval');
    },
  );
  expect(result).toEqual({ outcome: { outcome: 'cancelled' } });
});
test('two prompts share an ACP session and forward the exact single-use approval option', async () => {
  const s = await open();
  try {
    const events: TurnEvent[] = [];
    for await (const e of s.prompt({
      input: 'approval',
      turnId: '1',
      parentTurnId: null,
    })) {
      events.push(e);
      if (e.type === 'approval.requested') {
        expect(e.action).toContain('example.txt');
        const choice = e.choices.find((v) => v.includes('allow_once'))!;
        await s.decide!({ turnId: '1', requestId: e.requestId, choice });
        await s.decide!({ turnId: '1', requestId: e.requestId, choice });
        await expect(
          s.decide!({
            turnId: '1',
            requestId: e.requestId,
            choice: e.choices[1],
          }),
        ).rejects.toMatchObject({ code: 'conflict' });
      }
    }
    expect(events.map((e) => e.type)).toEqual([
      'text.delta',
      'tool.updated',
      'approval.requested',
      'completed',
    ]);
    expect(s.binding.tip).toBe('1');
    const result = [];
    for await (const e of s.prompt({
      input: 'again',
      turnId: '2',
      parentTurnId: '1',
    }))
      result.push(e);
    expect(result).toEqual([
      { type: 'text.delta', text: 'again' },
      { type: 'completed' },
    ]);
  } finally {
    await s.close();
  }
});
test.each([
  ['auth', 'auth_required'],
  ['incompatible', 'unsupported'],
])('sanitizes %s startup failure', async (scenario, code) => {
  const e = await open(scenario).catch((error: unknown) => error);
  expect(e).toBeInstanceOf(ProviderError);
  expect(e).toMatchObject({ code });
  expect(String(e)).not.toContain('placeholder');
  if (code === 'auth_required') expect(String(e)).toMatch(/copilot login/);
});
test.each([
  ['wait', 'cancelled'],
  ['limit', 'failed'],
  ['loss', 'failed'],
  ['malformed', 'failed'],
  ['stalled', 'failed'],
])('does not report normal completion for %s', async (input, type) => {
  const s = await open(input === 'stalled' ? 'stalled' : 'ok');
  const events = [];
  try {
    for await (const e of s.prompt({
      input: input === 'stalled' ? 'wait' : input,
      turnId: 'x',
      parentTurnId: null,
    })) {
      events.push(e);
      if ((input === 'wait' || input === 'stalled') && e.type === 'text.delta')
        await s.cancel('x');
    }
    expect(events.at(-1)?.type).toBe(type);
    if (['loss', 'stalled', 'malformed'].includes(input))
      expect(events.at(-1)).toMatchObject({
        error: { code: 'outcome_unknown' },
      });
    expect(s.binding.tip).toBeNull();
  } finally {
    await s.close();
  }
});
test('connection loss clears a pending permission without authorizing or resubmitting', async () => {
  const s = await open();
  const loss = new AbortController();
  try {
    const events = [];
    for await (const e of s.prompt(
      { input: 'approval', turnId: 't', parentTurnId: null },
      loss.signal,
    )) {
      events.push(e);
      if (e.type === 'approval.requested') {
        await expect(
          s.decide!({
            turnId: 'other',
            requestId: e.requestId,
            choice: e.choices[0],
          }),
        ).rejects.toMatchObject({ code: 'conflict' });
        loss.abort();
      }
    }
    expect(events.at(-1)).toMatchObject({
      type: 'failed',
      error: { code: 'outcome_unknown' },
    });
  } finally {
    await s.close();
  }
});
