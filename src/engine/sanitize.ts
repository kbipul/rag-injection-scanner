import { INVISIBLE_PATTERN } from './detectors';

export interface SanitizeResult {
  text: string;
  removedInvisible: number;
  neutralizedDelimiters: number;
}

/**
 * The minimum viable defence, shown next to the findings so the fix is
 * concrete rather than advice: normalize, drop invisible code points, and
 * defang the delimiters a document could use to escape its own fence.
 *
 * This is deliberately NOT presented as a filter that makes untrusted text
 * safe. It makes the *smuggling* channels visible; the trust boundary still
 * has to be enforced in the prompt structure.
 */
export function sanitize(input: string): SanitizeResult {
  const normalized = input.normalize('NFKC');

  let removedInvisible = 0;
  const stripped = normalized.replace(INVISIBLE_PATTERN, () => {
    removedInvisible += 1;
    return '';
  });

  let neutralizedDelimiters = 0;
  const defanged = stripped
    .replace(/<\|(?:im_start|im_end|system|user|assistant|endoftext)\|>/gi, (m) => {
      neutralizedDelimiters += 1;
      return `‹${m.slice(2, -2)}›`;
    })
    .replace(/\[\/?INST\]|<<\/?SYS>>/g, (m) => {
      neutralizedDelimiters += 1;
      return `(${m.replace(/[[\]<>]/g, '')})`;
    })
    .replace(/```/g, () => {
      neutralizedDelimiters += 1;
      return "'''";
    });

  return { text: defanged, removedInvisible, neutralizedDelimiters };
}
