const https = require('https');
const db = require('./database');
const { toolDefinitions, executeTool } = require('./tools');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getSystemPrompt() {
  const memories = db.getMemories();
  const memoryContext = memories.length > 0
    ? `\n\nYou have the following persistent memories:\n${memories.map(m => `- [${m.category}] ${m.key}: ${m.content}`).join('\n')}`
    : '';

  return `You are ARIA, a powerful personal AI assistant running locally on the user's computer. You are proactive, capable, and always helpful. You have direct access to the user's file system, shell, and web.

Your capabilities:
- Execute shell commands (PowerShell on Windows, bash on Linux/Mac)
- Read and write files anywhere on the file system
- Browse web pages and search the internet
- Remember information persistently across conversations
- Manage files (move, copy, rename, delete, create directories)
- Open applications on the host system
- Create scheduled automations

Guidelines:
- Be proactive: if a task requires multiple steps, plan and execute them all
- Always confirm destructive operations (delete, overwrite) with the user first by asking, unless they explicitly said to proceed
- When executing commands, show the user what you're running
- Use save_memory for any facts, preferences, or important info the user shares
- Use recall_memory to check for relevant context before responding
- Provide clear, well-formatted responses using markdown
- If you encounter an error, try to diagnose and fix it
- Be concise but thorough${memoryContext}`;
}

function buildMessages(conversationHistory) {
  const messages = [{ role: 'system', content: getSystemPrompt() }];

  for (const msg of conversationHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      const entry = { role: msg.role, content: msg.content || '' };
      if (msg.tool_calls) {
        const tc = typeof msg.tool_calls === 'string' ? JSON.parse(msg.tool_calls) : msg.tool_calls;
        if (tc && tc.length > 0) {
          entry.tool_calls = tc;
          if (!entry.content) entry.content = null;
        }
      }
      messages.push(entry);
    } else if (msg.role === 'tool') {
      const tr = typeof msg.tool_results === 'string' ? JSON.parse(msg.tool_results) : msg.tool_results;
      if (tr) {
        messages.push({
          role: 'tool',
          tool_call_id: tr.tool_call_id,
          content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content)
        });
      }
    }
  }

  return messages;
}

async function chat(conversationId, userMessage, onChunk, onToolCall, onComplete) {
  const apiKey = db.getSetting('api_key');
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured. Go to Settings to add your key.');
  }

  const primaryModel = db.getSetting('model') || 'anthropic/claude-sonnet-4';
  const fallbackModel = db.getSetting('fallback_model') || null;

  // Get conversation history
  let conversation = db.getConversation(conversationId);
  if (!conversation) {
    db.createConversation(conversationId, userMessage.substring(0, 60));
  }

  // Save user message
  db.addMessage(conversationId, 'user', userMessage);

  // Build full message history
  const allMessages = db.getMessages(conversationId);
  
  // Run the agentic loop with primary model, fallback on failure
  await agentLoop(conversationId, allMessages, primaryModel, fallbackModel, apiKey, onChunk, onToolCall, onComplete);
}

async function agentLoop(conversationId, messageHistory, primaryModel, fallbackModel, apiKey, onChunk, onToolCall, onComplete, depth = 0, usingFallback = false) {
  if (depth > 10) {
    onComplete('I\'ve reached the maximum number of tool calls for this turn. Please ask me to continue if needed.');
    return;
  }

  const model = usingFallback ? fallbackModel : primaryModel;
  const messages = buildMessages(messageHistory);

  try {
    const response = await callOpenRouter(messages, model, apiKey);

    if (!response || !response.choices?.[0]) {
      // Try fallback if primary failed
      if (!usingFallback && fallbackModel && fallbackModel !== primaryModel) {
        console.log(`[ARIA] Primary model failed (empty response), falling back to: ${fallbackModel}`);
        onChunk(`\n\n> ⚠️ Primary model returned no response. Switching to fallback: **${fallbackModel}**\n\n`);
        return agentLoop(conversationId, messageHistory, primaryModel, fallbackModel, apiKey, onChunk, onToolCall, onComplete, depth, true);
      }
      onComplete('No response received from the AI model.');
      return;
    }

    const choice = response.choices[0];
    const assistantMessage = choice.message;
    const content = assistantMessage.content || '';
    const toolCalls = assistantMessage.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      // Save assistant message with tool calls
      db.addMessage(conversationId, 'assistant', content, toolCalls);
      messageHistory.push({ role: 'assistant', content, tool_calls: JSON.stringify(toolCalls) });

      if (content) {
        onChunk(content);
      }

      // Execute each tool call
      for (const tc of toolCalls) {
        const toolName = tc.function.name;
        let toolArgs;
        try {
          toolArgs = JSON.parse(tc.function.arguments);
        } catch {
          toolArgs = {};
        }

        onToolCall({ id: tc.id, name: toolName, args: toolArgs, status: 'running' });

        const result = await executeTool(toolName, toolArgs);

        onToolCall({ id: tc.id, name: toolName, args: toolArgs, status: 'complete', result });

        // Save tool result to DB and history
        const toolResult = { tool_call_id: tc.id, content: result };
        db.addMessage(conversationId, 'tool', null, null, toolResult);
        messageHistory.push({ role: 'tool', tool_results: JSON.stringify(toolResult) });
      }

      // Continue the loop — model needs to process tool results (keep using same model)
      await agentLoop(conversationId, messageHistory, primaryModel, fallbackModel, apiKey, onChunk, onToolCall, onComplete, depth + 1, usingFallback);
    } else {
      // No tool calls — final response
      db.addMessage(conversationId, 'assistant', content);

      // Auto-title conversation if first exchange
      const msgCount = db.getMessages(conversationId).length;
      if (msgCount <= 3) {
        const userMsg = messageHistory.find(m => m.role === 'user');
        if (userMsg) {
          const title = (userMsg.content || '').substring(0, 60) || 'New Chat';
          db.updateConversationTitle(conversationId, title);
        }
      }

      onComplete(content);
    }
  } catch (err) {
    // Try fallback model on error
    if (!usingFallback && fallbackModel && fallbackModel !== primaryModel) {
      console.log(`[ARIA] Primary model error: ${err.message}. Falling back to: ${fallbackModel}`);
      onChunk(`\n\n> ⚠️ Primary model error: ${err.message}. Switching to fallback: **${fallbackModel}**\n\n`);
      return agentLoop(conversationId, messageHistory, primaryModel, fallbackModel, apiKey, onChunk, onToolCall, onComplete, depth, true);
    }
    onComplete(`Error: ${err.message}`);
  }
}

function callOpenRouter(messages, model, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
      max_tokens: 4096
    });

    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'ARIA AI Assistant'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request to OpenRouter timed out'));
    });
    req.setTimeout(60000);
    req.write(body);
    req.end();
  });
}

async function fetchModels(apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/models',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.data || []);
        } catch {
          resolve([]);
        }
      });
    });

    req.on('error', () => resolve([]));
    req.setTimeout(15000);
    req.end();
  });
}

async function fetchKeyInfo(apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/auth/key',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.data || null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(15000);
    req.end();
  });
}

module.exports = { chat, fetchModels, fetchKeyInfo };
