# Maestro-Slack

## Acknowledgments

This project is based on the architecture and design patterns from [Maestro-Discord](https://github.com/RunMaestro/Maestro-Discord), developed by [Chris](https://github.com/chr1syy). Maestro-Slack adapts these proven patterns for Slack integration, enabling seamless communication between Slack channels and Maestro agents.

A Slack bot that bridges messages to Maestro agents via `maestro-cli`.

## Quick Start

### Prerequisites
- Node.js 20+
- Slack workspace admin access
- `maestro-cli` installed and configured

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create Slack app**
   - Go to https://api.slack.com/apps
   - Click "Create New App"
   - Choose "From scratch" or use manifest
   - Copy your App ID and Bot Token

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Slack credentials:
   # SLACK_BOT_TOKEN=xoxb-...
   # SLACK_SIGNING_SECRET=...
   # SLACK_APP_ID=...
   # SLACK_TEAM_ID=... (from workspace settings)
   ```

4. **Generate app manifest** (required for both setup paths)
   ```bash
   npm run update-manifest
   ```
   This creates `app_manifest.json` from the template with your configuration.

5. **Choose your setup path:**

   **Option A: Socket Mode (Development - Recommended)**
   - Visit: `https://app.slack.com/app-settings/{TEAM_ID}/{APP_ID}/socket-mode`
   - Enable "Socket Mode"
   - Copy the token and add to `.env`: `SLACK_SOCKET_MODE_TOKEN=xapp-...`
   - Run: `npm run dev`
   - No public URL needed, works locally

   **Option B: Webhook Mode (Production)**
   - Upload the generated `app_manifest.json` to Slack app settings
   - Set `SLACK_BOT_PUBLIC_URL` to your deployment URL
   - Run: `npm run update-manifest` to regenerate manifest
   - Upload updated manifest to Slack
   - Get your public HTTPS URL (e.g., from ngrok, Railway, Render)
   - In Slack app settings → Event Subscriptions
   - Set Request URL to `https://your-domain.com/slack/events`
   - Run: `npm start`

## Development Workflow

- **Build:** `npm run build`
- **Start:** `npm start`
- **Dev:** `npm run dev`
- **Test:** `npm test` (when tests are added)

## Project Structure

```
src/
├── config.ts                 # Environment configuration
├── db/
│   └── index.ts             # SQLite database (channels, conversations)
├── services/
│   ├── maestro.ts           # maestro-cli wrapper
│   ├── queue.ts             # Message queue per conversation
│   └── logger.ts            # Logging
├── handlers/
│   ├── messageCreate.ts     # Handle messages in threads
│   └── appMention.ts        # Handle @Maestro mentions
├── commands/
│   ├── health.ts            # /health command
│   └── agents.ts            # /agents command (list & register)
├── server.ts                # HTTP API server
├── index.ts                 # Main entry point
└── cli/
    └── maestro-slack.ts     # CLI tool
```

## Database

SQLite database (`maestro-bot.db`) stores:
- **agent_channels**: Channel ↔ Agent mappings
- **agent_conversations**: Thread ↔ Agent conversations (thread_ts = timestamp)

## HTTP API

Local API on `127.0.0.1:3457`:
- `GET /api/health` — Health check
- `POST /api/send` — Send message to agent (future)

## Slack Bot Flow

### 1. Register Channel with Agent
```
User: /agents
Bot: Lists available agents
User: (Administrator) registers channel with agent
```

### 2. Start Conversation
```
User: @Maestro What's the status?
Bot: Creates thread root message, registers conversation
User: (replies in thread)
Bot: Forwards message to agent
Agent: Responds via maestro-cli send
Bot: Posts agent response in thread
```

## Architecture Notes

- **Queue**: Per-conversation FIFO queue ensures ordered message processing
- **Threads**: Slack threads identified by root message timestamp (`thread_ts`)
- **Ownership**: Only the user who started the conversation can message in that thread
- **Maestro Integration**: Messages forwarded to maestro agents via `maestro-cli send`

## Differences from Maestro-Discord

- **Threading**: Slack uses message timestamps; Discord uses explicit thread IDs
- **Mentions**: Discord creates threads on mention automatically; Slack requires slash commands
- **Auth**: Slack uses signing secret verification; Discord uses gateway auth
- **Library**: @slack/bolt vs discord.js

See `research/` folder for detailed comparison.

## Troubleshooting

### Verify Setup
First, run the diagnostic command to check your configuration:
```bash
npm run doctor
```
This verifies your slash commands, provides setup guidance, and shows direct links to Slack app settings.

### Bot not responding to messages
- Check SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET in `.env`
- Verify channel is registered with `/agents` command
- Check logs: `npm run dev`

### Threads not created
- Ensure bot has `chat:write` scope in app manifest
- Check that channel is registered with an agent
- Look for errors in logs

### "Request verification failed"
- Verify SLACK_SIGNING_SECRET is correct
- Check that timestamp is within 5 minutes (Slack security requirement)

## Environment Variables

```
SLACK_BOT_TOKEN              # xoxb-... token
SLACK_SIGNING_SECRET         # Signing secret from app settings
SLACK_APP_ID                 # App ID from app settings
SLACK_TEAM_ID                # Workspace Team ID (from workspace settings)
SLACK_SOCKET_MODE_TOKEN      # xapp-... token (for Socket Mode development)
SLACK_BOT_PUBLIC_URL         # Public URL (for webhook mode production)
SLACK_ALLOWED_USER_IDS       # Comma-separated list (optional)
API_PORT                     # Default: 3457
```

### Setup Modes

- **Socket Mode** (`SLACK_SOCKET_MODE_TOKEN` set): Uses WebSocket for local development, no public URL needed
- **Webhook Mode** (`SLACK_BOT_PUBLIC_URL` set): Uses HTTP webhooks for production deployment

## Testing

```bash
npm test
```

Tests use Node.js built-in test runner (`node --test`).

## Deployment

### Production Setup (Webhook Mode)
1. Set `SLACK_BOT_PUBLIC_URL` to your deployment domain
2. Run: `npm run update-manifest` to generate manifest with your URL
3. Upload generated `app_manifest.json` to Slack app settings
4. Deploy app to production server (e.g., Railway, Render, DigitalOcean)
5. Configure environment variables on server (all required ENV vars)
6. Run: `npm install && npm run build && npm start`

### Development Setup (Socket Mode)
1. Enable Socket Mode in Slack app settings
2. Copy token and set `SLACK_SOCKET_MODE_TOKEN` in `.env`
3. Run: `npm run doctor` to verify setup
4. Run: `npm run dev` to start with hot-reload

### Verification
```bash
npm run doctor
```
This checks your slash commands configuration and provides setup guidance.

### Monitoring
- Check logs for errors
- Monitor `/api/health` endpoint
- Verify messages are reaching agents
- Run `npm run doctor` periodically to verify configuration

## Contributing

- Follow existing code patterns in `src/`
- Keep changes minimal and focused
- Update docs when behavior changes
- Run `npm run build` before committing

## License

MIT
