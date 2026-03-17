// ─── Memory Panel ──────────────────────────────────────────

const MemoryPanel = {
  currentCategory: '',

  init() {
    document.getElementById('btnNewMemory').addEventListener('click', () => this.openModal());
    document.getElementById('memoryModalClose').addEventListener('click', () => this.closeModal());
    document.getElementById('memoryModalCancel').addEventListener('click', () => this.closeModal());
    document.getElementById('memoryModalSave').addEventListener('click', () => this.saveMemory());

    // Filter chips
    document.querySelectorAll('#memoryFilters .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#memoryFilters .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentCategory = chip.dataset.category;
        this.load();
      });
    });
  },

  async load() {
    try {
      const url = this.currentCategory ? `/api/memory?category=${this.currentCategory}` : '/api/memory';
      const memories = await App.api('GET', url);
      this.render(memories);
    } catch (e) {
      console.error('Failed to load memories:', e);
    }
  },

  render(memories) {
    const list = document.getElementById('memoryList');

    if (memories.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
          <p>No memories ${this.currentCategory ? 'in this category' : 'yet'}</p>
          <span>ARIA remembers important information from your conversations</span>
        </div>
      `;
      return;
    }

    const categoryColors = {
      preference: '#8B5CF6',
      fact: '#06B6D4',
      note: '#10B981',
      task: '#F59E0B',
      general: '#9999b3'
    };

    list.innerHTML = memories.map(m => `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${this.escapeHtml(m.key)}</span>
          <button class="btn-danger btn-delete-memory" data-id="${m.id}">✕</button>
        </div>
        <div class="card-description">${this.escapeHtml(m.content)}</div>
        <div class="card-meta">
          <span class="card-tag" style="color:${categoryColors[m.category] || categoryColors.general}">${m.category}</span>
          <span>${new Date(m.created_at + 'Z').toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.btn-delete-memory').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (await App.confirm('Delete this memory?')) {
          await App.api('DELETE', `/api/memory/${btn.dataset.id}`);
          this.load();
        }
      });
    });
  },

  openModal() {
    document.getElementById('memoryModal').classList.add('open');
  },

  closeModal() {
    document.getElementById('memoryModal').classList.remove('open');
    document.getElementById('memoryKey').value = '';
    document.getElementById('memoryContent').value = '';
    document.getElementById('memoryCategory').value = 'general';
  },

  async saveMemory() {
    const key = document.getElementById('memoryKey').value.trim();
    const content = document.getElementById('memoryContent').value.trim();
    const category = document.getElementById('memoryCategory').value;

    if (!key || !content) {
      App.showToast('Label and content are required', 'error');
      return;
    }

    try {
      await App.api('POST', '/api/memory', { key, content, category });
      this.closeModal();
      this.load();
    } catch (e) {
      App.showToast('Failed to save memory: ' + e.message, 'error');
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  MemoryPanel.init();
});
