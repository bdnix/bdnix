// The parts of the pages that scripts/build.mjs writes from scripts/site.mjs:
// each page's head tags, the footer, the landing page's cards, the profile
// page's scores and the sitemap. Pure functions of the site's data, so they
// can be unit tested. Each takes the language of the page it is for: 'en', or
// 'bn' for a page's Bangla copy at /bn<path> (see scripts/site.mjs).
import { SITE, bangla } from './site.mjs';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// JSON on one line, spaced like the rest of the page's markup.
const json = (v) => (v && typeof v === 'object'
  ? '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + json(x)).join(', ') + '}'
  : JSON.stringify(v)).replace(/<\//g, '<\\/');

// Bangla digits for a page in Bangla.
export const digits = (s, lang) => (lang === 'bn' ? String(s).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]) : String(s));

// Where page p is in a language, and its title and description there. A
// game's or tool's page without a Bangla copy is only in English.
export const href = (p, lang) => (lang === 'bn' && p.bn ? '/bn' + p.path : p.path);
const words = (p, lang) => (lang === 'bn' ? p.bn : p);

export function schema(p, lang = 'en'){
  const url = SITE + href(p, lang), { description } = words(p, lang);
  const language = lang === 'bn' ? { inLanguage: 'bn' } : {};
  if (p.schema === 'WebSite') return { '@context': 'https://schema.org', '@type': 'WebSite', name: 'bdnix', url, description, ...language };
  if (p.schema === 'WebApplication') {
    return {
      '@context': 'https://schema.org', '@type': 'WebApplication', name: lang === 'bn' ? p.app.bn.name : p.app.fullName || p.app.name, url, description, ...language,
      applicationCategory: p.category, operatingSystem: 'Any', browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
    };
  }
  return null;
}

// What a page may load, and from where. Everything is the site's own except
// Google Analytics (only after the visitor accepts). PDF.js decodes some images with WebAssembly; downloads, previews and
// decoded media are blob: and data: URLs. No inline scripts or styles.
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://www.googletagmanager.com",
  "style-src 'self'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com",
  "connect-src 'self' data: blob: https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

// The content security policy, title, description, canonical URL, the
// page's other language (when it has a Bangla copy), Open Graph and Twitter
// tags, structured data and icons.
export function meta(p, lang = 'en'){
  const url = SITE + href(p, lang), ld = schema(p, lang), { title, description } = words(p, lang);
  return [
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${url}">`,
    ...(p.bn ? [
      `<link rel="alternate" hreflang="en" href="${SITE + p.path}">`,
      `<link rel="alternate" hreflang="bn" href="${SITE + href(p, 'bn')}">`,
      `<link rel="alternate" hreflang="x-default" href="${SITE + p.path}">`
    ] : []),
    ...(p.noindex ? ['<meta name="robots" content="noindex">'] : []),
    '<meta property="og:site_name" content="bdnix">',
    '<meta property="og:type" content="website">',
    ...(lang === 'bn' ? [`<meta property="og:locale" content="${bangla.locale}">`] : []),
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:image" content="${SITE}/assets/img/og.png">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${esc(lang === 'bn' ? bangla.shareAlt : 'bdnix: Play a little. Get things done.')}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    ...(ld ? [`<script type="application/ld+json">${json(ld)}</script>`] : []),
    '<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">',
    '<meta name="theme-color" content="#080a12">'
  ];
}

export const footer = (lang = 'en') => [
  '<footer class="foot">',
  `  <span>© <span id="year">${digits(2026, lang)}</span> bdnix · <a href="https://github.com/bdnix/bdnix">${lang === 'bn' ? bangla.openSource : 'Open source on GitHub'}</a></span>`,
  `  <span class="foot-links"><a href="${lang === 'bn' ? '/bn/' : '/'}#suggest">${lang === 'bn' ? bangla.suggest : 'Suggest a tool or game'}</a><a href="mailto:root@bdnix.com">root@bdnix.com</a></span>`,
  '</footer>'
];

const apps = (site, kind) => site.filter((p) => p.app && p.app.kind === kind);
const ARROW = '<svg class="card-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// An app's name, blurb and search words in a language.
const app = (p, lang) => (lang === 'bn' ? { ...p.app.bn, keywords: p.app.bn.keywords + ' ' + p.app.keywords } : p.app);
// The landing page's link to each game or tool.
export const cards = (site, list, lang = 'en') => apps(site, list.replace(/s$/, '')).flatMap((p) => [
  `<a class="card panel" href="${href(p, lang)}" data-keywords="${esc(app(p, lang).keywords)}">`,
  '  <svg class="card-icon" viewBox="0 0 40 40" aria-hidden="true">',
  ...p.app.icon.map((line) => '    ' + line),
  '  </svg>',
  `  <span class="card-text"><b>${esc(app(p, lang).name)}</b><span>${esc(app(p, lang).blurb)}</span></span>`,
  '  ' + ARROW,
  '</a>'
]);
// The profile page's row for each game; profile-page.js fills in the best
// score, after the game's label for it if it has one ("Level 3").
export const scores = (site, lang = 'en') => apps(site, 'game').flatMap((p) => [
  `<div class="score panel" data-best="${p.app.best}"${p.app.bestLabel ? ` data-best-label="${esc(lang === 'bn' ? bangla.level : p.app.bestLabel)}"` : ''}>`,
  '  <svg class="score-icon" viewBox="0 0 40 40" aria-hidden="true">' + p.app.icon.join('') + '</svg>',
  `  <div class="score-text"><span>${esc(app(p, lang).name)}</span><b></b></div>`,
  `  <a class="btn btn-ghost" href="${href(p, lang)}">${lang === 'bn' ? bangla.play : 'Play'}</a>`,
  '</div>'
]);

// Replaces what's between <!-- build:name arg --> and <!-- /build:name -->
// with lines, indented like the opening marker.
export function fill(html, name, make){
  const re = new RegExp(`^( *)<!-- build:${name}(?: (\\w+))? -->\n[\\s\\S]*?^\\1<!-- /build:${name} -->$`, 'gm');
  return html.replace(re, (all, indent, arg) => [
    `${indent}<!-- build:${name}${arg ? ' ' + arg : ''} -->`,
    ...make(arg).map((line) => indent + line),
    `${indent}<!-- /build:${name} -->`
  ].join('\n'));
}

export function sitemap(site){
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    site.filter((p) => !p.noindex).flatMap((p) => p.bn ? [p.path, href(p, 'bn')] : [p.path])
      .map((path) => `  <url><loc>${SITE}${path}</loc></url>\n`).join('') + '</urlset>\n';
}
