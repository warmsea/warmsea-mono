// Offline ACP peer. The parent chooses a fixed scenario, never a shell command.
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';
const [scenario, ...args] = process.argv.slice(2);
assert.deepEqual(args, ['--acp', '--stdio']);
const write = (msg) =>
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
const reply = (id, result) => write({ id, result });
const sessionId = 'local-agent';
const update = (data) =>
  write({ method: 'session/update', params: { sessionId, update: data } });
let promptId;
for await (const line of createInterface({ input: process.stdin })) {
  const m = JSON.parse(line);
  if (m.method === 'initialize') {
    assert.deepEqual(m.params.clientCapabilities, {});
    reply(m.id, {
      protocolVersion:
        scenario === 'incompatible' ? 999 : m.params.protocolVersion,
      agentCapabilities: {},
      authMethods: [],
    });
  } else if (m.method === 'session/new') {
    assert.deepEqual(m.params.mcpServers, []);
    assert.equal(m.params.cwd, process.cwd());
    if (scenario === 'auth')
      write({
        id: m.id,
        error: { code: -32000, message: 'sensitive-credential-placeholder' },
      });
    else reply(m.id, { sessionId });
  } else if (m.method === 'session/prompt') {
    assert.equal(m.params.sessionId, sessionId);
    assert.equal(m.params.prompt.length, 1);
    promptId = m.id;
    const text = m.params.prompt[0].text;
    update({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text },
    });
    if (text === 'loss') process.exit(7);
    if (text === 'wait') continue;
    if (text === 'malformed') {
      reply(m.id, null);
      continue;
    }
    if (text === 'approval') {
      update({
        sessionUpdate: 'tool_call',
        toolCallId: 'read',
        title: 'Read config',
        rawInput: { path: 'example.txt' },
        status: 'pending',
      });
      write({
        id: 99,
        method: 'session/request_permission',
        params: {
          sessionId,
          toolCall: { toolCallId: 'read', title: 'Read config' },
          options: [
            { optionId: 'x', name: 'Allow', kind: 'allow_once' },
            { optionId: 'y', name: 'Allow', kind: 'allow_always' },
          ],
        },
      });
    } else
      reply(m.id, { stopReason: text === 'limit' ? 'max_tokens' : 'end_turn' });
  } else if (m.id === 99) {
    if (m.result.outcome.outcome === 'selected') {
      assert.equal(m.result.outcome.optionId, 'x');
      reply(promptId, { stopReason: 'end_turn' });
    }
  } else if (m.method === 'session/cancel' && scenario !== 'stalled')
    reply(promptId, { stopReason: 'cancelled' });
}
