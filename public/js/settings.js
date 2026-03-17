// ─── Settings Panel ────────────────────────────────────────

const SettingsPanel = {
  modelsCache: [],

  init() {
    document.getElementById('btnSaveApiKey').addEventListener('click', () => this.saveApiKey());
    document.getElementById('btnRefreshModels').addEventListener('click', () => this.loadModels());
    
    document.getElementById('settingsModel').addEventListener('change', (e) => {
      this.saveSetting('model', e.target.value);
      this.updateBadges(e.target.value, document.getElementById('settingsFallbackModel').value);
    });

    document.getElementById('settingsFallbackModel').addEventListener('change', (e) => {
      this.saveSetting('fallback_model', e.target.value);
      this.updateBadges(document.getElementById('settingsModel').value, e.target.value);
    });

    // Save API key on enter
    document.getElementById('settingsApiKey').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.saveApiKey();
    });
  },

  async load() {
    try {
      const settings = await App.api('GET', '/api/settings');
      
      const apiKeyInput = document.getElementById('settingsApiKey');
      if (settings.api_key_masked) {
        apiKeyInput.placeholder = settings.api_key_masked;
      }

      this.loadModels(settings.model, settings.fallback_model);
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  },

  async saveApiKey() {
    const apiKey = document.getElementById('settingsApiKey').value.trim();
    if (!apiKey) {
      App.showToast('Please enter your OpenRouter API key', 'error');
      return;
    }

    try {
      await App.api('POST', '/api/settings', { key: 'api_key', value: apiKey });
      document.getElementById('settingsApiKey').value = '';
      document.getElementById('settingsApiKey').placeholder = apiKey.substring(0, 8) + '...' + apiKey.slice(-4);
      
      // Reload models with new key
      this.loadModels();
      App.showToast('API key saved successfully!', 'success');
    } catch (e) {
      App.showToast('Failed to save API key: ' + e.message, 'error');
    }
  },

  async loadModels(currentModel, currentFallback) {
    const primarySelect = document.getElementById('settingsModel');
    const fallbackSelect = document.getElementById('settingsFallbackModel');
    primarySelect.innerHTML = '<option value="">Loading models...</option>';
    fallbackSelect.innerHTML = '<option value="">Loading...</option>';

    try {
      const models = await App.api('GET', '/api/models');
      this.modelsCache = models;
      
      if (models.length === 0) {
        primarySelect.innerHTML = '<option value="">No models found (check API key)</option>';
        fallbackSelect.innerHTML = '<option value="">No models found</option>';
        return;
      }

      // Sort by name
      models.sort((a, b) => (a.id || '').localeCompare(b.id || ''));

      // Popular models first
      const popular = [
        'anthropic/claude-sonnet-4',
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
        'google/gemini-2.0-flash-001',
        'google/gemini-2.5-pro-preview',
        'meta-llama/llama-3.3-70b-instruct',
        'deepseek/deepseek-chat-v3-0324'
      ];

      const popularModels = models.filter(m => popular.includes(m.id));
      const otherModels = models.filter(m => !popular.includes(m.id));

      // Build options HTML for both selects
      const buildOptions = (selected) => {
        let html = '<optgroup label="Popular Models">';
        for (const m of popularModels) {
          const sel = (selected === m.id) ? 'selected' : '';
          html += `<option value="${m.id}" ${sel}>${m.id}</option>`;
        }
        html += '</optgroup>';
        html += `<optgroup label="All Models (${otherModels.length})">`;
        for (const m of otherModels) {
          const sel = (selected === m.id) ? 'selected' : '';
          html += `<option value="${m.id}" ${sel}>${m.id}</option>`;
        }
        html += '</optgroup>';
        return html;
      };

      // Primary model selector
      primarySelect.innerHTML = buildOptions(currentModel);

      // Fallback model selector (with "None" option)
      fallbackSelect.innerHTML = `<option value="" ${!currentFallback ? 'selected' : ''}>None (no fallback)</option>` + buildOptions(currentFallback);

      // If no primary model selected yet, select a default
      if (!currentModel && popularModels.length > 0) {
        primarySelect.value = popularModels[0].id;
        this.saveSetting('model', popularModels[0].id);
        currentModel = popularModels[0].id;
      }

      this.updateBadges(currentModel || primarySelect.value, currentFallback || fallbackSelect.value);
    } catch (e) {
      primarySelect.innerHTML = '<option value="">Failed to load models</option>';
      fallbackSelect.innerHTML = '<option value="">Failed to load models</option>';
    }
  },

  updateBadges(primary, fallback) {
    const badge = document.getElementById('modelBadge');
    const fallbackBadge = document.getElementById('fallbackBadge');
    
    if (badge) {
      badge.textContent = '⭐ ' + (primary ? primary.split('/').pop() : 'No model');
    }
    
    if (fallbackBadge) {
      if (fallback) {
        fallbackBadge.textContent = '🔄 ' + fallback.split('/').pop();
        fallbackBadge.style.display = 'inline';
      } else {
        fallbackBadge.style.display = 'none';
      }
    }
  },

  async saveSetting(key, value) {
    try {
      await App.api('POST', '/api/settings', { key, value });
      App.loadSettings();
    } catch (e) {
      console.error('Failed to save setting:', e);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  SettingsPanel.init();
});
