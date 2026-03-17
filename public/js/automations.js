// ─── Automations Panel ─────────────────────────────────────

const AutomationsPanel = {
  init() {
    document.getElementById('btnNewAutomation').addEventListener('click', () => this.openModal());
    document.getElementById('automationModalClose').addEventListener('click', () => this.closeModal());
    document.getElementById('automationModalCancel').addEventListener('click', () => this.closeModal());
    document.getElementById('automationModalSave').addEventListener('click', () => this.saveAutomation());
  },

  async load() {
    try {
      const automations = await App.api('GET', '/api/automations');
      this.render(automations);
    } catch (e) {
      console.error('Failed to load automations:', e);
    }
  },

  render(automations) {
    const list = document.getElementById('automationsList');

    if (automations.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          <p>No automations yet</p>
          <span>Schedule recurring tasks for ARIA to execute automatically</span>
        </div>
      `;
      return;
    }

    list.innerHTML = automations.map(auto => {
      let lastResult = '';
      if (auto.last_result) {
        try {
          const r = JSON.parse(auto.last_result);
          lastResult = r.success ? '✅ Last run succeeded' : `❌ ${r.error || 'Failed'}`;
        } catch { lastResult = auto.last_result; }
      }

      return `
        <div class="card">
          <div class="card-header">
            <span class="card-title">⚡ ${this.escapeHtml(auto.name)}</span>
            <div style="display:flex;align-items:center;gap:12px;">
              <label class="toggle-switch">
                <input type="checkbox" ${auto.enabled ? 'checked' : ''} data-id="${auto.id}" class="toggle-automation">
                <span class="toggle-slider"></span>
              </label>
              <button class="btn-danger btn-delete-automation" data-id="${auto.id}">✕</button>
            </div>
          </div>
          ${auto.description ? `<div class="card-description">${this.escapeHtml(auto.description)}</div>` : ''}
          <div class="card-meta">
            <span class="card-tag">🕐 ${this.escapeHtml(auto.cron_expression)}</span>
            <span>${auto.enabled ? 'Active' : 'Paused'}</span>
            ${auto.last_run ? `<span>Last: ${new Date(auto.last_run).toLocaleString()}</span>` : ''}
          </div>
          ${lastResult ? `<div class="card-meta" style="margin-top:6px;">${lastResult}</div>` : ''}
        </div>
      `;
    }).join('');

    // Bind toggle events
    list.querySelectorAll('.toggle-automation').forEach(toggle => {
      toggle.addEventListener('change', async () => {
        await App.api('PUT', `/api/automations/${toggle.dataset.id}`, {
          enabled: toggle.checked ? 1 : 0
        });
        this.load();
      });
    });

    // Bind delete events
    list.querySelectorAll('.btn-delete-automation').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (await App.confirm('Delete this automation?')) {
          await App.api('DELETE', `/api/automations/${btn.dataset.id}`);
          this.load();
        }
      });
    });
  },

  openModal() {
    document.getElementById('automationModal').classList.add('open');
  },

  closeModal() {
    document.getElementById('automationModal').classList.remove('open');
    document.getElementById('autoName').value = '';
    document.getElementById('autoDescription').value = '';
    document.getElementById('autoCron').value = '';
    document.getElementById('autoPrompt').value = '';
  },

  async saveAutomation() {
    const name = document.getElementById('autoName').value.trim();
    const description = document.getElementById('autoDescription').value.trim();
    const cron_expression = document.getElementById('autoCron').value.trim();
    const action_payload = document.getElementById('autoPrompt').value.trim();

    if (!name || !cron_expression || !action_payload) {
      App.showToast('Name, cron schedule, and prompt are required', 'error');
      return;
    }

    try {
      await App.api('POST', '/api/automations', {
        name, description, cron_expression, action_type: 'chat', action_payload
      });
      this.closeModal();
      this.load();
    } catch (e) {
      App.showToast('Failed to create automation: ' + e.message, 'error');
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AutomationsPanel.init();
});
