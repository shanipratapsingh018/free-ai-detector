/**
 * Site-wide settings. After changing anything here or in content.mjs, run `npm run build`
 * to regenerate the HTML pages, sitemap, robots.txt and security headers in /public.
 */

// The public address of the site, without a trailing slash. Change this if you move to your own domain.
export const SITE_URL = 'https://free-ai-detector.shani-rewrite.workers.dev';
export const SITE_NAME = 'Free AI Detector';
export const REPO_URL = 'https://github.com/shanipratapsingh018/free-ai-detector';

// Cloudflare Web Analytics (free, no cookies). Create a site in the Cloudflare dashboard under
// Analytics & Logs → Web Analytics, copy the token from the JS snippet, paste it here and rebuild.
// Leave empty to load no analytics at all.
export const CF_ANALYTICS_TOKEN = '';

// Google Search Console "HTML tag" verification code (the content="…" value). Optional.
export const GOOGLE_SITE_VERIFICATION = '';

export const UPDATED = '2026-11-17';
