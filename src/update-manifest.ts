import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { config } from './config';

dotenv.config();

const SLACK_SOCKET_MODE_TOKEN = process.env.SLACK_SOCKET_MODE_TOKEN;
let SLACK_BOT_PUBLIC_URL = process.env.SLACK_BOT_PUBLIC_URL;

if (SLACK_SOCKET_MODE_TOKEN) {
  SLACK_BOT_PUBLIC_URL = 'http://example.org/unused-in-socket-mode';
  console.log('📡 Socket Mode detected — using placeholder URL');
} else if (!SLACK_BOT_PUBLIC_URL) {
  console.error('❌ Neither SLACK_BOT_PUBLIC_URL nor SLACK_SOCKET_MODE_TOKEN is configured');
  console.error('\nChoose one:');
  console.error('1. Production (webhook mode):');
  console.error('   SLACK_BOT_PUBLIC_URL=http://your-domain:3457 npm run update-manifest');
  console.error('\n2. Development (Socket Mode):');
  const teamId = config.teamId || '{SLACK_TEAM_ID}';
  console.error(`   1. Enable Socket Mode: https://app.slack.com/app-settings/${teamId}/${config.appId}/socket-mode`);
  console.error('   2. Copy the app token to .env: SLACK_SOCKET_MODE_TOKEN=xapp-...');
  console.error('   3. Run: npm run update-manifest');
  process.exit(1);
}

try {
  const templatePath = path.join(__dirname, '../templates/app_manifest.json');
  const manifestPath = path.join(__dirname, '../app_manifest.json');

  // Read template
  let manifestContent = fs.readFileSync(templatePath, 'utf-8');

  // Replace placeholder with actual public URL
  const placeholder = '{{SLACK_BOT_PUBLIC_URL}}';
  manifestContent = manifestContent.replace(new RegExp(placeholder, 'g'), SLACK_BOT_PUBLIC_URL as string);

  const manifest = JSON.parse(manifestContent);

  // Write to root directory
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + '\n');

  const absolutePath = path.resolve(manifestPath);
  console.log('✅ Manifest updated successfully');
  console.log(`   Path: ${absolutePath}`);
  console.log(`   Slack Bot Public URL: ${SLACK_BOT_PUBLIC_URL}`);
  console.log('\nNext steps:');
  const teamId = config.teamId || '{SLACK_TEAM_ID}';
  console.log(`1. Update app manifest in Slack: https://app.slack.com/app-settings/${teamId}/${config.appId}/app-manifest`);
  console.log('2. Reinstall the app to your workspace to apply changes');
  if (!SLACK_SOCKET_MODE_TOKEN) {
    console.log(`\n💡 For development: Use Socket Mode instead: https://app.slack.com/app-settings/${teamId}/${config.appId}/socket-mode`);
  }
} catch (err) {
  console.error('❌ Failed to update manifest:', err);
  process.exit(1);
}
