import { WebClient } from '@slack/web-api';
import { config } from './config';

const client = new WebClient(config.token);

async function deployCommands() {
  try {
    console.log('Checking slash commands...');

    // Get bot app ID from manifest or use the token to fetch it
    const authResult = await client.auth.test();
    const botUserId = authResult.user_id;
    const teamId = authResult.team_id;

    console.log(`Bot User ID: ${botUserId}`);
    console.log(`Team ID: ${teamId}`);

    console.log('\n📋 Slash commands configured:');
    console.log('  - /health: Check bot health');
    console.log('  - /agents [list|new <id>|disconnect [id]|readonly <id> <on|off>]: Manage agents');
    console.log('  - /session new [name]: Start a new agent session');

    console.log('\n🚀 Setup options:');
    console.log('\n1️⃣  SOCKET MODE (recommended for development):');
    console.log(`   Visit: https://app.slack.com/app-settings/${teamId}/${config.appId}/socket-mode`);
    console.log('   - Enable "Socket Mode"');
    console.log('   - Copy the token and add to .env: SLACK_SOCKET_MODE_TOKEN=xapp-...');
    console.log('   - Run: npm run update-manifest');
    console.log(`   - Update manifest in Slack: https://app.slack.com/app-settings/${teamId}/${config.appId}/app-manifest`);
    console.log('   - Run: npm run dev');

    console.log('\n2️⃣  WEBHOOK MODE (for production):');
    console.log('   - Set SLACK_BOT_PUBLIC_URL to your deployment URL');
    console.log('   - Run: npm run update-manifest');
    console.log(`   - Update manifest in Slack: https://app.slack.com/app-settings/${teamId}/${config.appId}/app-manifest`);
    console.log('   - Reinstall app in Slack workspace');
    console.log('   - Run: npm start');

    console.log('\n✅ Check complete');
  } catch (err) {
    console.error('Failed to check commands:', err);
    process.exit(1);
  }
}

deployCommands();
