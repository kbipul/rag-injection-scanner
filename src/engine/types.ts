export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type Category =
  | 'instruction-override'
  | 'role-spoofing'
  | 'tool-call-bait'
  | 'exfiltration'
  | 'invisible-text'
  | 'concealed-markup'
  | 'fence-breakout'
  | 'false-authority';

export interface Chunk {
  /** 1-based index as the retriever returned it. */
  id: number;
  /** Optional source label parsed from a `source:` line or a JSON field. */
  source?: string;
  text: string;
}

export interface Finding {
  chunkId: number;
  category: Category;
  severity: Severity;
  /** Human label for the specific rule that fired. */
  rule: string;
  /** The exact substring that matched. */
  match: string;
  /** Character offsets of the match within the chunk text. */
  start: number;
  end: number;
  /** Why this matters when it arrives inside retrieved context. */
  why: string;
  /** What to do about it in the pipeline. */
  fix: string;
}

export interface ChunkReport {
  chunk: Chunk;
  findings: Finding[];
  /** 0-100. Higher = more dangerous. */
  risk: number;
}

export type Verdict = 'block' | 'review' | 'pass';

export interface ScanReport {
  chunks: ChunkReport[];
  findings: Finding[];
  verdict: Verdict;
  /** 0-100 across the whole retrieved set. */
  risk: number;
  counts: Record<Severity, number>;
  /** Count of invisible / format code points found across all chunks. */
  invisibleChars: number;
}

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 45,
  high: 25,
  medium: 12,
  low: 5,
};

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

export const CATEGORY_LABEL: Record<Category, string> = {
  'instruction-override': 'Instruction override',
  'role-spoofing': 'Role / delimiter spoofing',
  'tool-call-bait': 'Tool-call bait',
  exfiltration: 'Exfiltration lure',
  'invisible-text': 'Invisible text',
  'concealed-markup': 'Concealed markup',
  'fence-breakout': 'Context-fence breakout',
  'false-authority': 'False authority',
};
