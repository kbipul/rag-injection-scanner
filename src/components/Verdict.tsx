import type { ScanReport } from '../engine/types';

const COPY: Record<ScanReport['verdict'], { title: string; line: string }> = {
  block: {
    title: 'Do not send this context',
    line: 'At least one chunk is trying to issue instructions rather than supply facts.',
  },
  review: {
    title: 'Review before sending',
    line: 'Nothing conclusive, but something in here does not read like a document.',
  },
  pass: {
    title: 'No injection markers found',
    line: 'Every chunk reads like data. This is not proof of safety — it is the absence of known markers.',
  },
};

export function Verdict({ report }: { report: ScanReport }) {
  const copy = COPY[report.verdict];
  return (
    <section className={`verdict verdict--${report.verdict}`}>
      <div className="verdict__head">
        <span className="verdict__badge">{report.verdict.toUpperCase()}</span>
        <h2>{copy.title}</h2>
      </div>
      <p className="verdict__line">{copy.line}</p>
      <dl className="verdict__stats">
        <div>
          <dt>Risk</dt>
          <dd>{report.risk}<span className="unit">/100</span></dd>
        </div>
        <div>
          <dt>Chunks</dt>
          <dd>{report.chunks.length}</dd>
        </div>
        <div>
          <dt>Findings</dt>
          <dd>{report.findings.length}</dd>
        </div>
        <div>
          <dt>Critical</dt>
          <dd>{report.counts.critical}</dd>
        </div>
        <div>
          <dt>Invisible chars</dt>
          <dd>{report.invisibleChars}</dd>
        </div>
      </dl>
    </section>
  );
}
