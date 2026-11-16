# Free AI Detector — Humanizer & Pattern Analysis

Two separate tools: a real server-backed rewrite adapter and an experimental local pattern analyzer. **Rewriting needs an owner-configured OpenAI API key; no key is currently provisioned.** The UI visibly disables rewriting until configured. It does not substitute an example or make fake rewrites.

## Run and check

Node.js 18+ is required for checks and the dependency-free build:

```sh
npm test
npm run check
npm run build
```

For static UI inspection only:

```sh
python3 -m http.server 3000 --directory dist
```

The Python preview cannot rewrite because it has no API server. Deploy `dist/server/index.js` to a Cloudflare Worker-compatible host, or run a local Worker development tool with a private environment secret. Never place an API key in `dist/`, source, shell arguments, or Git. On Sites, use its supported secret configuration workflow. For `OPENAI_API_KEY`, enable OpenAI Developers and follow its `openai-platform-api-key` skill and approval flow. Do not paste a key into chat. Keep the Site private until provider billing, abuse controls, legal text, and public access are reviewed.

## Runtime configuration

- `OPENAI_API_KEY` — required server-side secret for actual rewriting.
- `OPENAI_MODEL` — optional server-side model name; defaults to `gpt-4.1-mini`.

A paid provider account with available quota is required. The site owner pays model usage; no payments are collected in this app. The private preview's hosting login is separate from the app, which has no account system.

## How rewriting works

`GET /api/status` returns readiness only. `POST /api/rewrite` accepts 5–1,500 words and at most 100,000 characters in a same-origin JSON request. The server validates streamed request size, checks input, and calls OpenAI Responses with `store:false`, a timeout, and conservative copy-editing instructions. Incomplete or radically shorter/longer output is rejected. Provider errors and timeouts preserve the user's original.

The original stays in the editor; a revision appears beside it on desktop and below on mobile. Copy and download controls act only on the revision. Editing input or switching tools aborts pending browser requests and invalidates old results. Aborting a browser request does not guarantee cancellation of provider processing or billing. Meaning preservation is an instruction, not a guarantee; the user must review facts and details. There is no promise of passing or evading an AI detector.

Human/AI-style sample buttons are explicitly labeled as examples. A separate Restore my text action restores the pre-sample original. Loading a sample does not humanize text.

## Local pattern analysis

This mode remains fully local and requires no key. It supports 50–1,500 words, measures word and sentence counts, unique words, and repeated trigrams, and exports an explanatory report without the original text. It is **not** a trained AI detector and never invents an AI percentage or accuracy claim.

Both tools support live word counting, clipboard fallback, clear, .txt uploads up to 100 KB, UTF-8/binary validation, non-destructive errors, keyboard use, and responsive layouts.

## Source map

- `dist/index.html`, `dist/styles.css`: responsive ivory/forest/sage UI.
- `dist/app.js`: input, modes, async cancellation, results, sample restoration, legal dialogs.
- `dist/engine.js`: pure local analysis functions and report export.
- `worker/index.js`: server-only model adapter and HTTP handling.
- `scripts/build.mjs`: embeds static assets and adapter into `dist/server/index.js`.
- `tests/`: count/validation tests, markup integrity checks, and mocked server integration tests.

`npm run build` must be rerun after frontend or adapter changes. The build output contains no API secrets.

## Privacy

Pattern analysis never transmits text. Rewriting sends submitted text to the site server and OpenAI. This app stores no submissions or text logs and does not use browser persistence. `store:false` does not eliminate all provider retention or abuse monitoring. Google Fonts and hosting services receive ordinary network requests and may keep access metadata. Updated privacy and terms dialogs disclose this behavior. Avoid submitting sensitive material. A public support address still needs configuration.

## Verification

Engine, markup, syntax, and mocked rewrite integration checks pass. Live model behavior is unverified until a real key is configured. Browser-control tools are unavailable in this environment, so responsive rendering and interaction testing remain unverified. Test 390px, 768px, and 1440px widths, 200% zoom, keyboard-only operation, uploads and paste denied, mode changes during requests, sample restoration, errors, and copy/download before a public launch. Review actual rewrite quality with factual/numeric passages after connecting the model.

## AdSense and design research

Two hidden, empty placement hooks remain below the workspace and between supporting content sections. There are no live ads, mock ads, or approval claims. Public monetization needs policy review, unobtrusive placement, appropriate consent/disclosures, and abuse/cost controls.

GPTZero, QuillBot AI detector, and ZeroGPT public page content informed the original editor-first design. Branding, mark, wording, and layout are original. No reference accuracy statistics or testimonials were copied.


## Repository status

This repository contains the last tested, deployed implementation: a working browser-local writing-pattern demo and a server-side OpenAI rewrite adapter. Twelve automated checks passed for this implementation before export. The local analyzer does not provide an AI probability. Actual rewriting requires a configured API key and paid provider quota. No credentials are included.

The latest detector-first visual redesign, real detector percentage integration, PDF/DOCX upload support, and additional grammar/simplify/summarize actions are pending work and are not represented as completed features in this version.

## Deploy independently to Cloudflare Workers

1. Run `npm run build`.
2. Use `npx wrangler login` to authenticate your Cloudflare account.
3. Use `npx wrangler secret put OPENAI_API_KEY` to enter a key securely when you are ready to enable rewriting. Do not put keys in code or Git.
4. Run `npx wrangler deploy`.

The included `wrangler.jsonc` points to the generated Worker. Provider billing is separate from ChatGPT or Claude subscriptions. No live provider request has been verified for this repository.
