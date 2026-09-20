import { useMemo, useState } from 'react';
import { ChunkView } from './components/ChunkView';
import { Sanitized } from './components/Sanitized';
import { Verdict } from './components/Verdict';
import { scan } from './engine/scan';
import { DEFAULT_SAMPLE, SAMPLES } from './engine/samples';
import { CATEGORY_LABEL, SEVERITY_ORDER } from './engine/types';
import type { Category } from './engine/types';

export default function App() {
  const [input, setInput] = useState(DEFAULT_SAMPLE.text);
  const [active, setActive] = useState(DEFAULT_SAMPLE.key);
  const [onlyHits, setOnlyHits] = useState(false);

  const report = useMemo(() => scan(input), [input]);

  const byCategory = useMemo(() => {
    const map = new Map<Category, number>();
    for (const f of report.findings) {
      map.set(f.category, (map.get(f.category) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [report]);

  const visible = onlyHits
    ? report.chunks.filter((c) => c.findings.length > 0)
    : report.chunks;

  return (
    <div className="app">
      <header className="masthead">
        <h1>RAG Injection Scanner</h1>
        <p className="masthead__sub">
          Your retriever just handed the model some text. Somebody else wrote it.
          Paste the retrieved chunks and see what is in there addressed to the
          model rather than to you.
        </p>
        <p className="masthead__note">
          Runs entirely in your browser. Nothing is uploaded, no model is called,
          no key is needed — the whole engine is a rule set you can read in
          <code> src/engine/detectors.ts</code>.
        </p>
      </header>

      <nav className="samples" aria-label="Example retrieval sets">
        {SAMPLES.map((sample) => (
          <button
            key={sample.key}
            className={sample.key === active ? 'is-active' : ''}
            onClick={() => {
              setInput(sample.text);
              setActive(sample.key);
            }}
          >
            <strong>{sample.label}</strong>
            <span>{sample.blurb}</span>
          </button>
        ))}
      </nav>

      <main className="layout">
        <section className="pane pane--input">
          <label htmlFor="chunks">
            Retrieved chunks
            <span className="hint">
              Separate with a <code>---</code> line, or paste a JSON array from
              your vector store.
            </span>
          </label>
          <textarea
            id="chunks"
            spellCheck={false}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setActive('');
            }}
          />
        </section>

        <section className="pane pane--report">
          <Verdict report={report} />

          {byCategory.length > 0 && (
            <ul className="categories">
              {byCategory.map(([category, count]) => (
                <li key={category}>
                  <span>{CATEGORY_LABEL[category]}</span>
                  <b>{count}</b>
                </li>
              ))}
            </ul>
          )}

          <div className="legend">
            {SEVERITY_ORDER.map((s) => (
              <span key={s} className={`sev sev--${s}`}>
                {s} · {report.counts[s]}
              </span>
            ))}
            <label className="toggle">
              <input
                type="checkbox"
                checked={onlyHits}
                onChange={(e) => setOnlyHits(e.target.checked)}
              />
              only chunks with findings
            </label>
          </div>

          <Sanitized input={input} />

          <div className="chunks">
            {visible.map((chunkReport) => (
              <ChunkView key={chunkReport.chunk.id} report={chunkReport} />
            ))}
            {visible.length === 0 && (
              <p className="empty">
                {report.chunks.length === 0
                  ? 'Paste some retrieved chunks to scan.'
                  : 'No chunk in this set produced a finding.'}
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="foot">
        <p>
          <strong>What this is not.</strong> A rule engine catches the payloads
          people are actually shipping today; it does not catch a paraphrase it
          has never seen, and a clean result is not a safety guarantee. Treat it
          as a smoke alarm on your ingestion pipeline, not as the trust boundary.
          The boundary is prompt structure: fence retrieved text with a
          per-request nonce, tell the model that fenced content is never
          instructions, and gate every side-effecting tool on the user turn.
        </p>
        <p className="foot__by">
          Day 026 of{' '}
          <a href="https://github.com/kbipul/kb-daily-builds">kb-daily-builds</a>{' '}
          · built by <a href="https://www.kumarbipul.com">Kumar Bipul</a>
        </p>
      </footer>
    </div>
  );
}
