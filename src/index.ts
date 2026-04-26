import { App, LogLevel, SocketModeReceiver, ExpressReceiver } from '@slack/bolt';
import { config } from './config';
import './db'; // Initialize DB
import { handleMessageCreate } from './handlers/messageCreate';
import { handleAppMention } from './handlers/appMention';
import * as healthCmd from './commands/health';
import * as agentsCmd from './commands/agents';
import * as sessionCmd from './commands/session';
import { createExpressApp, startServer } from './server';
import { logger } from './services/logger';

// Create Express app for API routes
const expressApp = createExpressApp();

// Use Socket Mode if token is available, otherwise use Express Receiver
let receiver;
const socketModeToken = process.env.SLACK_SOCKET_MODE_TOKEN;

if (socketModeToken) {
  logger.info('Using Socket Mode receiver');
  receiver = new SocketModeReceiver({
    appToken: socketModeToken,
  });
} else {
  logger.info('Using Express receiver (webhook mode)');
  receiver = new ExpressReceiver({
    signingSecret: config.signingSecret,
    app: expressApp,
  });
}

// Create Bolt app
const app = new App({
  token: config.token,
  receiver,
  logLevel: LogLevel.DEBUG,
});

// Slash commands
app.command('/health', async (args) => {
  logger.info(`[SLASH] /health command received`);
  await healthCmd.handle(args);
});
app.command('/agents', async (args) => {
  logger.info(`[SLASH] /agents command received`);
  await agentsCmd.handle(args);
});
app.command('/session', async (args) => {
  logger.info(`[SLASH] /session command received`);
  await sessionCmd.handle(args);
});

// Event handlers
app.event('message', async (args) => {
  logger.info(`[EVENT] message received in ${args.event.channel}`);
  await handleMessageCreate(args);
});
app.event('app_mention', async (args) => {
  logger.info(`[EVENT] app_mention received in ${args.event.channel} from ${args.event.user}`);
  await handleAppMention(args);
});

// Start Slack app and HTTP server
(async () => {
  await app.start();
  logger.info('⚡️ Slack bot is running!');
  startServer(expressApp);

  // Display and verify public URL if configured (not needed for Socket Mode)
  if (socketModeToken) {
    logger.info('✅ Using Socket Mode — no public URL required');
  } else {
    const slackBotPublicUrl = process.env.SLACK_BOT_PUBLIC_URL;
    if (slackBotPublicUrl) {
      logger.info(`📍 Public URL: ${slackBotPublicUrl}`);

      // Verify the public URL is reachable
      try {
        const healthUrl = `${slackBotPublicUrl}/api/health`;
        const response = await fetch(healthUrl);
        if (response.ok) {
          logger.info(`✅ Public URL is reachable at ${healthUrl}`);
        } else {
          logger.warn(`⚠️ Public URL returned status ${response.status}`);
        }
      } catch (err) {
        logger.warn(`⚠️ Could not reach public URL at ${slackBotPublicUrl}: ${err}`);
      }
    } else {
      logger.info(
        '💡 Tip: Set SLACK_BOT_PUBLIC_URL environment variable to verify reachability and use update-manifest script'
      );
    }
  }
})();

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down...');
  process.exit(0);
});
