import Database from 'better-sqlite3';
import path from 'path';

const db: Database.Database = new Database(path.join(__dirname, '../../maestro-bot.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_channels (
    channel_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    session_id TEXT,
    read_only INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_conversations (
    thread_ts TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    owner_user_id TEXT,
    session_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

export interface AgentChannel {
  channel_id: string;
  agent_id: string;
  agent_name: string;
  session_id: string | null;
  read_only: number;
  created_at: number;
}

export interface AgentConversation {
  thread_ts: string;
  channel_id: string;
  agent_id: string;
  owner_user_id: string | null;
  session_id: string | null;
  created_at: number;
}

export const channelDb = {
  register(channelId: string, agentId: string, agentName: string): void {
    db.prepare(
      `INSERT INTO agent_channels (channel_id, agent_id, agent_name)
       VALUES (?, ?, ?)`
    ).run(channelId, agentId, agentName);
  },

  get(channelId: string): AgentChannel | undefined {
    return db
      .prepare('SELECT * FROM agent_channels WHERE channel_id = ?')
      .get(channelId) as AgentChannel | undefined;
  },

  getByAgentId(agentId: string): AgentChannel | undefined {
    return db
      .prepare('SELECT * FROM agent_channels WHERE agent_id = ?')
      .get(agentId) as AgentChannel | undefined;
  },

  updateSession(channelId: string, sessionId: string | null): void {
    db.prepare('UPDATE agent_channels SET session_id = ? WHERE channel_id = ?').run(
      sessionId,
      channelId
    );
  },

  setReadOnly(channelId: string, readOnly: boolean): void {
    db.prepare('UPDATE agent_channels SET read_only = ? WHERE channel_id = ?').run(
      readOnly ? 1 : 0,
      channelId
    );
  },

  remove(channelId: string): void {
    db.prepare('DELETE FROM agent_channels WHERE channel_id = ?').run(channelId);
  },

  listByAgentId(agentId: string): AgentChannel[] {
    return db
      .prepare('SELECT * FROM agent_channels WHERE agent_id = ?')
      .all(agentId) as AgentChannel[];
  },
};

export const conversationDb = {
  register(
    threadTs: string,
    channelId: string,
    agentId: string,
    ownerUserId: string | null
  ): void {
    db.prepare(
      `INSERT INTO agent_conversations (thread_ts, channel_id, agent_id, owner_user_id)
       VALUES (?, ?, ?, ?)`
    ).run(threadTs, channelId, agentId, ownerUserId);
  },

  get(threadTs: string): AgentConversation | undefined {
    return db
      .prepare('SELECT * FROM agent_conversations WHERE thread_ts = ?')
      .get(threadTs) as AgentConversation | undefined;
  },

  updateSession(threadTs: string, sessionId: string | null): void {
    db.prepare('UPDATE agent_conversations SET session_id = ? WHERE thread_ts = ?').run(
      sessionId,
      threadTs
    );
  },

  remove(threadTs: string): void {
    db.prepare('DELETE FROM agent_conversations WHERE thread_ts = ?').run(threadTs);
  },
};

export { db };
