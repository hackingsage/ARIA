// ─── ARIA App Controller ───────────────────────────────────

const App = {
  ws: null,
  currentPanel: 'chat',
  currentConversationId: null,
  isProcessing: false,
  reconnectAttempts: 0,

  init() {
    this.connectWebSocket();
    this.setupNavigation();
    this.loadSettings();
    this.loadSidebarHistory();
    
    // New chat button
    document.getElementById('btnNewChat').addEventListener('click', () => {
      this.newChat();
    });
    
    // Sidebar toggle (desktop)
    document.getElementById('sidebarToggle').addEventListener('click', () => {
      this.toggleSidebar();
    });

    // Mobile menu button
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => {
        this.toggleSidebar();
      });
    }

    // Sidebar backdrop (mobile)
    const backdrop = document.getElementById('sidebarBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        this.closeSidebar();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+N = New Chat
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        this.newChat();
      }
    });
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    sidebar.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('open');
  },

  closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  },

  connectWebSocket() {
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${wsProtocol}//${location.host}`);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.reconnectAttempts = 0;
      this.setStatus('Ready', false);
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.handleWSMessage(msg);
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      this.setStatus('Disconnected', false);
      if (this.reconnectAttempts < 10) {
        this.reconnectAttempts++;
        setTimeout(() => this.connectWebSocket(), 2000 * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  },

  handleWSMessage(msg) {
    switch (msg.type) {
      case 'chat_start':
        this.currentConversationId = msg.conversationId;
        ChatPanel.onChatStart(msg.conversationId);
        break;
      case 'chat_chunk':
        ChatPanel.onChunk(msg.content);
        break;
      case 'tool_call':
        ChatPanel.onToolCall(msg);
        break;
      case 'chat_complete':
        ChatPanel.onComplete(msg.content, msg.conversationId);
        this.isProcessing = false;
        this.setStatus('Ready', false);
        this.loadSidebarHistory();
        break;
      case 'error':
        ChatPanel.onError(msg.message);
        this.isProcessing = false;
        this.setStatus('Ready', false);
        break;
    }
  },

  sendMessage(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      ChatPanel.onError('Not connected to server. Please refresh the page.');
      return;
    }

    this.isProcessing = true;
    this.setStatus('Thinking...', true);

    this.ws.send(JSON.stringify({
      type: 'chat',
      message,
      conversationId: this.currentConversationId
    }));
  },

  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.panel;
        this.switchPanel(panel);
      });
    });
  },

  switchPanel(panelName) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.panel === panelName);
    });

    // Update panels
    document.querySelectorAll('.panel').forEach(panel => {
      panel.classList.remove('active');
    });
    const targetPanel = document.getElementById(`panel${panelName.charAt(0).toUpperCase() + panelName.slice(1)}`);
    if (targetPanel) targetPanel.classList.add('active');

    this.currentPanel = panelName;

    // Load panel data
    switch (panelName) {
      case 'history': HistoryPanel.load(); break;
      case 'skills': SkillsPanel.load(); break;
      case 'memory': MemoryPanel.load(); break;
      case 'automations': AutomationsPanel.load(); break;
      case 'usage': UsagePanel.load(); break;
      case 'settings': SettingsPanel.load(); break;
    }

    // Close mobile sidebar on navigation
    this.closeSidebar();
  },

  newChat() {
    this.currentConversationId = null;
    ChatPanel.reset();
    this.switchPanel('chat');
    // Deselect sidebar history items
    document.querySelectorAll('.sidebar-history-item').forEach(el => el.classList.remove('active'));
  },

  loadConversation(id) {
    this.currentConversationId = id;
    ChatPanel.loadConversation(id);
    this.switchPanel('chat');
    // Highlight active conversation in sidebar
    document.querySelectorAll('.sidebar-history-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });
  },

  async loadSidebarHistory() {
    try {
      const conversations = await this.api('GET', '/api/history');
      this.renderSidebarHistory(conversations);
    } catch (e) {
      console.error('Failed to load sidebar history:', e);
    }
  },

  renderSidebarHistory(conversations) {
    const container = document.getElementById('sidebarHistory');
    if (!container) return;

    if (!conversations || conversations.length === 0) {
      container.innerHTML = '<div style="padding: 20px 12px; color: var(--text-tertiary); font-size: 13px; text-align: center;">No conversations yet</div>';
      return;
    }

    // Group by date
    const groups = { today: [], yesterday: [], week: [], month: [], older: [] };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart); monthStart.setDate(monthStart.getDate() - 30);

    for (const conv of conversations) {
      const d = new Date(conv.updated_at + 'Z');
      if (d >= todayStart) groups.today.push(conv);
      else if (d >= yesterdayStart) groups.yesterday.push(conv);
      else if (d >= weekStart) groups.week.push(conv);
      else if (d >= monthStart) groups.month.push(conv);
      else groups.older.push(conv);
    }

    let html = '';
    const renderGroup = (label, items) => {
      if (items.length === 0) return '';
      let h = `<div class="sidebar-history-group"><div class="sidebar-history-group-label">${label}</div>`;
      for (const conv of items) {
        const isActive = conv.id === this.currentConversationId ? ' active' : '';
        const title = this.escapeHtml(conv.title || 'Untitled');
        h += `<button class="sidebar-history-item${isActive}" data-id="${conv.id}" title="${title}">
          <span class="sidebar-history-item-title">${title}</span>
          <span class="item-actions"><button data-id="${conv.id}" class="sidebar-delete-btn" title="Delete">✕</button></span>
        </button>`;
      }
      h += '</div>';
      return h;
    };

    html += renderGroup('Today', groups.today);
    html += renderGroup('Yesterday', groups.yesterday);
    html += renderGroup('Previous 7 Days', groups.week);
    html += renderGroup('Previous 30 Days', groups.month);
    html += renderGroup('Older', groups.older);

    container.innerHTML = html;

    // Bind click events
    container.querySelectorAll('.sidebar-history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.sidebar-delete-btn')) return;
        this.loadConversation(item.dataset.id);
      });
    });

    container.querySelectorAll('.sidebar-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (await this.confirm('Delete this conversation?')) {
          await this.api('DELETE', `/api/history/${btn.dataset.id}`);
          if (this.currentConversationId === btn.dataset.id) {
            this.newChat();
          }
          this.loadSidebarHistory();
        }
      });
    });
  },

  setStatus(text, busy) {
    const indicator = document.getElementById('statusIndicator');
    if (!indicator) return;
    const statusText = indicator.querySelector('.status-text');
    statusText.textContent = text;
    indicator.classList.toggle('busy', busy);
  },

  async loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const settings = await res.json();
      const model = settings.model || 'No model selected';
      const badge = document.getElementById('modelBadge');
      if (badge) {
        badge.textContent = model.split('/').pop() || model;
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  },

  async api(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    return res.json();
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'error') icon = '❌';
    if (type === 'success') icon = '✅';
    
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span style="flex:1;">${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  confirm(message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      if (!modal) return resolve(window.confirm(message));

      const msgEl = document.getElementById('confirmMessage');
      const btnCancel = document.getElementById('confirmCancel');
      const btnOk = document.getElementById('confirmOk');

      msgEl.textContent = message;
      modal.classList.add('open');

      const cleanup = () => {
        modal.classList.remove('open');
        btnCancel.removeEventListener('click', onCancel);
        btnOk.removeEventListener('click', onOk);
      };

      const onCancel = () => { cleanup(); resolve(false); };
      const onOk = () => { cleanup(); resolve(true); };

      btnCancel.addEventListener('click', onCancel);
      btnOk.addEventListener('click', onOk);
    });
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
