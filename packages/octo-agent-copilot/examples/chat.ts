import { CopilotAgentProvider } from '@warmsea/octo-agent-copilot';

const provider = new CopilotAgentProvider({ cwd: process.cwd() });
if (process.argv.length < 3) {
  console.log(await provider.describe());
} else {
  const session = await provider.open({ branch: 'example', start: 'fresh' });
  try {
    let parentTurnId: string | null = null;
    for (const [i, input] of process.argv.slice(2).entries()) {
      const turnId = String(i + 1);
      for await (const e of session.prompt({ turnId, parentTurnId, input })) {
        if (e.type === 'text.delta') process.stdout.write(e.text);
        else if (e.type === 'approval.requested') await session.cancel(turnId);
        else if (e.type === 'failed') throw Error(e.error.message);
        else if (e.type === 'cancelled') throw Error('Turn cancelled');
      }
      process.stdout.write('\n');
      parentTurnId = turnId;
    }
  } finally {
    await session.close();
  }
}
