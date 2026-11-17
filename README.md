# Free AI Detector

Paste any text and get an AI-likeness score with the reasons behind it, then humanize, fix grammar, simplify or summarize the same text.

Everything works with no setup and no API key: scoring and rewriting run in the browser. Connecting a language model is optional and gives deeper rewrites.

## What it does

| Tool | Page | How it works |
|---|---|---|
| Detect AI | `/` and `/hi` (Hindi) | 0–100 score, ten explained signals, tap a sentence to see why it was flagged, printable report. Always runs in the browser. |
| Humanize | `/ai-humanizer` | Language model rewrite, checked before it is shown. Falls back to offline rules. |
| Fix grammar | `/grammar-checker` | Model proofreading, or offline rules for spacing, capitals, typos, a/an, its/it's. |
| Simplify | `/text-simplifier` | Model plain-language rewrite, or offline word swaps and sentence splitting. |
| Summarize | `/summarizer` | Model summary, or an extractive summary that keeps key sentences word for word. |
| Word count | `/word-counter` | Live words, characters, sentences, paragraphs, reading and speaking time. |

Other features: correct counting in Hindi and other scripts, `.txt`, `.md`, `.docx` and `.pdf` upload read on the device, a word-level view of every change, drafts kept for the tab session, light and dark themes, keyboard support (`Ctrl/⌘ + Enter` runs the current tool), three articles under `/articles`.

## Honest limits

- The score is a **rule-based estimate**, not a trained classifier. It cannot prove who wrote a text. Formal or academic human writing can score high, and edited model output can score low.
- Wording signals are tuned for English. Other languages are scored on structure only and marked low confidence. Text under 40 words stays near 50.
- The thresholds were tuned on the small set of passages in `tests/fixtures.js`. They have not been validated on a large labelled corpus; do that before making any accuracy claim.
- The offline rewriting rules are conservative and English-only for wording. They will not transform a text the way a model does.
- Scanned PDFs cannot be read (they are images). Hindi text in some PDFs extracts badly because of how the fonts are embedded.
- The Hindi page translates the interface; the numeric detail lines and downloaded reports stay in English.
- Formal academic prose can still score in the “mixed” band, and lightly edited model text can score low. Use `npm run evaluate` to measure this on your own samples.

## Run it

Requires Node.js 20 or newer. There are no dependencies to install.

```sh
npm start        # http://localhost:3000
npm test         # 47 tests
npm run build    # regenerate pages after editing site/
npm run evaluate # measure accuracy on your own labelled passages
npm run check    # syntax check
```

To try model rewriting locally: `OPENAI_API_KEY=sk-... npm start`.

## Deploy to Cloudflare Workers (free plan works)

```sh
npx wrangler login
npx wrangler deploy
```

That publishes the site with scoring, offline rewriting and model rewriting through **Cloudflare Workers AI**, which is switched on in `wrangler.jsonc`. It needs no API key and uses your Cloudflare account's free daily allowance; when the allowance runs out, the site falls back to the offline rules until the next day.

- To change the model, edit `WORKERS_AI_MODEL` in `wrangler.jsonc`. Cloudflare retires models from time to time; if the configured one stops working, the Worker tries the fallbacks listed in `worker/index.js`. Run `npx wrangler tail` to see which model failed and why.
- To turn model rewriting off, delete the `"ai"` and `"vars"` lines.
- To use **OpenAI** instead, run `npx wrangler secret put OPENAI_API_KEY`, then deploy again. Optional variable `OPENAI_MODEL` (default `gpt-4.1-mini`).

`npm start` on your own computer has no Workers AI, so it uses the offline rules unless `OPENAI_API_KEY` is set. `npx wrangler dev` runs locally with Workers AI after you log in.

If both are set, OpenAI is used. Never put a key in a file that is committed.

Because the detector and offline tools are static files, the `public/` folder also works on any static host (GitHub Pages, Netlify). Only model rewriting needs the Worker.

## Editing pages and text

The HTML pages are generated. Do not edit `public/*.html` by hand.

- Page wording, titles, descriptions, FAQs and articles: `site/content.mjs`
- Layout shared by every page: `site/template.mjs`
- Site address, analytics token, Search Console code: `site/config.mjs`
- Tool interface strings in English and Hindi: `public/i18n.js`

After a change run `npm run build`, then `npm run deploy`. The tests fail if the generated files are out of date.

To add an article, copy one of the `kind: 'article'` entries in `site/content.mjs`, give it a new `path`, and rebuild. It is added to the articles page and the sitemap automatically.

## Project layout

```
site/              page content, templates and settings (source for the HTML)
public/            what is served: generated HTML plus the scripts below
  app.js           UI logic            i18n.js          English and Hindi strings
  engine.js        word and sentence segmentation, limits (shared with the Worker)
  detector.js      the scorer: signals, weights, sentence levels, report
  rewrite-local.js offline humanize / grammar / simplify / summarize
  diff.js, docx.js, pdf.js             change view, .docx and .pdf readers
  vendor/pdfjs/    Mozilla pdf.js (Apache-2.0), loaded only when a PDF is opened
  _headers         security headers, including the Content-Security-Policy (generated)
worker/index.js    API: /api/status and /api/rewrite, rate limiting, output checks
scripts/           build-pages.mjs, dev.mjs (local server), evaluate.mjs
eval/              put labelled passages here to measure accuracy (see eval/README.md)
docs/LAUNCH.md     checklist for Search Console, analytics and getting visitors
tests/             unit and integration tests
```

## How the score is built

`detector.js` measures stock phrasing, sentence-length variation, formulaic openers, personal voice, lists of three, trailing “-ing” clauses, punctuation variety, short sentences, concrete detail (figures, citations, names) and paragraph uniformity. Chat-assistant boilerplate adds to the score when present. Headings and short list items are excluded from the sentence statistics. Each signal is scaled to 0–1, combined by weight, mapped through a logistic curve and pulled toward 50 when there is little text. Weights and word lists are at the top of the file and are meant to be tuned.

## Safeguards on model rewriting

- Same-origin check, JSON only, request size capped, 3–1,500 words and 12,000 characters.
- Rate limit of 8 requests a minute per visitor (Cloudflare rate-limit binding, with an in-memory fallback).
- A revision is rejected if a number or URL changed (the same number written another way, such as 3,500 and 3500, is accepted), the length moved outside the allowed range, or the wording drifted away from the original. The browser then shows the offline rewrite with the reason.
- No text is logged or stored. OpenAI requests use `store: false`.

Before a public launch, also set a spending cap with your provider and consider adding Cloudflare Turnstile.

## Not verified

- No request has been made to a real OpenAI or Workers AI endpoint; both paths are covered by mocked tests only.
- Browser tests were run in Chrome at 360, 1366 and 1440 px, including PDF upload, the print view and the Hindi page. Safari and Firefox were not tested.
- The privacy and terms pages describe how the software behaves; have them reviewed before you rely on them.

Fonts: DM Sans and Manrope, self-hosted under the SIL Open Font License (`public/fonts/LICENSE.txt`). The repository has no licence file for the code yet; add one if you want others to reuse it.
