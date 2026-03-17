const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const crypto = require('crypto');

const db = require('./src/database');
const { chat, fetchModels, fetchKeyInfo } = require('./src/openrouter');
const { runSkill } = require('./src/skills');
const automations = require('./src/automations');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── WebSocket ─────────────────────────────────────────────
wss.on('connection', (ws) => {
  console.log('[WS] Client connected');

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'chat') {
        const conversationId = msg.conversationId || crypto.randomUUID();

        ws.send(JSON.stringify({ type: 'chat_start', conversationId }));

        await chat(
          conversationId,
          msg.message,
          // onChunk
          (chunk) => {
            ws.send(JSON.stringify({ type: 'chat_chunk', content: chunk }));
          },
          // onToolCall
          (toolInfo) => {
            ws.send(JSON.stringify({ type: 'tool_call', ...toolInfo }));
          },
          // onComplete
          (finalContent) => {
            ws.send(JSON.stringify({ type: 'chat_complete', content: finalContent, conversationId }));
          }
        );
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
  });
});

// ─── REST API: History ─────────────────────────────────────
app.get('/api/history', (req, res) => {
  res.json(db.getConversations());
});

app.get('/api/history/:id', (req, res) => {
  const conversation = db.getConversation(req.params.id);
  if (!conversation) return res.status(404).json({ error: 'Not found' });
  const messages = db.getMessages(req.params.id);
  res.json({ conversation, messages });
});

app.delete('/api/history/:id', (req, res) => {
  db.deleteConversation(req.params.id);
  res.json({ success: true });
});

// ─── REST API: Memory ──────────────────────────────────────
app.get('/api/memory', (req, res) => {
  const category = req.query.category;
  res.json(db.getMemories(category));
});

app.post('/api/memory', (req, res) => {
  const { key, content, category } = req.body;
  db.saveMemory(key, content, category);
  res.json({ success: true });
});

app.delete('/api/memory/:id', (req, res) => {
  db.deleteMemory(req.params.id);
  res.json({ success: true });
});

// ─── REST API: Skills ──────────────────────────────────────
app.get('/api/skills', (req, res) => {
  res.json(db.getSkills());
});

app.post('/api/skills', (req, res) => {
  const { name, description, code, trigger_type, trigger_value } = req.body;
  try {
    db.createSkill(name, description, code, trigger_type, trigger_value);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/skills/:name/run', async (req, res) => {
  const result = await runSkill(req.params.name);
  res.json(result);
});

app.delete('/api/skills/:id', (req, res) => {
  db.deleteSkill(req.params.id);
  res.json({ success: true });
});

// ─── REST API: Automations ─────────────────────────────────
app.get('/api/automations', (req, res) => {
  res.json(db.getAutomations());
});

app.post('/api/automations', (req, res) => {
  const { name, description, cron_expression, action_type, action_payload } = req.body;
  try {
    db.createAutomation(name, description, cron_expression, action_type, action_payload);
    const all = db.getAutomations();
    const latest = all[0];
    if (latest) automations.refreshAutomation(latest.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/automations/:id', (req, res) => {
  try {
    db.updateAutomation(req.params.id, req.body);
    automations.refreshAutomation(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/automations/:id', (req, res) => {
  automations.stopAutomation(parseInt(req.params.id));
  db.deleteAutomation(req.params.id);
  res.json({ success: true });
});

// ─── REST API: Settings ────────────────────────────────────
app.get('/api/settings', (req, res) => {
  const settings = db.getAllSettings();
  // Mask the API key for security
  if (settings.api_key) {
    settings.api_key_masked = settings.api_key.substring(0, 8) + '...' + settings.api_key.slice(-4);
  }
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  db.setSetting(key, value);
  res.json({ success: true });
});

// ─── REST API: Models ──────────────────────────────────────
app.get('/api/models', async (req, res) => {
  const apiKey = db.getSetting('api_key');
  if (!apiKey) {
    return res.json([]);
  }
  const models = await fetchModels(apiKey);
  res.json(models);
});

// ─── REST API: Usage ───────────────────────────────────────
app.get('/api/usage', async (req, res) => {
  const apiKey = db.getSetting('api_key');
  if (!apiKey) {
    return res.status(401).json({ error: 'API key not set' });
  }
  const info = await fetchKeyInfo(apiKey);
  if (info) {
    res.json(info);
  } else {
    res.status(500).json({ error: 'Failed to fetch usage from OpenRouter' });
  }
});

// ─── Catch-all ─────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║      🤖  ARIA AI Assistant               ║
  ║      Running on http://localhost:${PORT}    ║
  ║                                          ║
  ╚══════════════════════════════════════════╝
  `);
  automations.startAllAutomations();
});
