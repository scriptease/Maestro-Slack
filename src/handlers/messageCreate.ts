import { SlackEventMiddlewareArgs } from '@slack/bolt';
import { conversationDb } from '../db';
import { enqueue } from '../services/queue';
import { logger } from '../services/logger';

export async function handleMessageCreate({ event }: SlackEventMiddlewareArgs<'message'>): Promise<void> {
  // Ignore bot messages and empty messages
  if ((event as any).bot_id || !(event as any).text?.trim()) {
    return;
  }

  const threadTs = (event as any).thread_ts;
  const text = (event as any).text;
  const user = (event as any).user;
  const channel = (event as any).channel;

  // Only process messages in threads (where we have context)
  if (!threadTs) {
    logger.debug(`Ignoring non-thread message in ${channel}`);
    return;
  }

  const convo = conversationDb.get(threadTs);
  if (!convo) {
    logger.debug(`Thread ${threadTs} not registered, ignoring`);
    return;
  }

  // Verify user ownership (only original thread starter can message)
  if (convo.owner_user_id && convo.owner_user_id !== user) {
    logger.debug(`User ${user} not authorized for thread ${threadTs}`);
    return;
  }

  // Queue message for processing
  const message_ts = (event as any).ts;
  enqueue({
    text,
    channel: channel || '',
    thread_ts: threadTs,
    message_ts: message_ts,
    user: user || '',
    agent_id: convo.agent_id,
  });
}
