import type { Chunk } from './types';

/**
 * Accepts the three shapes people actually have on hand when they want to
 * inspect a retrieval result:
 *
 *  1. A JSON array of strings.
 *  2. A JSON array of objects with a text-ish field (`text`, `content`,
 *     `page_content`, `pageContent`, `chunk`) and an optional source field.
 *  3. Plain text, where a line of three or more dashes separates chunks.
 *
 * Anything unparseable falls back to "the whole input is one chunk", because
 * a scanner that refuses input is a scanner nobody runs.
 */
const TEXT_KEYS = ['text', 'content', 'page_content', 'pageContent', 'chunk', 'body'];
const SOURCE_KEYS = ['source', 'url', 'uri', 'path', 'id', 'title', 'document'];

function pick(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

export function parseChunks(input: string): Chunk[] {
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const chunks: Chunk[] = [];
        parsed.forEach((entry, i) => {
          if (typeof entry === 'string') {
            chunks.push({ id: i + 1, text: entry });
          } else if (entry && typeof entry === 'object') {
            const rec = entry as Record<string, unknown>;
            const text = pick(rec, TEXT_KEYS);
            if (text !== undefined) {
              chunks.push({ id: i + 1, text, source: pick(rec, SOURCE_KEYS) });
            }
          }
        });
        if (chunks.length > 0) return chunks;
      }
    } catch {
      // fall through to the plain-text path
    }
  }

  const parts = trimmed
    .split(/^[ \t]*-{3,}[ \t]*$/m)
    .map((p) => p.replace(/^\n+|\n+$/g, ''))
    .filter((p) => p.trim().length > 0);

  const source = /^\s*source\s*:\s*(.+)$/im;
  return parts.map((part, i) => {
    const m = part.match(source);
    return {
      id: i + 1,
      text: m ? part.replace(m[0], '').replace(/^\n+/, '') : part,
      source: m ? m[1].trim() : undefined,
    };
  });
}
