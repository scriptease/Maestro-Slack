import { SlackCommandMiddlewareArgs } from '@slack/bolt';
import { logger } from '../services/logger';

export async function handle({ ack, say }: SlackCommandMiddlewareArgs): Promise<void> {
  logger.info('[HEALTH] Handler executing');
  ack();
  logger.info('[HEALTH] Sending response');
  await say('✅ Maestro bot is healthy and running!');
  logger.info('[HEALTH] Response sent');
}
