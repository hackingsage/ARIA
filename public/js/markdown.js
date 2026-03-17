// ─── Markdown Renderer ─────────────────────────────────────
// Lightweight markdown to HTML converter

const MarkdownRenderer = {
  render(text) {
    if (!text) return '';
    let html = this.escapeHtml(text);

    // Code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, originalCode) => {
      const code = originalCode.trim();
      const language = lang || 'plaintext';
      
      let highlightedCode = code;
      try {
        if (window.hljs) {
          if (language && hljs.getLanguage(language)) {
            highlightedCode = hljs.highlight(code, { language }).value;
          } else {
            highlightedCode = hljs.highlightAuto(code).value;
          }
        }
      } catch (e) {}

      // Encode the original code for the copy button's dataset
      const encodedCode = this.escapeHtml(code).replace(/"/g, '&quot;');

      return `
      <pre>
        <div class="code-header">
          <span>${language}</span>
          <button class="code-copy-btn" onclick="MarkdownRenderer.copyCode(this)" data-code="${encodedCode}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
        </div>
        <code class="hljs language-${language}">${highlightedCode}</code>
      </pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold & italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // Tables
    html = html.replace(/^\|(.+)\|\n\|([-: |]+)\|\n((?:\|.+\|\n?)+)/gm, (match, header, align, body) => {
      const getCells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const headerCells = getCells(`|${header}|`).map(c => `<th>${c}</th>`).join('');
      const bodyRows = body.trim().split('\n').map(row => {
        return `<tr>${getCells(row).map(c => `<td>${c}</td>`).join('')}</tr>`;
      }).join('');
      return `<div class="table-wrapper"><table class="md-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
    });

    // Unordered lists
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Paragraphs (double newlines)
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    // KaTeX Block Math ($$...$$)
    html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try { return window.katex ? window.katex.renderToString(math, { displayMode: true }) : `$$${math}$$`; }
      catch(e) { return `<span class="katex-error" style="color:red;" title="${e.message}">${math}</span>`; }
    });

    // KaTeX Inline Math ($...$)
    html = html.replace(/\$([^$\n]+?)\$/g, (_, math) => {
      try { return window.katex ? window.katex.renderToString(math, { displayMode: false }) : `$${math}$`; }
      catch(e) { return `<span class="katex-error" style="color:red;" title="${e.message}">${math}</span>`; }
    });

    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<')) {
      html = `<p>${html}</p>`;
    }

    return html;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  copyCode(button) {
    const code = button.getAttribute('data-code');
    // Decode HTML entities (browser method)
    const textarea = document.createElement('textarea');
    textarea.innerHTML = code;
    const decodedCode = textarea.value;

    navigator.clipboard.writeText(decodedCode).then(() => {
      const span = button.querySelector('span');
      const originalText = span.textContent;
      span.textContent = 'Copied!';
      button.style.color = 'var(--accent-emerald)';
      setTimeout(() => {
        span.textContent = originalText;
        button.style.color = '';
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy code: ', err);
    });
  }
};
