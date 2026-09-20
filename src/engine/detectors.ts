import type { Category, Finding, Severity } from './types';

export interface Rule {
  id: string;
  category: Category;
  severity: Severity;
  /** Must be a global regex. */
  pattern: RegExp;
  why: string;
  fix: string;
}

/**
 * Rules are deliberately conservative and explainable. Every one of them
 * describes a payload that only makes sense if the *document* is trying to
 * talk to the model instead of to the reader.
 */
export const RULES: Rule[] = [
  // --- instruction override -------------------------------------------------
  {
    id: 'ignore-previous',
    category: 'instruction-override',
    severity: 'critical',
    pattern:
      /\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+)?(?:the\s+)?(?:(?:previous|prior|earlier|above|preceding|foregoing|system|original|initial)\s+){1,2}(?:instructions?|prompts?|rules?|directions?|context|messages?|guidelines?)\b/gi,
    why: 'A retrieved document is data, not a turn in the conversation. Text that tells the model to discard its instructions is only useful to an attacker.',
    fix: 'Drop the chunk, or wrap retrieved text in an explicit data envelope and instruct the model that envelope contents are never instructions.',
  },
  {
    id: 'new-instructions',
    category: 'instruction-override',
    severity: 'critical',
    pattern:
      /\b(?:new|updated|revised|actual|real)\s+(?:instructions?|system\s+prompt|directive)s?\s*[:\-]/gi,
    why: 'Announces a replacement instruction block inside the corpus — the classic pivot from document to command.',
    fix: 'Reject the chunk and check how it entered the index; this is rarely accidental.',
  },
  {
    id: 'you-are-now',
    category: 'instruction-override',
    severity: 'high',
    pattern:
      /\byou\s+(?:are\s+now|must\s+now|will\s+now|should\s+now|are\s+no\s+longer)\b/gi,
    why: 'Attempts to redefine the assistant persona from inside retrieved content.',
    fix: 'Strip second-person imperatives from retrieved text before it reaches the prompt.',
  },
  {
    id: 'do-not-tell',
    category: 'instruction-override',
    severity: 'high',
    pattern:
      /\b(?:do\s+not|don't|never)\s+(?:tell|mention|inform|reveal\s+to|show)\s+(?:the\s+)?(?:user|human|operator|anyone)\b/gi,
    why: 'Instructs the model to hide its own behaviour from the person it is working for.',
    fix: 'Treat as hostile. Any content asking for concealment should never reach the context window.',
  },

  // --- role / delimiter spoofing -------------------------------------------
  {
    id: 'chatml-markers',
    category: 'role-spoofing',
    severity: 'critical',
    pattern: /<\|(?:im_start|im_end|system|user|assistant|endoftext)\|>/gi,
    why: 'Raw chat-template control tokens inside a document can terminate the data section and open a forged system turn.',
    fix: 'Escape or remove template control tokens during ingestion — they should never survive chunking.',
  },
  {
    id: 'inst-markers',
    category: 'role-spoofing',
    severity: 'high',
    pattern: /\[\/?INST\]|<<\/?SYS>>/g,
    why: 'Llama-family instruction delimiters embedded in retrieved text can forge a system message.',
    fix: 'Normalize or strip instruction delimiters at ingestion time.',
  },
  {
    id: 'role-header',
    category: 'role-spoofing',
    severity: 'high',
    pattern: /^\s*(?:#{1,6}\s*)?(?:system|assistant)\s*[:：]/gim,
    why: 'A line that opens with a role header imitates the conversation transcript format and can be read as a new turn.',
    fix: 'Prefix every retrieved line, or fence chunks with a nonce delimiter the document cannot guess.',
  },
  {
    id: 'xml-system-tag',
    category: 'role-spoofing',
    severity: 'high',
    pattern: /<\/?\s*(?:system|system_prompt|instructions?)\s*>/gi,
    why: 'Forged XML-style instruction tags exploit prompts that use tags to separate sections.',
    fix: 'Use a random per-request nonce in your section tags so retrieved text cannot forge them.',
  },

  // --- tool-call bait -------------------------------------------------------
  {
    id: 'tool-call-json',
    category: 'tool-call-bait',
    severity: 'critical',
    pattern: /"(?:tool_call|function_call|tool_use|tool_calls)"\s*:/gi,
    why: 'A serialized tool call inside a document is an attempt to get the model to emit or replay it verbatim.',
    fix: 'Never let retrieved text flow into a tool-call parser. Parse tool calls only from the model channel.',
  },
  {
    id: 'call-the-tool',
    category: 'tool-call-bait',
    severity: 'high',
    pattern:
      /\b(?:call|invoke|use|run|execute)\s+(?:the\s+)?(?:[a-z0-9_.-]+\s+)?(?:tool|function|command|script|mcp\s+server)\b/gi,
    why: 'Retrieved content directing the agent to take an action is the injection-to-action bridge.',
    fix: 'Require tool calls to be justified by the user turn, and gate side-effecting tools behind confirmation.',
  },
  {
    id: 'shell-pipe-exec',
    category: 'tool-call-bait',
    severity: 'critical',
    pattern:
      /\b(?:curl|wget)\b[^\n`]{0,200}\|\s*(?:ba)?sh\b|\brm\s+-rf\s+[~/*]|\bIEX\s*\(/gi,
    why: 'A pipe-to-shell one-liner in retrieved context is a payload waiting for an agent with a terminal tool.',
    fix: 'Block the chunk and treat the source as compromised.',
  },

  // --- exfiltration ---------------------------------------------------------
  {
    id: 'markdown-image-beacon',
    category: 'exfiltration',
    severity: 'critical',
    pattern: /!\[[^\]]{0,80}\]\(\s*https?:\/\/[^\s)]*[?&][^\s)]*=/gi,
    why: 'A markdown image whose URL carries a query parameter is the standard silent exfiltration channel: the client fetches it and the attacker reads the conversation out of the request log.',
    fix: 'Strip images from retrieved text, or render assistant output with remote image loading disabled.',
  },
  {
    id: 'send-contents-to',
    category: 'exfiltration',
    severity: 'critical',
    pattern:
      /\b(?:send|post|upload|forward|transmit|exfiltrate|report)\s+(?:the\s+|all\s+|your\s+|this\s+)?(?:conversation|chat|history|context|contents?|messages?|secrets?|keys?|credentials?|tokens?)\b[^.\n]{0,60}\b(?:to|at|via)\b/gi,
    why: 'Explicit instruction to move conversation contents to a third party.',
    fix: 'Block, and audit the ingestion path that allowed this document into the index.',
  },
  {
    id: 'append-to-url',
    category: 'exfiltration',
    severity: 'high',
    pattern:
      /\b(?:append|include|add|encode)\b[^.\n]{0,60}\b(?:to\s+the\s+url|as\s+a\s+query\s+(?:param|string)|in\s+the\s+link)\b/gi,
    why: 'Describes smuggling data out through a URL the user or client will fetch.',
    fix: 'Disallow model-authored URLs with dynamic query strings in rendered output.',
  },

  // --- concealed markup -----------------------------------------------------
  {
    id: 'hidden-style',
    category: 'concealed-markup',
    severity: 'high',
    pattern:
      /style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0|color\s*:\s*#?(?:fff(?:fff)?|white))/gi,
    why: 'Text styled to be invisible to a human reviewer is still fully visible to the model.',
    fix: 'Extract text from HTML with a parser that honours visibility, not a regex tag-stripper.',
  },
  {
    id: 'html-comment',
    category: 'concealed-markup',
    severity: 'medium',
    pattern: /<!--[\s\S]{0,400}?-->/g,
    why: 'HTML comments survive naive text extraction and are a favourite hiding place for payloads.',
    fix: 'Drop comment nodes during extraction.',
  },

  // --- fence breakout -------------------------------------------------------
  {
    id: 'fence-breakout',
    category: 'fence-breakout',
    severity: 'medium',
    pattern: /^\s*(?:```|~~~|-{5,}\s*END\s+(?:OF\s+)?(?:CONTEXT|DOCUMENT)S?)/gim,
    why: 'A closing fence inside a chunk can terminate the block you wrapped the context in, letting the rest of the chunk escape into the instruction section.',
    fix: 'Fence retrieved content with a per-request random delimiter, or escape backticks on ingestion.',
  },

  // --- false authority ------------------------------------------------------
  {
    id: 'authorized-test',
    category: 'false-authority',
    severity: 'high',
    pattern:
      /\b(?:this\s+is\s+an?\s+)?(?:authorized|approved|sanctioned|official|permitted)\s+(?:security\s+)?(?:test|audit|exercise|penetration\s+test|red[\s-]?team)\b/gi,
    why: 'Manufactures permission that the actual operator never granted.',
    fix: 'Authorization must come from the request context, never from retrieved documents.',
  },
  {
    id: 'admin-claim',
    category: 'false-authority',
    severity: 'medium',
    pattern:
      /\b(?:as\s+(?:the|an|your)\s+(?:administrator|admin|developer|owner|operator)|the\s+user\s+has\s+(?:already\s+)?(?:approved|authorized|consented))\b/gi,
    why: 'Impersonates a privileged party from inside the data channel.',
    fix: 'Bind privilege to the authenticated session, not to text.',
  },
];

/**
 * Code points that carry no visible glyph but are tokenized normally:
 * zero-width joiners/spaces, bidi controls, the BOM, and the Unicode tag
 * block (U+E0000-U+E007F) used for ASCII smuggling.
 */
export const INVISIBLE_PATTERN =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]|[\u{E0000}-\u{E007F}]/gu;

