<div align="center">

# RAG Injection Scanner

**What did your retriever just hand the model?**

[![CI](https://github.com/kbipul/rag-injection-scanner/actions/workflows/ci.yml/badge.svg)](https://github.com/kbipul/rag-injection-scanner/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/demo-live-5aa9ff)](https://kbipul.github.io/rag-injection-scanner/)

`Day 026` of **[kb-daily-builds](https://github.com/kbipul/kb-daily-builds)** — one AI project a day.

</div>

## What it does

On 6 September 2026 two projects trended on GitHub for the same idea: `volcengine/OpenViking`, a "self-evolving context database for AI agents" unifying memory, knowledge RAG and skills, and `akitaonrails/ai-memory`, long-term memory that hands off between agent vendors. Both make the same bet: agents should continuously pull large volumes of stored text into their context automatically. That makes the retrieval step the widest untrusted input channel in the stack, and almost nobody looks at what comes through it.

This is a scanner for that channel. Paste the chunks your retriever actually returned and it flags the parts addressed to the model rather than to you: instruction overrides, forged role delimiters, tool-call bait, exfiltration beacons, and text made invisible with zero-width or Unicode-tag characters. Every finding names the rule that fired, quotes the match, explains why it matters *specifically because it arrived through retrieval*, and gives the pipeline-level fix.

It runs entirely in your browser and uploads nothing. The whole engine is a rule table in [`src/engine/detectors.ts`](src/engine/detectors.ts), so you can read the detector before you trust its verdict.

![Screenshot](docs/demo.png)

<sub>The screenshot is captured by CI on a GitHub runner (the build sandbox has no browser) and committed back a few minutes after publish.</sub>

## Try it

**[Live demo →](https://kbipul.github.io/rag-injection-scanner/)** — four sample retrieval sets are built in, including a clean control set so you can judge the false-positive rate yourself.

```bash
git clone https://github.com/kbipul/rag-injection-scanner.git
cd rag-injection-scanner
npm ci
npm test          # 63 tests
npm run dev       # http://localhost:5173
```

## How it works

```
paste ──▶ parseChunks ──▶ detect (per chunk) ──▶ scoreFindings ──▶ verdict
          │                │                     │
          │                ├─ 19 regex rules     └─ saturating, not additive
          │                └─ invisible-codepoint sweep
          └─ JSON array │ LangChain objects │ text split on ---
```

The unit is the chunk, because the chunk is the unit you can drop. Every finding carries a chunk id and character offsets, so the UI highlights the exact span in place, and the same engine can sit in an ingestion filter that quarantines chunk 4 and keeps the rest of the retrieval.

Per-chunk risk saturates. Ten medium findings in one chunk are bad, but they are not worse than a single confirmed exfiltration beacon, so each finding closes a severity-weighted fraction of the remaining gap to 100 and the score stays bounded; one critical hit always outranks a pile of noise. The overall risk for a paste is the score of its worst chunk.

Regex rules operate on what you can read. A separate pass walks the string for format-category code points, groups consecutive ones into a single finding, and tells the Unicode tag block (U+E0000–U+E007F) apart from ordinary zero-width padding. The tag block gets its own rule, `unicode-tag-smuggling`, because it encodes a complete hidden ASCII message that no editor or diff will ever show you.

`sanitize()` is a partial fix and is shown as one. It normalizes NFKC, strips invisible code points and defangs template delimiters; the UI then re-scans the result and reports what survived. On every bundled poisoned sample the semantic overrides survive, and the panel says why: no amount of character filtering removes a sentence that means "ignore your instructions". The comment above the function is blunter: "This is deliberately NOT presented as a filter that makes untrusted text safe."

## Build notes — what I learned

The wiki sample shipped with the wrong blurb. It said "Three are ordinary. One is not", and I caught it later the same day, reviewing the CI screenshot of the published demo: two of the four chunks had findings. The onboarding FAQ chunk says `Ignore previous instructions about the old ticketing system`, a perfectly ordinary thing for a wiki to say, and it fires `ignore-previous` at critical severity, the same rule as the forged system note two chunks below it. The scanner cannot tell them apart. The blurb now reads "One is hostile. One is an innocent sentence that trips the same rule." I left the chunk in, because it is the real cost of a lexical detector: every rule that catches the attack also catches the sentence that merely resembles it, and a team wiring this into an ingestion filter needs to see that on the first screen, before a legitimate document gets quarantined in production.

The bug I inflicted on myself was on-theme. I wrote the invisible-character constants by pasting the actual characters into the source, so the file was correct and completely unreviewable: `const ZWSP = '';`, with a real zero-width space between the quotes, is a line that looks like an empty string in every editor. A security tool whose own source hides characters from its reader is a bad joke. Everything got rewritten as explicit `\u200B` escapes; the sample file now reads `const ZWSP = '\u200B';`. I think that rule generalizes: if your codebase handles invisible characters anywhere, they should exist in source only as escapes, and that is worth a lint rule.

The rules went through one real correction, and the test that holds it is named `catches variants that swap the verb and the noun`. `Disregard the prior system prompt` slipped past the first override pattern because I had written the qualifier as a single word (`previous`, `prior`, `system`) and this phrasing stacks two of them. The pattern now allows one or two stacked qualifiers, the `{1,2}` in `ignore-previous`. That is a small edit with an uncomfortable implication: the gap between the phrasings I imagined and the phrasings that exist was one sentence wide, on the very first variant I tried. Every regex-based detector is a list of the attacks its author happened to think of. So the green verdict in the UI is titled "No injection markers found" and describes itself as "the absence of known markers", which is all it has earned.

Deciding severity taught me more than writing the patterns. My first instinct was to rank by how alarming the text sounds, which puts `ignore all previous instructions` at the top. The genuinely dangerous finding in the bundled wiki sample is quieter: the markdown image whose URL carries a query parameter. It is silent, it needs no cooperation from the model beyond emitting a link, and the user's own client performs the exfiltration on render. So `markdown-image-beacon` is critical, and severity tracks what happens if the finding lands.

What I cut for time was a proper HTML extraction path. Hidden-style and comment detection is regex over raw markup, which is exactly the naive approach the tool warns you about elsewhere; the `hidden-style` rule's own fix text asks for "a parser that honours visibility". It works on the payload shapes people are shipping today. A real ingestion filter should parse the DOM and take the visible text, and I would build that first if this became something I ran in a pipeline.

The other gap is the corpus, and it is the thing I would do differently: bundle a small corpus of *published* injection samples. All four samples here are mine, so my detector and my attacker share an imagination, and the clean control only proves the false-positive rate is low on prose I also wrote. The day's slate turned on the same objection from the other side. Recall Cliff, an instrument for finding where retrieval reliability collapses inside GPT-6 Astra's 1.05M context window, tied this project at 11/12 and lost on a tiebreak rule, with its demo-ability capped at 2 because an honest version needs the user's own eval data and I would otherwise be inventing degradation curves. It went to the backlog for that. This one shipped with four payloads I invented.

## Stack

| Layer | Choice |
|---|---|
| UI | React 18, plain CSS |
| Language | TypeScript 5 (strict) |
| Build | Vite 6 |
| Tests | Vitest 3 — 63 tests, node environment |
| Engine | Zero dependencies — pure functions over strings |
| Hosting | GitHub Pages, static |

## Sources

The signal this build rides, and the claims behind it:

- [volcengine/OpenViking](https://github.com/volcengine/OpenViking) and
  [akitaonrails/ai-memory](https://github.com/akitaonrails/ai-memory) — both on GitHub
  trending on 6 September 2026. Both make retrieval automatic and continuous, which is
  what makes retrieved text the widest untrusted input channel in an agent stack.
- Tenable, *Tenable Uses OpenAI GPT Cyber Models to Help Defenders Inspect
  Community-Built AI Components*, 3 September 2026 —
  [tenable.com](https://www.tenable.com/press-releases/tenable-uses-openai-gpt-cyber-models-to-help-defenders-inspect-community-built-ai-components).
  Pre-deployment review of agents, skills, MCP servers and playbooks; evidence the market
  is moving to vet exactly this surface.

Every detection rule in this repository is written here, not borrowed. The rule table in
`src/engine/detectors.ts` is the whole detector — there is no model and no list to trust.


---

<div align="center"><sub>
Built by <a href="https://www.kumarbipul.com"><b>Kumar Bipul</b></a> ·
IT Director → AI/ML · <a href="https://github.com/kbipul">github.com/kbipul</a>
</sub></div>
