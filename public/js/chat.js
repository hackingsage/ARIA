// ─── Chat Panel ────────────────────────────────────────────

const ChatPanel = {
  currentContent: '',
  assistantMessageEl: null,

  init() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('btnSend');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 150) + 'px';
    });

    sendBtn.addEventListener('click', () => this.send());

    // Suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        input.value = chip.dataset.msg;
        this.send();
      });
    });
  },

  send() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message || App.isProcessing) return;

    input.value = '';
    input.style.height = 'auto';

    // Hide welcome screen
    const welcome = document.getElementById('welcomeScreen');
    if (welcome) welcome.style.display = 'none';

    // Add user message
    this.addMessage('user', message);

    // Send to server
    App.sendMessage(message);

    // Show typing indicator & switch to stop button
    this.showTyping();
    this.showStopButton();
  },

  addMessage(role, content, toolCalls) {
    const container = document.getElementById('chatMessages');
    const msg = document.createElement('div');
    msg.className = `message message-${role}`;

    const inner = document.createElement('div');
    inner.className = 'message-inner';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'U' : 'A';

    const body = document.createElement('div');
    body.className = 'message-body';

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.innerHTML = MarkdownRenderer.render(content);

    // Message actions (copy)
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    actions.innerHTML = `
      <button onclick="ChatPanel.copyMessage(this)" data-content="${this.escapeAttr(content)}" title="Copy">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy
      </button>
    `;

    body.appendChild(contentEl);
    if (role === 'assistant') body.appendChild(actions);
    inner.appendChild(avatar);
    inner.appendChild(body);
    msg.appendChild(inner);
    container.appendChild(msg);

    this.scrollToBottom();
    return msg;
  },

  copyMessage(button) {
    const content = button.getAttribute('data-content');
    // Decode
    const textarea = document.createElement('textarea');
    textarea.innerHTML = content;
    const decoded = textarea.value;

    navigator.clipboard.writeText(decoded).then(() => {
      const originalHTML = button.innerHTML;
      button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        Copied!
      `;
      button.style.color = 'var(--accent-green)';
      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.style.color = '';
      }, 2000);
    });
  },

  escapeAttr(text) {
    return (text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  onChatStart(conversationId) {
    this.currentContent = '';
    this.assistantMessageEl = null;
  },

  onChunk(content) {
    this.removeTyping();
    
    if (!this.assistantMessageEl) {
      this.assistantMessageEl = this.addMessage('assistant', content);
      this.currentContent = content;
    } else {
      this.currentContent += content;
      const contentEl = this.assistantMessageEl.querySelector('.message-content');
      contentEl.innerHTML = MarkdownRenderer.render(this.currentContent);
    }
    this.scrollToBottom();
  },

  onToolCall(info) {
    this.removeTyping();

    const container = document.getElementById('chatMessages');

    let toolEl = document.getElementById(`tool-${info.id}`);
    
    if (!toolEl) {
      toolEl = document.createElement('div');
      toolEl.id = `tool-${info.id}`;
      toolEl.className = 'tool-call';
      toolEl.style.maxWidth = 'var(--chat-max-width)';
      toolEl.style.margin = '8px auto';
      toolEl.style.width = '100%';

      const header = document.createElement('div');
      header.className = 'tool-call-header';
      header.innerHTML = `
        <span class="tool-call-icon">⚡</span>
        <span class="tool-call-name">${info.name}</span>
        <span class="tool-call-status ${info.status}">${info.status === 'running' ? 'Running...' : 'Complete'}</span>
        <span class="tool-call-chevron">▼</span>
      `;

      const body = document.createElement('div');
      body.className = 'tool-call-body';
      body.textContent = JSON.stringify(info.args, null, 2);

      header.addEventListener('click', () => {
        body.classList.toggle('open');
        header.querySelector('.tool-call-chevron').classList.toggle('open');
      });

      toolEl.appendChild(header);
      toolEl.appendChild(body);

      // Wrap in a centered container
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'padding: 0 24px; display: flex; justify-content: center;';
      wrapper.appendChild(toolEl);
      container.appendChild(wrapper);
    }

    if (info.status === 'complete' || info.status === 'error') {
      const statusEl = toolEl.querySelector('.tool-call-status');
      statusEl.className = `tool-call-status ${info.result?.success ? 'complete' : 'error'}`;
      statusEl.textContent = info.result?.success ? 'Success' : 'Error';

      const body = toolEl.querySelector('.tool-call-body');
      body.textContent = JSON.stringify(info.result, null, 2);
    }

    this.scrollToBottom();
  },

  onComplete(content, conversationId) {
    this.removeTyping();
    this.showSendButton();

    if (content) {
      if (!this.assistantMessageEl) {
        this.addMessage('assistant', content);
      } else if (content !== this.currentContent) {
        this.currentContent = content;
        const contentEl = this.assistantMessageEl.querySelector('.message-content');
        if (contentEl) {
          contentEl.innerHTML = MarkdownRenderer.render(content);
        }
        // Update copy button data
        const copyBtn = this.assistantMessageEl.querySelector('.message-actions button');
        if (copyBtn) {
          copyBtn.setAttribute('data-content', this.escapeAttr(content));
        }
      }
    }

    this.currentContent = '';
    this.assistantMessageEl = null;
    this.updateTitle(conversationId);
    
    document.getElementById('btnSend').disabled = false;
  },

  onError(message) {
    this.removeTyping();
    this.showSendButton();

    const container = document.getElementById('chatMessages');
    const errorEl = document.createElement('div');
    errorEl.className = 'message message-assistant';
    errorEl.innerHTML = `
      <div class="message-inner">
        <div class="message-avatar" style="background: var(--accent-rose); color: white;">!</div>
        <div class="message-body">
          <div class="message-content" style="color: var(--accent-rose);">${MarkdownRenderer.render(message)}</div>
        </div>
      </div>
    `;
    container.appendChild(errorEl);
    this.scrollToBottom();
    document.getElementById('btnSend').disabled = false;
  },

  showTyping() {
    this.removeTyping();
    const container = document.getElementById('chatMessages');
    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.id = 'typingIndicator';
    typing.innerHTML = `
      <div class="typing-indicator-inner">
        <div class="typing-avatar">A</div>
        <div class="typing-dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
        <span class="typing-text">ARIA is thinking...</span>
      </div>
    `;
    container.appendChild(typing);
    this.scrollToBottom();
  },

  removeTyping() {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
  },

  showStopButton() {
    const sendBtn = document.getElementById('btnSend');
    sendBtn.className = 'btn-stop';
    sendBtn.innerHTML = '<div class="stop-icon"></div>';
    sendBtn.title = 'Stop generating';
    sendBtn.onclick = () => {
      // Close and reconnect websocket to cancel
      if (App.ws) App.ws.close();
      App.isProcessing = false;
      this.removeTyping();
      this.showSendButton();
      App.setStatus('Ready', false);
      setTimeout(() => App.connectWebSocket(), 500);
    };
  },

  showSendButton() {
    const sendBtn = document.getElementById('btnSend');
    sendBtn.className = 'btn-send';
    sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg>`;
    sendBtn.title = 'Send message';
    sendBtn.onclick = () => this.send();
  },

  scrollToBottom() {
    const container = document.getElementById('chatMessages');
    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    });
  },

  reset() {
    const container = document.getElementById('chatMessages');
    container.innerHTML = '';
    
    // Show welcome screen
    const welcome = document.createElement('div');
    welcome.className = 'welcome-screen';
    welcome.id = 'welcomeScreen';
    welcome.innerHTML = `
      <div class="welcome-icon">
        <svg viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="28" stroke="url(#wgrad2)" stroke-width="3"/>
          <path d="M20 40 L32 20 L44 40" stroke="url(#wgrad2)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="32" cy="28" r="4" fill="url(#wgrad2)"/>
          <defs>
            <linearGradient id="wgrad2" x1="0" y1="0" x2="64" y2="64">
              <stop offset="0%" stop-color="#8B5CF6"/>
              <stop offset="100%" stop-color="#06B6D4"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h2>What can I help with?</h2>
      <p>I can execute commands, manage files, browse the web, remember things, and automate tasks for you.</p>
      <div class="welcome-suggestions">
        <button class="suggestion-chip" data-msg="What files are in my Documents folder?">📁 Browse my files</button>
        <button class="suggestion-chip" data-msg="What's the latest news in AI?">🌐 Search the web</button>
        <button class="suggestion-chip" data-msg="Tell me about your capabilities">⚡ Your capabilities</button>
        <button class="suggestion-chip" data-msg="Check my system information">💻 System info</button>
      </div>
    `;
    container.appendChild(welcome);

    // Re-bind suggestion chips
    welcome.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.getElementById('chatInput').value = chip.dataset.msg;
        ChatPanel.send();
      });
    });

    document.getElementById('chatTitle').textContent = '';
    this.currentContent = '';
    this.assistantMessageEl = null;
    this.showSendButton();
  },

  async loadConversation(id) {
    try {
      const data = await App.api('GET', `/api/history/${id}`);
      if (!data.conversation) return;

      const container = document.getElementById('chatMessages');
      container.innerHTML = '';

      document.getElementById('chatTitle').textContent = data.conversation.title;

      for (const msg of data.messages) {
        if (msg.role === 'user') {
          this.addMessage('user', msg.content);
        } else if (msg.role === 'assistant') {
          if (msg.content) {
            this.addMessage('assistant', msg.content);
          }
          if (msg.tool_calls) {
            const calls = JSON.parse(msg.tool_calls);
            for (const tc of calls) {
              const args = JSON.parse(tc.function.arguments || '{}');
              this.onToolCall({ id: tc.id, name: tc.function.name, args, status: 'complete', result: { success: true } });
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to load conversation:', e);
    }
  },

  async updateTitle(conversationId) {
    if (!conversationId) return;
    try {
      const data = await App.api('GET', `/api/history/${conversationId}`);
      if (data.conversation) {
        document.getElementById('chatTitle').textContent = data.conversation.title;
      }
    } catch (_) {}
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ChatPanel.init();
});
