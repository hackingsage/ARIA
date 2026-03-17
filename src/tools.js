const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const db = require('./database');

// ─── Tool Definitions (OpenAI function-calling format) ────

const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'execute_shell',
      description: 'Execute a shell command on the host operating system and return the output. Use this for running programs, scripts, system commands, installing packages, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          cwd: { type: 'string', description: 'Working directory for the command (optional)' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file at the specified path.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Absolute or relative path to the file to read' }
        },
        required: ['file_path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file. Creates the file if it does not exist, overwrites if it does.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the file to write' },
          content: { type: 'string', description: 'Content to write to the file' },
          append: { type: 'boolean', description: 'If true, append to the file instead of overwriting' }
        },
        required: ['file_path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List files and subdirectories in a given directory.',
      parameters: {
        type: 'object',
        properties: {
          dir_path: { type: 'string', description: 'Path to the directory to list' },
          recursive: { type: 'boolean', description: 'If true, list recursively (max 3 levels)' }
        },
        required: ['dir_path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'manage_files',
      description: 'Move, copy, rename, or delete files and directories.',
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['move', 'copy', 'rename', 'delete', 'mkdir'], description: 'The file operation to perform' },
          source: { type: 'string', description: 'Source path' },
          destination: { type: 'string', description: 'Destination path (not needed for delete)' }
        },
        required: ['operation', 'source']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browse_url',
      description: 'Fetch the content of a web page URL and return the text content. Useful for reading articles, documentation, web pages.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to fetch' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web using DuckDuckGo and return results. Use this to find information online.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'save_memory',
      description: 'Save a piece of information to persistent memory. Use this to remember facts, preferences, notes, or any information the user wants to persist across conversations.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'A short label or title for this memory' },
          content: { type: 'string', description: 'The content to remember' },
          category: { type: 'string', description: 'Category: general, preference, fact, note, task', enum: ['general', 'preference', 'fact', 'note', 'task'] }
        },
        required: ['key', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'recall_memory',
      description: 'Search persistent memory for relevant information. Use this to recall facts, preferences, or notes that were previously saved.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query to find relevant memories' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_application',
      description: 'Open an application or file on the host operating system.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Application name, path, or URL to open' }
        },
        required: ['target']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_automation',
      description: 'Create a scheduled automation that runs on a cron schedule. The automation will execute a chat prompt on the specified schedule.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the automation' },
          description: { type: 'string', description: 'What this automation does' },
          cron: { type: 'string', description: 'Cron expression (e.g. "0 9 * * *" for daily at 9am)' },
          prompt: { type: 'string', description: 'The chat prompt to execute on schedule' }
        },
        required: ['name', 'cron', 'prompt']
      }
    }
  }
];

// ─── Tool Handlers ─────────────────────────────────────────

async function executeShell(args) {
  return new Promise((resolve) => {
    const opts = { timeout: 30000, maxBuffer: 1024 * 1024 };
    if (args.cwd) opts.cwd = args.cwd;
    exec(args.command, opts, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message, stdout: stdout || '', stderr: stderr || '' });
      } else {
        resolve({ success: true, stdout: stdout || '', stderr: stderr || '' });
      }
    });
  });
}

