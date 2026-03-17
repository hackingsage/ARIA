// ─── Usage Panel ──────────────────────────────────────────

const UsagePanel = {
  init() {
    document.getElementById('btnRefreshUsage').addEventListener('click', () => {
      document.getElementById('btnRefreshUsage').textContent = 'Refreshing...';
      document.getElementById('btnRefreshUsage').disabled = true;
      this.load();
    });
  },

  async load() {
    try {
      const data = await App.api('GET', '/api/usage');
      this.render(data);
    } catch (e) {
      this.renderError(e.message);
    } finally {
      document.getElementById('btnRefreshUsage').textContent = 'Refresh Data';
      document.getElementById('btnRefreshUsage').disabled = false;
    }
  },

  render(data) {
    const container = document.getElementById('usageContent');

    if (data.error || data.usage === undefined) {
      if (data.error && data.error === 'API key not set') {
        container.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p>OpenRouter API Key Not Configured</p>
            <span>Please go to Settings to add your key.</span>
          </div>
        `;
        return;
      }
      this.renderError(data.error || 'Failed to parse OpenRouter response.');
      return;
    }

    const usage = data.usage || 0;
    const limit = data.limit != null ? data.limit : (data.limit_app != null ? data.limit_app : null);
    
    let limitText = limit == null ? '∞ Unlimited' : `$${limit.toFixed(4)}`;
    let balanceText = (limit != null && limit !== 0) ? `$${(limit - usage).toFixed(4)}` : 'N/A';
    
    if (data.is_free_tier) {
      limitText = 'Free Tier';
      balanceText = 'N/A';
    }

    container.innerHTML = `
      <!-- Usage Overview Grid -->
      <div class="usage-stats-grid">
        <div class="usage-stat-card">
          <div class="usage-stat-label">Total Usage</div>
          <div class="usage-stat-value" style="color: var(--accent-emerald);">$${usage.toFixed(4)}</div>
        </div>
        
        <div class="usage-stat-card">
          <div class="usage-stat-label">Credit Limit</div>
          <div class="usage-stat-value" style="color: var(--accent-cyan);">${limitText}</div>
        </div>
        
        <div class="usage-stat-card">
          <div class="usage-stat-label">Remaining</div>
          <div class="usage-stat-value" style="color: var(--accent-violet);">${balanceText}</div>
        </div>
      </div>
      
      <!-- Key Details -->
      <div class="settings-section" style="margin-top: 20px;">
        <h2>Key Information</h2>
        <div class="card">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <tbody>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid var(--border); color: var(--text-secondary);">Key Name</td>
                <td style="padding: 12px 0; border-bottom: 1px solid var(--border); font-weight: 500;">${data.label || 'Unknown'}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid var(--border); color: var(--text-secondary);">Rate Limit</td>
                <td style="padding: 12px 0; border-bottom: 1px solid var(--border); font-weight: 500;">${data.rate_limit ? `${data.rate_limit.requests} req / ${data.rate_limit.interval}` : 'Default limit'}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: var(--text-secondary);">Free Tier</td>
                <td style="padding: 12px 0; font-weight: 500;">${data.is_free_tier ? '✅ Yes' : '❌ No'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderError(msg) {
    document.getElementById('usageContent').innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p style="color: var(--accent-rose);">Error Fetching Usage</p>
        <span>${this.escapeHtml(msg)}</span>
      </div>
    `;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  UsagePanel.init();
});
