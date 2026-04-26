import { SlackEventMiddlewareArgs } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { channelDb, conversationDb } from '../db';
import { logger } from '../services/logger';

export async function handleAppMention({
  event,
  say,
  body,
}: SlackEventMiddlewareArgs<'app_mention'>): Promise<void> {
  const eventData = event as any;
  const text = eventData.text || '';
  const user = eventData.user || '';
  const channel = eventData.channel || '';
  const token = (body as any).token;

  const channelInfo = channelDb.get(channel);
  if (!channelInfo) {
    logger.debug(`Channel ${channel} not registered for any agent`);
    await say('❌ This channel is not registered with an agent. Use `/agents` to register one.');
    return;
  }

  try {
    // Strip bot mention from text
    const cleanText = text.replace(/<@[^>]+>/g, '').trim();

    if (!cleanText) {
      await say('👋 I received your mention, but no message. Please provide a message.');
      return;
    }

    // Create Slack client to post message
    const client = new WebClient();
    // Post root message to channel (this creates the thread root)
    const result = await client.chat.postMessage({
      channel: channel,
      text: cleanText,
      token: token,
    });

    if (!result.ts) {
      logger.error('Failed to post message to create thread root');
      await say('❌ Failed to create conversation thread.');
      return;
    }

    // Register conversation with thread TS (timestamp of root message)
    conversationDb.register(result.ts, channel, channelInfo.agent_id, user);

    logger.info(`Created conversation ${result.ts} for agent ${channelInfo.agent_id}`);
    await say(`✅ Created conversation thread with ${channelInfo.agent_name}. Reply in this thread to continue.`);
  } catch (err) {
    logger.error(`Failed to create conversation: ${err}`);
    await say('❌ Failed to create conversation thread.');
  }
}
