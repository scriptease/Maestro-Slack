import { channelDb, conversationDb } from '../db';
import { sendToAgent } from './maestro';
import { logger } from './logger';

export interface QueuedMessage {
  text: string;
  channel: string;
  thread_ts: string;
  message_ts: string;
  user: string;
  agent_id: string;
  files?: Array<{ name: string; url: string }>;
}

const queues = new Map<string, QueuedMessage[]>();
const processing = new Set<string>();

export function enqueue(message: QueuedMessage): void {
  const key = `${message.channel}:${message.thread_ts}`;
  if (!queues.has(key)) {
    queues.set(key, []);
  }
  queues.get(key)!.push(message);
  processQueue(key);
}

async function processQueue(key: string): Promise<void> {
  if (processing.has(key)) return;
  processing.add(key);

  const queue = queues.get(key);
  if (!queue || queue.length === 0) {
    processing.delete(key);
    return;
  }

  while (queue.length > 0) {
    const message = queue.shift()!;

    try {
      await sendToAgent(message);
    } catch (err) {
      logger.error(`Failed to send message to agent: ${err}`);
    }
  }

  processing.delete(key);
}
