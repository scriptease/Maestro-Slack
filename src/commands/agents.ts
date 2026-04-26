import { SlackCommandMiddlewareArgs } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { config } from '../config';
import { listAgents } from '../services/maestro';
import { logger } from '../services/logger';
import { channelDb } from '../db';

export async function handle({
  ack,
  say,
  command,
}: SlackCommandMiddlewareArgs): Promise<void> {
  logger.info('[AGENTS] Handler executing');
  ack();

  try {
    const [subcommand, ...args] = (command.text || '').trim().split(/\s+/);

    switch (subcommand?.toLowerCase()) {
      case 'new':
        await handleNew(say, command.channel_id, args[0], command.user_id);
        break;
      case 'disconnect':
        await handleDisconnect(say, command.channel_id, args[0]);
        break;
      case 'readonly':
        await handleReadonly(say, command.channel_id, args[0], args[1]);
        break;
      case 'list':
      case '':
        await handleList(say);
        break;
      default:
        await say(
          `Unknown subcommand: \`${subcommand}\`. Try: \`list\`, \`new\`, \`disconnect\`, \`readonly\``
        );
    }
  } catch (err) {
    logger.error(`[AGENTS] Failed: ${err}`);
    await say('❌ Failed to execute agents command.');
  }
}

async function handleList(say: any): Promise<void> {
  logger.info('[AGENTS:LIST] Listing agents');
  const agents = await listAgents();

  if (agents.length === 0) {
    await say('No agents available.');
    return;
  }

  const blocks: any[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Available Maestro Agents:*',
      },
    },
  ];

  for (const agent of agents) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `• *${agent.name}* (\`${agent.id}\`)`,
      },
    });
  }

  blocks.push({
    type: 'divider',
  });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Register an agent:* `/agents new <agent-id>`\n*Unregister:* `/agents disconnect <agent-id>`\n*Toggle read-only:* `/agents readonly <agent-id> <on|off>`',
    },
  });

  logger.info('[AGENTS:LIST] Sending response');
  await say({ blocks });
}

async function handleNew(
  say: any,
  channelId: string,
  agentId: string | undefined,
  userId?: string
): Promise<void> {
  logger.info(`[AGENTS:NEW] Creating channel for agent ${agentId}`);

  if (!agentId) {
    await say('❌ Usage: `/agents new <agent-id>`');
    return;
  }

  try {
    logger.info(`[AGENTS:NEW] Listing agents`);
    const agents = await listAgents();
    logger.info(`[AGENTS:NEW] Found ${agents.length} agents`);

    // Try to find by ID first, then by name
    logger.info(`[AGENTS:NEW] Searching for agent: ${agentId}`);
    logger.info(`[AGENTS:NEW] Available agents: ${agents.map((a) => `${a.name}(${a.id})`).join(', ')}`);

    let agent = agents.find((a) => a.id === agentId);
    logger.info(`[AGENTS:NEW] Agent lookup by ID: ${agent ? 'found' : 'not found'}`);

    if (!agent) {
      agent = agents.find((a) => a.name.toLowerCase() === agentId?.toLowerCase());
      logger.info(`[AGENTS:NEW] Agent lookup by name: ${agent ? 'found' : 'not found'}`);
    }

    if (!agent) {
      logger.error(`[AGENTS:NEW] Agent not found. Searched for: ${agentId}`);
      await say(`❌ Agent \`${agentId}\` not found. Use \`/agents list\` to see available agents.`);
      return;
    }

    logger.info(`[AGENTS:NEW] Found agent: ${agent.name} (${agent.id})`);

    // Create or reuse Slack channel for this agent
    const client = new WebClient(config.token);
    const sanitizedName = agent.name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 70);

    const channelName = `maestro-${sanitizedName}`;

    logger.info(`[AGENTS:NEW] Looking for existing channel ${channelName}`);

    // Try to find existing channel
    let newChannelId: string | undefined;
    let isArchived = false;

    try {
      const listRes = await client.conversations.list({
        exclude_archived: false,
        types: 'public_channel',
        limit: 1000,
      });

      const existingChannel = listRes.channels?.find(
        (ch) => ch.name === channelName
      );

      if (existingChannel?.id) {
        logger.info(`[AGENTS:NEW] Found existing channel ${existingChannel.id}, is_archived: ${existingChannel.is_archived}`);
        newChannelId = existingChannel.id;
        isArchived = existingChannel.is_archived ?? false;
      }
    } catch (err) {
      logger.error(`[AGENTS:NEW] Failed to list channels: ${err}`);
    }

    // Create new channel if not found
    if (!newChannelId) {
      logger.info(`[AGENTS:NEW] Creating new channel ${channelName}`);
      const channelRes = await client.conversations.create({
        name: channelName,
        is_private: false,
      });
      logger.info(`[AGENTS:NEW] Channel creation response: ${JSON.stringify(channelRes.channel?.id)}`);

      if (!channelRes.channel?.id) {
        logger.error(`[AGENTS:NEW] Channel creation failed: ${JSON.stringify(channelRes)}`);
        await say('❌ Failed to create channel for agent.');
        return;
      }

      newChannelId = channelRes.channel.id;
    }
    logger.info(`[AGENTS:NEW] Channel created: ${newChannelId}`);

    // Unarchive if needed (before inviting)
    if (isArchived) {
      logger.info(`[AGENTS:NEW] Unarchiving channel ${newChannelId}`);
      try {
        await client.conversations.unarchive({
          channel: newChannelId,
        });
        logger.info(`[AGENTS:NEW] Channel unarchived`);
      } catch (unarchiveErr) {
        logger.warn(`[AGENTS:NEW] Failed to unarchive channel: ${unarchiveErr}`);
        logger.info(`[AGENTS:NEW] Creating new channel with timestamp suffix instead`);
        // If we can't unarchive, create a new channel with timestamp
        const timestamp = Date.now().toString().slice(-6);
        const newChannelName = `${channelName}-${timestamp}`.substring(0, 80);
        try {
          const newRes = await client.conversations.create({
            name: newChannelName,
            is_private: false,
          });
          if (newRes.channel?.id) {
            newChannelId = newRes.channel.id;
            isArchived = false;
            logger.info(`[AGENTS:NEW] New channel created: ${newChannelId}`);
          } else {
            await say('❌ Failed to create channel for agent.');
            return;
          }
        } catch (createErr) {
          logger.error(`[AGENTS:NEW] Failed to create fallback channel: ${createErr}`);
          await say('❌ Failed to create agent channel.');
          return;
        }
      }
    }

    // Invite user to channel
    if (userId) {
      logger.info(`[AGENTS:NEW] Inviting user ${userId} to channel ${newChannelId}`);
      try {
        await client.conversations.invite({
          channel: newChannelId,
          users: userId,
        });
        logger.info(`[AGENTS:NEW] User invited successfully`);
      } catch (inviteErr) {
        logger.error(`[AGENTS:NEW] Failed to invite user: ${inviteErr}`);
      }
    } else {
      logger.warn(`[AGENTS:NEW] No userId available`);
    }

    // Register agent to new channel (use agent.id, not the user input)
    logger.info(`[AGENTS:NEW] Registering agent to database`);
    channelDb.register(newChannelId, agent.id, agent.name);
    logger.info(`[AGENTS:NEW] Agent registered to database: ${agent.id}`);

    // Post welcome message in new channel
    logger.info(`[AGENTS:NEW] Posting welcome message`);
    await client.chat.postMessage({
      channel: newChannelId,
      text: `🤖 *${agent.name}* agent is ready.\n\nUse \`/agents disconnect\` to disconnect this agent, or \`/agents readonly on\` to make it read-only.`,
    });
    logger.info(`[AGENTS:NEW] Welcome message posted`);

    await say(
      `✅ Created channel <#${newChannelId}> for *${agent.name}* (\`${agentId}\`)`
    );
    logger.info(`[AGENTS:NEW] Success message sent to user`);
  } catch (err) {
    logger.error(`[AGENTS:NEW] Failed with error: ${err}`);
    if (err instanceof Error) {
      logger.error(`[AGENTS:NEW] Error stack: ${err.stack}`);
    }
    await say('❌ Failed to create agent channel.');
  }
}

