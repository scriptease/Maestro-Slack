# Maestro-Slack

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
   - Upload `app_manifest.json` (or copy-paste the manifest)
   - Install to your workspace
   - Copy bot token and signing secret

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Slack credentials:
   # SLACK_BOT_TOKEN=xoxb-...
   # SLACK_SIGNING_SECRET=...
   # SLACK_APP_ID=...
   ```

4. **Run in development**
   ```bash
   npm run dev
   ```
   This starts the bot with hot-reload via `tsx`.

5. **Deploy to Slack**
   - Get your public HTTPS URL (e.g., from ngrok, Railway, Render)
   - In Slack app settings → Event Subscriptions
   - Set Request URL to `https://your-domain.com/slack/events`
   - Slack will verify the request

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
SLACK_BOT_TOKEN          # xoxb-... token
SLACK_SIGNING_SECRET     # Signing secret from app settings
SLACK_APP_ID             # App ID
SLACK_ALLOWED_USER_IDS   # Comma-separated list (optional)
API_PORT                 # Default: 3457
```

## Testing

```bash
npm test
```

Tests use Node.js built-in test runner (`node --test`).

## Deployment

### Production Setup
1. Deploy app to production server (e.g., Railway, Render, DigitalOcean)
2. Set event subscription URL in Slack app settings
3. Configure environment variables on server
4. Run: `npm install && npm run build && npm start`

### Monitoring
- Check logs for errors
- Monitor `/api/health` endpoint
- Verify messages are reaching agents

## Contributing

- Follow existing code patterns in `src/`
- Keep changes minimal and focused
- Update docs when behavior changes
- Run `npm run build` before committing

## License

MIT
