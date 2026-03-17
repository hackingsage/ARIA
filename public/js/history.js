// ─── History Panel ─────────────────────────────────────────

const HistoryPanel = {
  conversations: [],

  init() {
    document.getElementById('historySearch').addEventListener('input', (e) => {
      this.filterConversations(e.target.value);
    });
  },

  async load() {
    try {
      this.conversations = await App.api('GET', '/api/history');
      this.render();
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  },

  render(filtered) {
    const list = document.getElementById('historyList');
    const items = filtered || this.conversations;

    if (items.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <p>No conversations yet</p>
        </div>
      `;
      return;
    }

    list.innerHTML = items.map(conv => `
      <div class="history-item" data-id="${conv.id}">
        <div class="history-item-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="history-item-body">
          <div class="history-item-title">${this.escapeHtml(conv.title)}</div>
          <div class="history-item-meta">${conv.message_count} messages · ${this.formatDate(conv.updated_at)}</div>
        </div>
        <div class="history-item-actions">
          <button class="btn-danger btn-delete-conv" data-id="${conv.id}" title="Delete">✕</button>
        </div>
      </div>
    `).join('');

    // Bind click events
    list.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-conv')) return;
        App.loadConversation(item.dataset.id);
      });
    });

    list.querySelectorAll('.btn-delete-conv').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (await App.confirm('Delete this conversation?')) {
          await App.api('DELETE', `/api/history/${btn.dataset.id}`);
          this.load();
        }
      });
    });
  },

  filterConversations(query) {
    if (!query) {
      this.render();
      return;
    }
    const q = query.toLowerCase();
    const filtered = this.conversations.filter(c => c.title.toLowerCase().includes(q));
    this.render(filtered);
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'Z');
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  HistoryPanel.init();
});
