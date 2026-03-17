// ─── Skills Panel ──────────────────────────────────────────

const SkillsPanel = {
  init() {
    document.getElementById('btnNewSkill').addEventListener('click', () => this.openModal());
    document.getElementById('skillModalClose').addEventListener('click', () => this.closeModal());
    document.getElementById('skillModalCancel').addEventListener('click', () => this.closeModal());
    document.getElementById('skillModalSave').addEventListener('click', () => this.saveSkill());
  },

  async load() {
    try {
      const skills = await App.api('GET', '/api/skills');
      this.render(skills);
    } catch (e) {
      console.error('Failed to load skills:', e);
    }
  },

  render(skills) {
    const list = document.getElementById('skillsList');

    if (skills.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <p>No skills created yet</p>
          <span>Skills are reusable code blocks that extend ARIA's capabilities</span>
        </div>
      `;
      return;
    }

    list.innerHTML = skills.map(skill => `
      <div class="card">
        <div class="card-header">
          <span class="card-title">⭐ ${this.escapeHtml(skill.name)}</span>
          <div style="display:flex;gap:8px;">
            <button class="btn-secondary btn-run-skill" data-name="${this.escapeHtml(skill.name)}" style="font-size:12px;padding:4px 12px;">▶ Run</button>
            <button class="btn-danger btn-delete-skill" data-id="${skill.id}">✕</button>
          </div>
        </div>
        ${skill.description ? `<div class="card-description">${this.escapeHtml(skill.description)}</div>` : ''}
        <div class="card-meta">
          <span class="card-tag">${skill.trigger_type || 'manual'}</span>
          <span>Created ${new Date(skill.created_at + 'Z').toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');

    // Bind events
    list.querySelectorAll('.btn-run-skill').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.textContent = '⏳ Running...';
        btn.disabled = true;
        try {
          const result = await App.api('POST', `/api/skills/${btn.dataset.name}/run`);
          if (result.success) {
            App.showToast(`Skill completed! ${result.output || ''}`, 'success');
          } else {
            App.showToast(`Error: ${result.error}`, 'error');
          }
        } catch (e) {
          App.showToast('Failed to run skill: ' + e.message, 'error');
        }
        btn.textContent = '▶ Run';
        btn.disabled = false;
      });
    });

    list.querySelectorAll('.btn-delete-skill').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (await App.confirm('Delete this skill?')) {
          await App.api('DELETE', `/api/skills/${btn.dataset.id}`);
          this.load();
        }
      });
    });
  },

  openModal() {
    document.getElementById('skillModal').classList.add('open');
  },

  closeModal() {
    document.getElementById('skillModal').classList.remove('open');
    document.getElementById('skillName').value = '';
    document.getElementById('skillDescription').value = '';
    document.getElementById('skillCode').value = '';
  },

  async saveSkill() {
    const name = document.getElementById('skillName').value.trim();
    const description = document.getElementById('skillDescription').value.trim();
    const code = document.getElementById('skillCode').value.trim();

    if (!name || !code) {
      App.showToast('Name and code are required', 'error');
      return;
    }

    try {
      await App.api('POST', '/api/skills', { name, description, code });
      this.closeModal();
      this.load();
    } catch (e) {
      App.showToast('Failed to create skill: ' + e.message, 'error');
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  SkillsPanel.init();
});
