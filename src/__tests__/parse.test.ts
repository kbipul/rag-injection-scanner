import { describe, expect, it } from 'vitest';
import { parseChunks } from '../engine/parse';

describe('parseChunks', () => {
  it('returns nothing for empty input', () => {
    expect(parseChunks('   \n  ')).toEqual([]);
  });

  it('splits plain text on dashed separators', () => {
    const chunks = parseChunks('first chunk\n---\nsecond chunk\n---\nthird');
    expect(chunks).toHaveLength(3);
    expect(chunks[0].text).toBe('first chunk');
    expect(chunks[2].id).toBe(3);
  });

  it('lifts a leading source: line out of the body', () => {
    const [chunk] = parseChunks('source: wiki/policy.md\nBody text here.');
    expect(chunk.source).toBe('wiki/policy.md');
    expect(chunk.text).toBe('Body text here.');
  });

  it('treats input with no separator as a single chunk', () => {
    const chunks = parseChunks('just one passage, no separators at all');
    expect(chunks).toHaveLength(1);
  });

  it('parses a JSON array of strings', () => {
    const chunks = parseChunks('["alpha", "beta"]');
    expect(chunks.map((c) => c.text)).toEqual(['alpha', 'beta']);
  });

  it('parses LangChain-style objects', () => {
    const chunks = parseChunks(
      '[{"page_content":"hello","source":"a.md"},{"text":"world","url":"b.md"}]',
    );
    expect(chunks[0].source).toBe('a.md');
    expect(chunks[1].text).toBe('world');
    expect(chunks[1].source).toBe('b.md');
  });

  it('ignores array entries with no text field', () => {
    const chunks = parseChunks('[{"score":0.9},{"text":"kept"}]');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('kept');
  });

  it('falls back to plain text when the JSON is malformed', () => {
    const chunks = parseChunks('[{"text": "unterminated');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain('unterminated');
  });

  it('does not lose a dashed line inside a code block boundary count', () => {
    const chunks = parseChunks('a\n----\nb');
    expect(chunks).toHaveLength(2);
  });
});