const INVISIBLE_NAMES: Record<number, string> = {
  0x200b: 'ZERO WIDTH SPACE',
  0x200c: 'ZERO WIDTH NON-JOINER',
  0x200d: 'ZERO WIDTH JOINER',
  0x200e: 'LEFT-TO-RIGHT MARK',
  0x200f: 'RIGHT-TO-LEFT MARK',
  0x202a: 'LEFT-TO-RIGHT EMBEDDING',
  0x202b: 'RIGHT-TO-LEFT EMBEDDING',
  0x202c: 'POP DIRECTIONAL FORMATTING',
  0x202d: 'LEFT-TO-RIGHT OVERRIDE',
  0x202e: 'RIGHT-TO-LEFT OVERRIDE',
  0x2060: 'WORD JOINER',
  0xfeff: 'ZERO WIDTH NO-BREAK SPACE (BOM)',
};

export function isTagChar(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return cp >= 0xe0000 && cp <= 0xe007f;
}

export function describeInvisible(ch: string): string {
  const cp = ch.codePointAt(0) ?? 0;
  if (isTagChar(ch)) return 'UNICODE TAG (ASCII smuggling)';
  return INVISIBLE_NAMES[cp] ?? `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
}

function trimMatch(m: string): string {
  const flat = m.replace(/\s+/g, ' ').trim();
  return flat.length > 120 ? `${flat.slice(0, 117)}…` : flat;
}

/** Run every rule plus the invisible-character sweep over one chunk. */
export function detect(chunkId: number, text: string): Finding[] {
  const found: Finding[] = [];

  for (const rule of RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      found.push({
        chunkId,
        category: rule.category,
        severity: rule.severity,
        rule: rule.id,
        match: trimMatch(m[0]),
        start: m.index,
        end: m.index + m[0].length,
        why: rule.why,
        fix: rule.fix,
      });
    }
  }

  const inv = new RegExp(INVISIBLE_PATTERN.source, INVISIBLE_PATTERN.flags);
  const runs: Array<{ start: number; end: number; chars: string }> = [];
  let im: RegExpExecArray | null;
  while ((im = inv.exec(text)) !== null) {
    const last = runs[runs.length - 1];
    if (last && last.end === im.index) {
      last.end = im.index + im[0].length;
      last.chars += im[0];
    } else {
      runs.push({ start: im.index, end: im.index + im[0].length, chars: im[0] });
    }
  }
  for (const run of runs) {
    const codepoints = [...run.chars];
    const tagRun = codepoints.some(isTagChar);
    found.push({
      chunkId,
      category: 'invisible-text',
      severity: tagRun || codepoints.length >= 8 ? 'high' : 'low',
      rule: tagRun ? 'unicode-tag-smuggling' : 'zero-width-run',
      match: `${codepoints.length} invisible code point${codepoints.length === 1 ? '' : 's'} (${describeInvisible(codepoints[0])})`,
      start: run.start,
      end: run.end,
      why: tagRun
        ? 'Unicode tag characters (U+E0000 block) encode a full ASCII message that is completely invisible in every editor and diff, but is tokenized normally by the model.'
        : 'Zero-width and bidirectional-format characters are invisible to a human reviewing the corpus, yet still reach the tokenizer — and can split a keyword so that a naive filter misses it.',
      fix: 'Normalize retrieved text (NFKC) and strip format-category code points before building the prompt.',
    });
  }

  return found.sort((a, b) => a.start - b.start);
}
