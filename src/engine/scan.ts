import { detect } from './detectors';
import { parseChunks } from './parse';
import type {
  Chunk,
  ChunkReport,
  Finding,
  ScanReport,
  Severity,
  Verdict,
} from './types';
import { SEVERITY_WEIGHT } from './types';

/**
 * Risk is saturating, not additive: ten medium findings in one chunk are bad,
 * but they are not worse than one confirmed exfiltration beacon. Each finding
 * closes part of the remaining gap to 100, weighted by severity.
 */
export function scoreFindings(findings: Finding[]): number {
  let remaining = 100;
  const ordered = [...findings].sort(
    (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity],
  );
  for (const f of ordered) {
    remaining -= (remaining * SEVERITY_WEIGHT[f.severity]) / 100;
  }
  return Math.round(100 - remaining);
}

export function verdictFor(findings: Finding[]): Verdict {
  if (findings.some((f) => f.severity === 'critical')) return 'block';
  if (findings.some((f) => f.severity === 'high')) return 'block';
  if (findings.length > 0) return 'review';
  return 'pass';
}

export function scanChunk(chunk: Chunk): ChunkReport {
  const findings = detect(chunk.id, chunk.text);
  return { chunk, findings, risk: scoreFindings(findings) };
}

export function scanChunks(chunks: Chunk[]): ScanReport {
  const reports = chunks.map(scanChunk);
  const findings = reports.flatMap((r) => r.findings);

  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const f of findings) counts[f.severity] += 1;

  const invisibleChars = findings
    .filter((f) => f.category === 'invisible-text')
    .reduce((n, f) => n + (f.end - f.start), 0);

  return {
    chunks: reports,
    findings,
    verdict: verdictFor(findings),
    risk: reports.length === 0 ? 0 : Math.max(...reports.map((r) => r.risk)),
    counts,
    invisibleChars,
  };
}

export function scan(input: string): ScanReport {
  return scanChunks(parseChunks(input));
}
