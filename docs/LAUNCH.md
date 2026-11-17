# Launch checklist

Things only the site owner can do. Work down the list; each step is independent.

## 1. Google Search Console

1. Open https://search.google.com/search-console and choose **Add property → URL prefix**. Enter the site address from `site/config.mjs`.
2. Choose the **HTML tag** method and copy the `content="…"` value.
3. Paste it into `GOOGLE_SITE_VERIFICATION` in `site/config.mjs`, then run `npm run deploy`.
4. Click **Verify** in Search Console.
5. Under **Indexing → Sitemaps**, submit the full address: `<site address>/sitemap.xml`.
6. Use **URL inspection → Request indexing** for the home page, each tool page and each article. There is a daily limit of roughly a dozen requests; do the rest the next day.

Repeat steps 1–5 at https://www.bing.com/webmasters (it can import from Search Console).

## 2. Visitor statistics (optional, free, no cookies)

1. In the Cloudflare dashboard open **Analytics & Logs → Web Analytics → Add a site** and enter the site's hostname.
2. Copy the token from the JavaScript snippet it shows.
3. Paste it into `CF_ANALYTICS_TOKEN` in `site/config.mjs`, then run `npm run deploy`. The build adds the script and allows it in the security policy.

## 3. Measure accuracy before claiming it

Follow `eval/README.md` and run `npm run evaluate`. Publish only numbers that script produced, with the number of passages tested.

## 4. Get the first visitors

- Share the tool pages, not only the home page: the word counter and grammar checker are useful to people who are not looking for an AI detector.
- Post in places where the audience already is: college and department groups, teacher forums, writing communities. Say what it does and what it does not do.
- Submit to AI tool directories (for example Futurepedia, There's An AI For That, Toolify, AlternativeTo) and to Product Hunt. Use the same one-line description everywhere.
- Add one article a month to `site/content.mjs` that answers a real question you were asked.
- After four weeks, open **Performance** in Search Console. Rewrite the title and description of pages with many impressions and few clicks, and write articles for queries where a page sits in positions 5–20.

## 5. Your own domain (when ready)

Buy a domain, add it to the Worker under **Settings → Domains & Routes**, change `SITE_URL` in `site/config.mjs`, run `npm run deploy`, and add the new address to Search Console. Do this early: links and search history earned by the `workers.dev` address do not transfer automatically.
