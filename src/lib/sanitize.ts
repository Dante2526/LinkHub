const SAFE_URL_RE = /^(https?:|mailto:|tel:|blob:|data:image\/(png|jpe?g|gif|webp|bmp|x-icon)(;base64)?,)/i;
const BLOCKED_RE = /^(javascript:|vbscript:|file:|about:)/i; // Removido data: da lista geral, data:image/ é permitido

export function sanitizeUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (BLOCKED_RE.test(trimmed)) {
    if (import.meta.env.DEV) console.warn('URL bloqueada por seguranca:', trimmed);
    return '';
  }
  // Bloqueia data: URIs que não sejam imagens raster aprovadas
  if (/^data:/i.test(trimmed) && !SAFE_URL_RE.test(trimmed)) {
    if (import.meta.env.DEV) console.warn('Data URI não-aprovado bloqueado:', trimmed);
    return '';
  }
  // Permite URLs relativas ou âncoras locais
  if (/^[./?#]/.test(trimmed)) {
    return trimmed;
  }
  
  // Permite URIs internos customizados do app
  if (trimmed.startsWith('firestore_chunked|')) {
    return trimmed;
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
    if (!/^https?:$/.test(u.protocol) && !/^data:/.test(u.protocol)) throw new Error('bad protocol');
    if (/^data:/.test(u.protocol) && !SAFE_URL_RE.test(cleaned)) throw new Error('only approved data:image raster formats are allowed');
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
