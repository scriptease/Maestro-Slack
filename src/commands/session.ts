import { SlackCommandMiddlewareArgs } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { config } from '../config';
import { listAgents } from '../services/maestro';
import { logger } from '../services/logger';
import { channelDb, conversationDb } from '../db';

export async function handle({
  ack,
  say,
  command,
}: SlackCommandMiddlewareArgs): Promise<void> {
  logger.info('[SESSION] Handler executing');
  ack();

  try {
    const [subcommand, ...args] = (command.text || '').trim().split(/\s+/);

    switch (subcommand?.toLowerCase()) {
      case 'new':
        await handleNew(say, command.channel_id, args[0], command.user_id);
        break;
      default:
        await say(`Unknown subcommand: \`${subcommand}\`. Try: \`new [session-name]\``);
    }
  } catch (err) {
    logger.error(`[SESSION] Failed: ${err}`);
    await say('❌ Failed to execute session command.');
  }
}

async function handleNew(
  say: any,
  channelId: string,
  sessionName: string | undefined,
  userId?: string
): Promise<void> {
  logger.info(`[SESSION:NEW] Creating new session in channel ${channelId}`);

  try {
    // Get the agent registered for this channel
    const agentChannel = channelDb.get(channelId);
    if (!agentChannel) {
      await say('❌ No agent is registered in this channel. Use `/agents new <agent-id>` first.');
      return;
    }

    const agentId = agentChannel.agent_id;
    const agentName = agentChannel.agent_name;

    logger.info(`[SESSION:NEW] Creating session for agent ${agentName} (${agentId})`);

    // Post the session starter message to the channel
    const client = new WebClient(config.token);
    const sessionLabel = sessionName ? ` — ${sessionName}` : '';
    const msgRes = await client.chat.postMessage({
      channel: channelId,
      text: `🤖 *${agentName}* — ready for a new session${sessionLabel}.\nType your first message to begin. This thread is linked to a dedicated Maestro session.\nOnly <@${userId}> can interact with the agent in this thread.`,
    });

    if (!msgRes.ts) {
      logger.error(`[SESSION:NEW] Failed to post message: ${JSON.stringify(msgRes)}`);
      await say('❌ Failed to create session message.');
      return;
    }

    const threadTs = msgRes.ts;
    logger.info(`[SESSION:NEW] Posted message with ts ${threadTs}`);

    // Register the conversation with a session
    // For now, use the agentId as session (this will be updated when user responds)
    conversationDb.register(threadTs, channelId, agentId, userId || null);
    logger.info(`[SESSION:NEW] Registered conversation ${threadTs}`);

    // Post success in thread
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: `Session ready. Send your first message here to start.`,
    });

    logger.info(`[SESSION:NEW] Session created successfully`);
  } catch (err) {
    logger.error(`[SESSION:NEW] Failed: ${err}`);
    await say('❌ Failed to create session.');
  }
}
