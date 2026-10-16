// Every page of the site, and the games and tools the landing page lists.
// tools/page.mjs fills in what the pages share from this, for the build and
// the test server alike: each page's title, description and share tags
// (between <!-- build:meta --> markers), the footer (<!-- build:footer -->),
// the landing page's cards (<!-- build:cards games|tools -->), the profile
// page's scores (<!-- build:scores -->) and sitemap.xml. Adding a game or
// tool means adding it here.
//
// A page has a path, a title and description (also used for its share tags),
// and the structured data it describes itself with (schema, and a category
// for an app). A game or tool has an `app`: its kind ('game' or 'tool'), the
// name and blurb on its card (fullName, if given, names it in structured
// data), words its card is found by in the landing page search, its icon (the
// inside of a 40×40 SVG) and, for a game, the key of its best score (and
// optionally a word shown before it, bestLabel).

export const SITE = 'https://www.bdnix.com';

export const pages = [
  {
    path: '/',
    title: 'bdnix — Free browser games and PDF, audio and image tools',
    description: 'Play Falling Blocks, Maze Chase, Flap, Road Hop, Snake, Brick Bounce and chess, merge, watermark, redact, sign and unlock PDFs, turn videos into MP3s, compress, frame or collage photos, all in your browser. Nothing uploaded.',
    schema: 'WebSite',
  },
  { module: 'falling-blocks' },
  { module: 'maze-chase' },
  { module: 'flap' },
  { module: 'road-hop' },
  // Snake has moved into its module, apps/snake/ (its module.json).
  { module: 'snake' },
  { module: 'brick-bounce' },
  { module: 'chess' },
  { module: 'merge-pdf' },
  { module: 'watermark-pdf' },
  { module: 'redact-pdf' },
  { module: 'sign-pdf' },
  { module: 'unlock-pdf' },
  { module: 'mp4-to-mp3' },
  { module: 'compress-image' },
  { module: 'photo-collage' },
  { module: 'fit-to-frame' },
  {
    path: '/profile/',
    title: 'Your profile — bdnix',
    description: 'Your bdnix name and best game scores, kept in this browser.',
    noindex: true
  }
];
