const URL_RE = /\b(https?:\/\/[^\s<>"]+)/g;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function autolink(s: string) {
  return s.replace(URL_RE, (m) => {
    const safe = escapeHtml(m);
    return `<a href="${safe}" target="_blank" rel="noopener nofollow ugc">${safe}</a>`;
  });
}

export function renderBody(text: string): string {
  const escaped = escapeHtml(text);
  const paragraphs = escaped.split(/\n{2,}/);
  return paragraphs
    .map((p) => `<p>${autolink(p.replace(/\n/g, '<br>'))}</p>`)
    .join('');
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export function relativeTime(d: Date) {
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'hace instantes';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)} d`;
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}