async function handleDisconnect(
  say: any,
  channelId: string,
  agentId: string | undefined
): Promise<void> {
  logger.info(`[AGENTS:DISCONNECT] Disconnecting agent from channel ${channelId}`);

  try {
    const existing = channelDb.get(channelId);

    if (!existing) {
      await say('❌ No agent is registered in this channel.');
      return;
    }

    if (agentId && existing.agent_id !== agentId) {
      await say(
        `❌ Agent \`${agentId}\` is not registered in this channel.`
      );
      return;
    }

    const agentName = existing.agent_name;
    const client = new WebClient(config.token);

    // Post message BEFORE archiving (can't post to archived channels)
    await say(`✅ Agent *${agentName}* has been disconnected. This channel is now archived.`);

    // Archive the channel instead of deleting (preserves history)
    logger.info(`[AGENTS:DISCONNECT] Archiving channel ${channelId}`);
    await client.conversations.archive({
      channel: channelId,
    });

    channelDb.remove(channelId);
    logger.info(`[AGENTS:DISCONNECT] Successfully disconnected ${agentName}`);
  } catch (err) {
    logger.error(`[AGENTS:DISCONNECT] Failed: ${err}`);
    await say('❌ Failed to disconnect agent.');
  }
}

async function handleReadonly(
  say: any,
  channelId: string,
  agentId: string | undefined,
  mode: string | undefined
): Promise<void> {
  logger.info(`[AGENTS:READONLY] Toggling read-only for channel ${channelId}`);

  if (!agentId || !mode) {
    await say('❌ Usage: `/agents readonly <agent-id> <on|off>`');
    return;
  }

  const readOnlyMode = mode.toLowerCase() === 'on';

  try {
    const existing = channelDb.get(channelId);

    if (!existing) {
      await say('❌ No agent is registered in this channel.');
      return;
    }

    if (existing.agent_id !== agentId) {
      await say(`❌ Agent \`${agentId}\` is not registered in this channel.`);
      return;
    }

    channelDb.setReadOnly(channelId, readOnlyMode);
    const status = readOnlyMode ? 'read-only' : 'read-write';
    logger.info(`[AGENTS:READONLY] Set to ${status}`);
    await say(
      `✅ Agent *${existing.agent_name}* is now in ${status} mode for this channel.`
    );
  } catch (err) {
    logger.error(`[AGENTS:READONLY] Failed: ${err}`);
    await say('❌ Failed to update read-only mode.');
  }
}
