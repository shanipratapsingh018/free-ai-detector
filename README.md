# Free AI Detector

Paste any text and get an AI-likeness score with the reasons behind it, then humanize, fix grammar, simplify or summarize the same text.

Everything works with no setup and no API key: scoring and rewriting run in the browser. Connecting a language model is optional and gives deeper rewrites.

## What it does

| Tool | With no setup | With a model connected |
|---|---|---|
| Detect AI | 0–100 score, nine explained signals, sentence highlights, report download | same (always local) |
| Humanize | Offline rules: plainer wording, contractions, filler removed | Model rewrite, checked before it is shown |
| Fix grammar | Offline rules: spacing, capitals, common typos, a/an, repeated words | Model proofreading |
| Simplify | Offline rules: shorter words, long sentences split | Model plain-language rewrite |
| Summarize | Extractive: keeps the key sentences word for word | Model summary |

Other features: any language is counted correctly (including Hindi and other Indic scripts), `.txt`, `.md` and `.docx` upload read on the device, a word-level view of every change, light and dark themes, keyboard support (`Ctrl/⌘ + Enter` runs the current tool).

## Honest limits

- The score is a **rule-based estimate**, not a trained classifier. It cannot prove who wrote a text. Formal or academic human writing can score high, and edited model output can score low.
- Wording signals are tuned for English. Other languages are scored on structure only and marked low confidence. Text under 40 words stays near 50.
- The thresholds were tuned on the small set of passages in `tests/fixtures.js`. They have not been validated on a large labelled corpus; do that before making any accuracy claim.
- The offline rewriting rules are conservative and English-only for wording. They will not transform a text the way a model does.
- PDF upload is not supported.

## Run it

Requires Node.js 20 or newer. There are no dependencies to install.

```sh
npm start        # http://localhost:3000
npm test         # 39 tests
npm run check    # syntax check
```

To try model rewriting locally: `OPENAI_API_KEY=sk-... npm start`.

## Deploy to Cloudflare Workers (free plan works)

```sh
npx wrangler login
npx wrangler deploy
```

That publishes the site with scoring, offline rewriting and model rewriting through **Cloudflare Workers AI**, which is switched on in `wrangler.jsonc`. It needs no API key and uses your Cloudflare account's free daily allowance; when the allowance runs out, the site falls back to the offline rules until the next day.

- To change the model, edit `WORKERS_AI_MODEL` in `wrangler.jsonc`.
- To turn model rewriting off, delete the `"ai"` and `"vars"` lines.
- To use **OpenAI** instead, run `npx wrangler secret put OPENAI_API_KEY`, then deploy again. Optional variable `OPENAI_MODEL` (default `gpt-4.1-mini`).

`npm start` on your own computer has no Workers AI, so it uses the offline rules unless `OPENAI_API_KEY` is set. `npx wrangler dev` runs locally with Workers AI after you log in.

If both are set, OpenAI is used. Never put a key in a file that is committed.

Because the detector and offline tools are static files, the `public/` folder also works on any static host (GitHub Pages, Netlify). Only model rewriting needs the Worker.

## Project layout

```
public/            static site, served as-is
  index.html, styles.css, app.js   page, styles, UI logic
  engine.js        word and sentence segmentation, limits, counts (shared with the Worker)
  detector.js      the scorer: signals, weights, sentence levels, report
  rewrite-local.js offline humanize / grammar / simplify / summarize
  diff.js          word-level diff
  docx.js          .docx text extraction (no dependencies)
  _headers         security headers, including the Content-Security-Policy
worker/index.js    API: /api/status and /api/rewrite, rate limiting, output checks
scripts/dev.mjs    local server that runs the same API handler
tests/             unit and integration tests
```

## How the score is built

`detector.js` measures stock phrasing, sentence-length variation, formulaic openers, personal voice, lists of three, trailing “-ing” clauses, punctuation variety, short sentences and paragraph uniformity. Each signal is scaled to 0–1, combined by weight, mapped through a logistic curve and pulled toward 50 when there is little text. Weights and word lists are at the top of the file and are meant to be tuned.

## Safeguards on model rewriting

- Same-origin check, JSON only, request size capped, 3–1,500 words and 12,000 characters.
- Rate limit of 8 requests a minute per visitor (Cloudflare rate-limit binding, with an in-memory fallback).
- A revision is rejected if a number or URL changed, the length moved outside the allowed range, or the wording drifted away from the original. The browser then shows the offline rewrite with the reason.
- No text is logged or stored. OpenAI requests use `store: false`.

Before a public launch, also set a spending cap with your provider and consider adding Cloudflare Turnstile.

## Not verified

- No request has been made to a real OpenAI or Workers AI endpoint; both paths are covered by mocked tests only.
- Browser tests were run in Chrome at 390, 1280 and 1440 px. Safari and Firefox were not tested.
- The privacy and terms pages describe how the software behaves; have them reviewed before you rely on them.

Fonts: DM Sans and Manrope, self-hosted under the SIL Open Font License (`public/fonts/LICENSE.txt`). The repository has no licence file for the code yet; add one if you want others to reuse it.
