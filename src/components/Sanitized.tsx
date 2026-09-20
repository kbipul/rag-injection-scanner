import { useMemo } from 'react';
import { sanitize } from '../engine/sanitize';
import { scan } from '../engine/scan';

export function Sanitized({ input }: { input: string }) {
  const { result, before, after } = useMemo(() => {
    const res = sanitize(input);
    return { result: res, before: scan(input), after: scan(res.text) };
  }, [input]);

  return (
    <section className="sanitized">
      <h3>What normalization alone buys you</h3>
      <p className="sanitized__lede">
        NFKC normalize, strip format code points, defang template delimiters.
        That is the cheap half of the fix, and here is exactly how far it gets
        you on this input.
      </p>
      <div className="sanitized__grid">
        <div>
          <span className="k">Invisible code points removed</span>
          <span className="v">{result.removedInvisible}</span>
        </div>
        <div>
          <span className="k">Delimiters defanged</span>
          <span className="v">{result.neutralizedDelimiters}</span>
        </div>
        <div>
          <span className="k">Risk before</span>
          <span className="v">{before.risk}</span>
        </div>
        <div>
          <span className="k">Risk after</span>
          <span className="v">{after.risk}</span>
        </div>
      </div>
      <p className="sanitized__caveat">
        {after.findings.length > 0
          ? `${after.findings.length} finding${after.findings.length === 1 ? '' : 's'} survive sanitization. Those are semantic, not lexical — no amount of character filtering removes a sentence that means "ignore your instructions". That is what the prompt structure and the trust boundary are for.`
          : 'Nothing survives sanitization on this input. That is the pleasant case, and it is not the common one.'}
      </p>
    </section>
  );
}
