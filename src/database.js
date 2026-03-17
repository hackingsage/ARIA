const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'aria.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT,
      tool_calls TEXT,
      tool_results TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      code TEXT NOT NULL,
      trigger_type TEXT DEFAULT 'manual',
      trigger_value TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      cron_expression TEXT NOT NULL,
      action_type TEXT NOT NULL DEFAULT 'chat',
      action_payload TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run TEXT,
      last_result TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

// ─── Conversations ─────────────────────────────────────────
function createConversation(id, title) {
  const stmt = getDb().prepare('INSERT INTO conversations (id, title) VALUES (?, ?)');
  return stmt.run(id, title || 'New Chat');
}

function getConversations() {
  return getDb().prepare(`
    SELECT c.*, COUNT(m.id) as message_count 
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `).all();
}

function getConversation(id) {
  return getDb().prepare('SELECT * FROM conversations WHERE id = ?').get(id);
}

function updateConversationTitle(id, title) {
  return getDb().prepare('UPDATE conversations SET title = ?, updated_at = datetime(\'now\') WHERE id = ?').run(title, id);
}

function deleteConversation(id) {
  return getDb().prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

// ─── Messages ──────────────────────────────────────────────
function addMessage(conversationId, role, content, toolCalls, toolResults) {
  const stmt = getDb().prepare(`
    INSERT INTO messages (conversation_id, role, content, tool_calls, tool_results)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    conversationId, role, content,
    toolCalls ? JSON.stringify(toolCalls) : null,
    toolResults ? JSON.stringify(toolResults) : null
  );
  getDb().prepare('UPDATE conversations SET updated_at = datetime(\'now\') WHERE id = ?').run(conversationId);
  return result;
}

function getMessages(conversationId) {
  return getDb().prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conversationId);
}

// ─── Memory ────────────────────────────────────────────────
function saveMemory(key, content, category) {
  const stmt = getDb().prepare('INSERT INTO memory (key, content, category) VALUES (?, ?, ?)');
  return stmt.run(key, content, category || 'general');
}

function getMemories(category) {
  if (category) {
    return getDb().prepare('SELECT * FROM memory WHERE category = ? ORDER BY created_at DESC').all(category);
  }
  return getDb().prepare('SELECT * FROM memory ORDER BY created_at DESC').all();
}

function searchMemories(query) {
  return getDb().prepare("SELECT * FROM memory WHERE key LIKE ? OR content LIKE ? ORDER BY created_at DESC").all(`%${query}%`, `%${query}%`);
}

function deleteMemory(id) {
  return getDb().prepare('DELETE FROM memory WHERE id = ?').run(id);
}

// ─── Skills ────────────────────────────────────────────────
function createSkill(name, description, code, triggerType, triggerValue) {
  const stmt = getDb().prepare('INSERT INTO skills (name, description, code, trigger_type, trigger_value) VALUES (?, ?, ?, ?, ?)');
  return stmt.run(name, description, code, triggerType || 'manual', triggerValue || null);
}

function getSkills() {
  return getDb().prepare('SELECT * FROM skills ORDER BY created_at DESC').all();
}

function getSkill(id) {
  return getDb().prepare('SELECT * FROM skills WHERE id = ?').get(id);
}

function getSkillByName(name) {
  return getDb().prepare('SELECT * FROM skills WHERE name = ?').get(name);
}

function deleteSkill(id) {
  return getDb().prepare('DELETE FROM skills WHERE id = ?').run(id);
}

// ─── Automations ───────────────────────────────────────────
function createAutomation(name, description, cronExpression, actionType, actionPayload) {
  const stmt = getDb().prepare('INSERT INTO automations (name, description, cron_expression, action_type, action_payload) VALUES (?, ?, ?, ?, ?)');
  return stmt.run(name, description, cronExpression, actionType || 'chat', typeof actionPayload === 'string' ? actionPayload : JSON.stringify(actionPayload));
}

function getAutomations() {
  return getDb().prepare('SELECT * FROM automations ORDER BY created_at DESC').all();
}

function getAutomation(id) {
  return getDb().prepare('SELECT * FROM automations WHERE id = ?').get(id);
}

function updateAutomation(id, updates) {
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }
  values.push(id);
  return getDb().prepare(`UPDATE automations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function deleteAutomation(id) {
  return getDb().prepare('DELETE FROM automations WHERE id = ?').run(id);
}

// ─── Settings ──────────────────────────────────────────────
function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  return getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

function getAllSettings() {
  const rows = getDb().prepare('SELECT * FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

module.exports = {
  getDb, createConversation, getConversations, getConversation,
  updateConversationTitle, deleteConversation,
  addMessage, getMessages,
  saveMemory, getMemories, searchMemories, deleteMemory,
  createSkill, getSkills, getSkill, getSkillByName, deleteSkill,
  createAutomation, getAutomations, getAutomation, updateAutomation, deleteAutomation,
  getSetting, setSetting, getAllSettings
};
