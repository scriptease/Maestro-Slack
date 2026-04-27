import { execSync } from 'child_process';
import { WebClient } from '@slack/web-api';
import { logger } from './logger';
import { config } from '../config';
import { channelDb, conversationDb } from '../db';
import type { QueuedMessage } from './queue';

export interface Agent {
  id: string;
  name: string;
}

export interface Session {
  id: string;
  agentId: string;
}

export async function listAgents(): Promise<Agent[]> {
  try {
    const cliPath = process.env.MAESTRO_CLI_PATH || 'node /Applications/Maestro.app/Contents/Resources/maestro-cli.js';
    const output = execSync(`${cliPath} list agents --json`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const agents = JSON.parse(output);
    logger.info(`[MAESTRO] Listed ${agents.length} agents`);
    const mapped = agents.map((agent: { id: string; name: string }) => ({
      id: agent.id,
      name: agent.name,
    }));
    // Log first few agents for debugging
    mapped.slice(0, 3).forEach((a: Agent) => {
      logger.debug(`[MAESTRO] Agent: ${a.name} (${a.id})`);
    });
    return mapped;
  } catch (err) {
    logger.error(`Failed to list agents: ${err}`);
    return [];
  }
}

export async function listSessions(agentId: string): Promise<Session[]> {
  try {
    const cliPath = process.env.MAESTRO_CLI_PATH || 'node /Applications/Maestro.app/Contents/Resources/maestro-cli.js';
    const output = execSync(`${cliPath} list sessions ${agentId} --json`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const response = JSON.parse(output);

    // maestro-cli returns a wrapper object with sessions array
    const sessions = response.sessions || response;
    if (!Array.isArray(sessions)) {
      logger.warn(`[MAESTRO] listSessions returned non-array: ${typeof sessions}`);
      return [];
    }

    logger.info(`[MAESTRO] Listed ${sessions.length} sessions for agent ${agentId}`);
    return sessions.map((session: { sessionId: string }) => ({
      id: session.sessionId,
      agentId: agentId,
    }));
  } catch (err) {
    logger.error(`Failed to list sessions for agent ${agentId}: ${err}`);
    return [];
  }
}

export async function sendToAgent(message: QueuedMessage): Promise<void> {
  const convo = conversationDb.get(message.thread_ts);
  if (!convo) {
    logger.warn(`Conversation ${message.thread_ts} not found`);
    return;
  }

  const agentId = convo.agent_id;
  let sessionId = convo.session_id;

  const client = new WebClient(config.token);

  try {
    // Add loading reaction
    await client.reactions.add({
      channel: message.channel,
      name: 'hourglass_flowing_sand',
      timestamp: message.message_ts,
    });
    logger.debug(`Added loading reaction to message ${message.message_ts}`);

    // Send message to agent
    const msg = `[Slack] ${message.text}`;
    const cliPath = process.env.MAESTRO_CLI_PATH || 'node /Applications/Maestro.app/Contents/Resources/maestro-cli.js';
    const sessionArg = sessionId ? `-s ${sessionId}` : '';
    const output = execSync(`${cliPath} send ${sessionArg} ${agentId} "${msg.replace(/"/g, '\\"')}"`.trim(), {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Remove loading reaction
    await client.reactions.remove({
      channel: message.channel,
      name: 'hourglass_flowing_sand',
      timestamp: message.message_ts,
    });
    logger.debug(`Removed loading reaction from message ${message.message_ts}`);

    // Parse response and post to Slack
    try {
      const response = JSON.parse(output);

      // Persist session ID if this was the first message (session was just created)
      if (!sessionId && response.sessionId) {
        conversationDb.updateSession(message.thread_ts, response.sessionId);
        logger.info(`Created new session ${response.sessionId} for agent ${agentId}`);
      }

      logger.info(`Sent message to agent ${agentId} in session ${response.sessionId || sessionId}`);

      if (response.response) {
        await client.chat.postMessage({
          channel: message.channel,
          thread_ts: message.thread_ts,
          text: response.response,
        });
        logger.info(`Posted agent response to thread ${message.thread_ts}`);
      }
    } catch (err) {
      logger.error(`Failed to post agent response to Slack: ${err}`);
    }
  } catch (err) {
    logger.error(`Failed to send message to agent: ${err}`);
    // Try to remove loading reaction on error
    try {
      await client.reactions.remove({
        channel: message.channel,
        name: 'hourglass_flowing_sand',
        timestamp: message.message_ts,
      });
    } catch (cleanupErr) {
      logger.debug(`Failed to remove reaction on error: ${cleanupErr}`);
    }
    throw err;
  }
}
