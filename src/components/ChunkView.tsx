import type { ChunkReport, Finding } from '../engine/types';
import { CATEGORY_LABEL } from '../engine/types';

interface Segment {
  text: string;
  finding?: Finding;
}

/**
 * Renders chunk text with the matched spans highlighted. Overlapping matches
 * are resolved by taking the first one that starts — the finding list below
 * still shows every hit, so nothing is hidden.
 */
export function segment(text: string, findings: Finding[]): Segment[] {
  const ordered = [...findings].sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;

  for (const finding of ordered) {
    if (finding.start < cursor) continue;
    if (finding.start > cursor) {
      segments.push({ text: text.slice(cursor, finding.start) });
    }
    segments.push({ text: text.slice(finding.start, finding.end), finding });
    cursor = finding.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

function label(finding: Finding): string {
  return `${CATEGORY_LABEL[finding.category]} — ${finding.rule}`;
}

export function ChunkView({ report }: { report: ChunkReport }) {
  const segments = segment(report.chunk.text, report.findings);
  const clean = report.findings.length === 0;

  return (
    <article className={`chunk ${clean ? 'chunk--clean' : 'chunk--hit'}`}>
      <header className="chunk__head">
        <span className="chunk__id">Chunk {report.chunk.id}</span>
        {report.chunk.source && (
          <code className="chunk__source">{report.chunk.source}</code>
        )}
        <span className="chunk__risk">
          {clean ? 'clean' : `risk ${report.risk}`}
        </span>
      </header>

      <pre className="chunk__body">
        {segments.map((s, i) =>
          s.finding ? (
            <mark
              key={i}
              className={`hit hit--${s.finding.severity}`}
              title={label(s.finding)}
            >
              {s.text.length === 0 ? '⌷' : s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </pre>

      {!clean && (
        <ul className="chunk__findings">
          {report.findings.map((finding, i) => (
            <li key={i} className={`finding finding--${finding.severity}`}>
              <div className="finding__head">
                <span className={`sev sev--${finding.severity}`}>
                  {finding.severity}
                </span>
                <strong>{CATEGORY_LABEL[finding.category]}</strong>
                <code>{finding.rule}</code>
              </div>
              <p className="finding__match">{finding.match}</p>
              <p className="finding__why">{finding.why}</p>
              <p className="finding__fix">
                <strong>Fix:</strong> {finding.fix}
              </p>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
