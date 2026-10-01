// The parts of the pages that scripts/build.mjs writes from scripts/site.mjs:
// each page's head tags, the footer, the landing page's cards, the profile
// page's scores and the sitemap. Pure functions of the site's data, so they
// can be unit tested.
import { SITE } from './site.mjs';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// JSON on one line, spaced like the rest of the page's markup.
const json = (v) => (v && typeof v === 'object'
  ? '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + json(x)).join(', ') + '}'
  : JSON.stringify(v)).replace(/<\//g, '<\\/');

export function schema(p){
  const url = SITE + p.path;
  if (p.schema === 'WebSite') return { '@context': 'https://schema.org', '@type': 'WebSite', name: 'bdnix', url, description: p.description };
  if (p.schema === 'WebApplication') {
    return {
      '@context': 'https://schema.org', '@type': 'WebApplication', name: p.app.fullName || p.app.name, url, description: p.description,
      applicationCategory: p.category, operatingSystem: 'Any', browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
    };
  }
  return null;
}

// Title, description, canonical URL, Open Graph and Twitter tags, structured
// data and icons.
export function meta(p){
  const url = SITE + p.path, ld = schema(p);
  return [
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.description)}">`,
    `<link rel="canonical" href="${url}">`,
    ...(p.noindex ? ['<meta name="robots" content="noindex">'] : []),
    '<meta property="og:site_name" content="bdnix">',
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${esc(p.title)}">`,
    `<meta property="og:description" content="${esc(p.description)}">`,
    `<meta property="og:image" content="${SITE}/assets/img/og.png">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="bdnix: Play a little. Get things done.">',
    '<meta name="twitter:card" content="summary_large_image">',
    ...(ld ? [`<script type="application/ld+json">${json(ld)}</script>`] : []),
    '<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">',
    '<meta name="theme-color" content="#080a12">'
  ];
}

export const footer = () => [
  '<footer class="foot">',
  '  <span>© <span id="year">2026</span> bdnix · <a href="https://github.com/bdnix/bdnix">Open source on GitHub</a></span>',
  '  <span class="foot-links"><a href="/#suggest">Suggest a tool or game</a><a href="mailto:root@bdnix.com">root@bdnix.com</a></span>',
  '</footer>'
];

const apps = (site, kind) => site.filter((p) => p.app && p.app.kind === kind);
const ARROW = '<svg class="card-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// The landing page's link to each game or tool.
export const cards = (site, list) => apps(site, list.replace(/s$/, '')).flatMap((p) => [
  `<a class="card panel" href="${p.path}" data-keywords="${esc(p.app.keywords)}">`,
  '  <svg class="card-icon" viewBox="0 0 40 40" aria-hidden="true">',
  ...p.app.icon.map((line) => '    ' + line),
  '  </svg>',
  `  <span class="card-text"><b>${esc(p.app.name)}</b><span>${esc(p.app.blurb)}</span></span>`,
  '  ' + ARROW,
  '</a>'
]);
// The profile page's row for each game; profile-page.js fills in the best score.
export const scores = (site) => apps(site, 'game').flatMap((p) => [
  `<div class="score panel" data-best="${p.app.best}">`,
  '  <svg class="score-icon" viewBox="0 0 40 40" aria-hidden="true">' + p.app.icon.join('') + '</svg>',
  `  <div class="score-text"><span>${esc(p.app.name)}</span><b></b></div>`,
  `  <a class="btn btn-ghost" href="${p.path}">Play</a>`,
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
    site.filter((p) => !p.noindex).map((p) => `  <url><loc>${SITE}${p.path}</loc></url>\n`).join('') + '</urlset>\n';
}