function readFile(args) {
  try {
    const content = fs.readFileSync(args.file_path, 'utf-8');
    return { success: true, content, size: Buffer.byteLength(content) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function writeFile(args) {
  try {
    const dir = path.dirname(args.file_path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (args.append) {
      fs.appendFileSync(args.file_path, args.content);
    } else {
      fs.writeFileSync(args.file_path, args.content);
    }
    return { success: true, message: `File ${args.append ? 'appended' : 'written'}: ${args.file_path}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function listDirectory(args, depth = 0) {
  try {
    const entries = fs.readdirSync(args.dir_path, { withFileTypes: true });
    const result = entries.map(e => {
      const entryPath = path.join(args.dir_path, e.name);
      const info = { name: e.name, type: e.isDirectory() ? 'directory' : 'file' };
      if (e.isFile()) {
        try {
          const stat = fs.statSync(entryPath);
          info.size = stat.size;
        } catch (_) {}
      }
      if (args.recursive && e.isDirectory() && depth < 2) {
        try {
          info.children = listDirectory({ dir_path: entryPath, recursive: true }, depth + 1);
        } catch (_) {}
      }
      return info;
    });
    return depth === 0 ? { success: true, path: args.dir_path, entries: result } : result;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function manageFiles(args) {
  try {
    switch (args.operation) {
      case 'move':
      case 'rename':
        fs.renameSync(args.source, args.destination);
        return { success: true, message: `${args.operation}: ${args.source} → ${args.destination}` };
      case 'copy':
        if (fs.statSync(args.source).isDirectory()) {
          fs.cpSync(args.source, args.destination, { recursive: true });
        } else {
          fs.copyFileSync(args.source, args.destination);
        }
        return { success: true, message: `Copied: ${args.source} → ${args.destination}` };
      case 'delete':
        fs.rmSync(args.source, { recursive: true, force: true });
        return { success: true, message: `Deleted: ${args.source}` };
      case 'mkdir':
        fs.mkdirSync(args.source, { recursive: true });
        return { success: true, message: `Created directory: ${args.source}` };
      default:
        return { success: false, error: `Unknown operation: ${args.operation}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function browseUrl(args) {
  return new Promise((resolve) => {
    const url = args.url;
    const client = url.startsWith('https') ? https : http;
    
    const request = client.get(url, { 
      headers: { 'User-Agent': 'ARIA-Assistant/1.0' },
      timeout: 15000 
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        browseUrl({ url: res.headers.location }).then(resolve);
        return;
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const cheerio = require('cheerio');
          const $ = cheerio.load(data);
          $('script, style, nav, footer, header, iframe, noscript').remove();
          const title = $('title').text().trim();
          const text = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 8000);
          resolve({ success: true, title, content: text, url });
        } catch (_) {
          const text = data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 8000);
          resolve({ success: true, content: text, url });
        }
      });
    });
    
    request.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
    
    request.on('timeout', () => {
      request.destroy();
      resolve({ success: false, error: 'Request timed out' });
    });
  });
}

function webSearch(args) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(args.query);
    const url = `https://html.duckduckgo.com/html/?q=${query}`;
    
    const request = https.get(url, {
      headers: { 'User-Agent': 'ARIA-Assistant/1.0' },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const cheerio = require('cheerio');
          const $ = cheerio.load(data);
          const results = [];
          $('.result').each((i, el) => {
            if (i >= 8) return false;
            const title = $(el).find('.result__title').text().trim();
            const snippet = $(el).find('.result__snippet').text().trim();
            const link = $(el).find('.result__url').text().trim();
            if (title) results.push({ title, snippet, link });
          });
          resolve({ success: true, query: args.query, results });
        } catch (_) {
          resolve({ success: true, query: args.query, results: [], note: 'Could not parse search results' });
        }
      });
    });
    
    request.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
    
    request.on('timeout', () => {
      request.destroy();
      resolve({ success: false, error: 'Search timed out' });
    });
  });
}

function saveMemory(args) {
  try {
    db.saveMemory(args.key, args.content, args.category || 'general');
    return { success: true, message: `Memory saved: "${args.key}"` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function recallMemory(args) {
  try {
    const memories = db.searchMemories(args.query);
    return { success: true, query: args.query, memories: memories.map(m => ({ key: m.key, content: m.content, category: m.category })) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function openApplication(args) {
  return new Promise((resolve) => {
    const platform = process.platform;
    let cmd;
    if (platform === 'win32') {
      cmd = `start "" "${args.target}"`;
    } else if (platform === 'darwin') {
      cmd = `open "${args.target}"`;
    } else {
      cmd = `xdg-open "${args.target}"`;
    }
    exec(cmd, { timeout: 10000 }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, message: `Opened: ${args.target}` });
      }
    });
  });
}

function createAutomationTool(args) {
  try {
    db.createAutomation(args.name, args.description || '', args.cron, 'chat', args.prompt);
    return { success: true, message: `Automation created: "${args.name}" (${args.cron})` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Tool Executor ─────────────────────────────────────────

async function executeTool(name, args) {
  switch (name) {
    case 'execute_shell': return executeShell(args);
    case 'read_file': return readFile(args);
    case 'write_file': return writeFile(args);
    case 'list_directory': return listDirectory(args);
    case 'manage_files': return manageFiles(args);
    case 'browse_url': return browseUrl(args);
    case 'web_search': return webSearch(args);
    case 'save_memory': return saveMemory(args);
    case 'recall_memory': return recallMemory(args);
    case 'open_application': return openApplication(args);
    case 'create_automation': return createAutomationTool(args);
    default: return { success: false, error: `Unknown tool: ${name}` };
  }
}

module.exports = { toolDefinitions, executeTool };
