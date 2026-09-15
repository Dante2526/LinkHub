const SAFE_URL_RE = /^(https?:|mailto:|tel:|blob:)/i;
const BLOCKED_RE = /^(javascript:|data:|vbscript:|file:|about:)/i;

export function sanitizeUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (BLOCKED_RE.test(trimmed)) {
    if (import.meta.env.DEV) console.warn('URL bloqueada por seguranca:', trimmed);
    return '';
  }
  if (!SAFE_URL_RE.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function sanitizeCssUrl(raw: string): string {
  if (!raw) return 'none';
  const cleaned = raw.replace(/[\u0000-\u001F]/g, '');
  try {
    const u = new URL(cleaned);
    if (!/^https?:$/.test(u.protocol)) throw new Error('bad protocol');
  } catch { return 'none'; }
  const escaped = cleaned.replace(/(["'\\])/g, '\\$1');
  return `url('${escaped}')`;
}

export function isPrivateUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return /^127\./.test(h) ||
           /^10\./.test(h) ||
           /^192\.168\./.test(h) ||
           /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
           /^169\.254\./.test(h) ||
           h === 'localhost' ||
           h === '::1' ||
           /^fc00:/i.test(h) ||
           /^fe80:/i.test(h);
  } catch { return true; }
}
