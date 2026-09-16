import { describe, it, expect } from 'vitest';
import { sanitizeUrl, sanitizeCssUrl } from './sanitize';

describe('sanitizeUrl', () => {
  it('allows http and https URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('allows mailto and tel', () => {
    expect(sanitizeUrl('mailto:test@example.com')).toBe('mailto:test@example.com');
    expect(sanitizeUrl('tel:+1234567890')).toBe('tel:+1234567890');
  });

  it('blocks javascript: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBe('');
    expect(sanitizeUrl('javascript :alert(1)')).toBe('https://javascript :alert(1)');
  });

  it('blocks data: URLs in general and SVG data URIs', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeUrl('data:image/svg+xml;base64,PHN2Zy...')).toBe('');
    expect(sanitizeUrl('data:image/svg+xml;utf8,<svg onload=alert(1)>')).toBe('');
    expect(sanitizeUrl('DATA:IMAGE/SVG+XML;base64,PHN2Zy...')).toBe('');
  });

  it('allows safe raster data:image URLs', () => {
    expect(sanitizeUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(sanitizeUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    expect(sanitizeUrl('data:image/webp;base64,UklGRg==')).toBe('data:image/webp;base64,UklGRg==');
  });

  it('allows relative URLs without prepending https://', () => {
    expect(sanitizeUrl('/path/to/resource')).toBe('/path/to/resource');
    expect(sanitizeUrl('?query=1')).toBe('?query=1');
    expect(sanitizeUrl('#hash')).toBe('#hash');
  });

  it('allows internal firestore_chunked URIs', () => {
    expect(sanitizeUrl('firestore_chunked|vid_123_abc')).toBe('firestore_chunked|vid_123_abc');
  });
});

describe('sanitizeCssUrl', () => {
  it('allows valid URLs and wraps in url()', () => {
    expect(sanitizeCssUrl('https://example.com/image.png')).toBe("url('https://example.com/image.png')");
  });

  it('removes javascript: from css', () => {
    expect(sanitizeCssUrl('javascript:alert(1)')).toBe('none');
  });

  it('blocks SVG data URIs from css url()', () => {
    expect(sanitizeCssUrl('data:image/svg+xml;base64,PHN2Zy...')).toBe('none');
    expect(sanitizeCssUrl('data:image/svg+xml;utf8,<svg onload=alert(1)>')).toBe('none');
  });

  it('allows raster data URIs in css url()', () => {
    expect(sanitizeCssUrl('data:image/png;base64,iVBORw0KGgo=')).toBe("url('data:image/png;base64,iVBORw0KGgo=')");
  });
});
