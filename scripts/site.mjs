// Every page of the site, and the games and tools the landing page lists.
// scripts/build.mjs writes what the pages share from this: each page's
// title, description and share tags (between <!-- build:meta --> markers),
// the footer (<!-- build:footer -->), the landing page's cards
// (<!-- build:cards games|tools -->), the profile page's scores
// (<!-- build:scores -->) and sitemap.xml. Adding a game or tool means adding
// it here, then running `npm run build`.
//
// A page has a path, a title and description (also used for its share tags),
// and the structured data it describes itself with (schema, and a category
// for an app). A game or tool has an `app`: its kind ('game' or 'tool'), the
// name and blurb on its card (fullName, if given, names it in structured
// data), words its card is found by in the landing page search, its icon (the
// inside of a 40×40 SVG) and, for a game, the key of its best score.

export const SITE = 'https://www.bdnix.com';

export const pages = [
  {
    path: '/',
    title: 'bdnix — Free browser games and PDF, audio and image tools',
    description: 'Play Falling Blocks, Maze Chase, Flap, Road Hop, Snake and Brick Bounce, merge, watermark, redact, sign and unlock PDFs, turn videos into MP3s, compress, frame or collage photos, all in your browser. Nothing to install or upload.',
    schema: 'WebSite'
  },
  {
    path: '/falling-blocks/',
    title: 'Falling Blocks — Play free in your browser | bdnix',
    description: 'Play Falling Blocks free in your browser, with the keyboard or with touch buttons on a phone. Hold a piece, hard drop, clear lines and beat your best score. Nothing to install.',
    schema: 'WebApplication', category: 'GameApplication',
    app: {
      kind: 'game', name: 'Falling Blocks', blurb: 'Stack blocks, clear lines',
      best: 'bdnix_tetris_best',   // the key the game keeps its best score under
      keywords: 'game puzzle blocks stack lines arcade',
      icon: [
        '<rect x="4" y="18" width="10" height="10" rx="2" fill="#a855f7"/>',
        '<rect x="15" y="18" width="10" height="10" rx="2" fill="#a855f7"/>',
        '<rect x="26" y="18" width="10" height="10" rx="2" fill="#a855f7"/>',
        '<rect x="15" y="7" width="10" height="10" rx="2" fill="#a855f7"/>',
        '<rect x="4" y="29" width="10" height="10" rx="2" fill="#22d3ee" opacity=".55"/>',
        '<rect x="15" y="29" width="10" height="10" rx="2" fill="#22d3ee" opacity=".55"/>',
        '<rect x="26" y="29" width="10" height="10" rx="2" fill="#22d3ee" opacity=".55"/>'
      ]
    }
  },
  {
    path: '/maze-chase/',
    title: 'Maze Chase — Play free in your browser | bdnix',
    description: 'Play Maze Chase free in your browser, with the keyboard, or with swipes and touch buttons on a phone. Eat every dot, dodge the ghosts and beat your best score. Nothing to install.',
    schema: 'WebApplication', category: 'GameApplication',
    app: {
      kind: 'game', name: 'Maze Chase', blurb: 'Eat dots, dodge ghosts',
      best: 'bdnix_pacman_best',   // the key the game keeps its best score under
      keywords: 'game arcade maze ghosts dots',
      icon: [
        '<path d="M14 20 L24.4 14 A12 12 0 1 0 24.4 26 Z" fill="#facc15"/>',
        '<circle cx="29" cy="20" r="2" fill="#eef1f8" opacity=".8"/>',
        '<circle cx="36" cy="20" r="2" fill="#eef1f8" opacity=".8"/>'
      ]
    }
  },
  {
    path: '/flap/',
    title: 'Flap — Play free in your browser | bdnix',
    description: 'Play Flap free in your browser: tap, click or press Space to flap through the gaps between the pipes. Earn medals and beat your best score. Nothing to install.',
    schema: 'WebApplication', category: 'GameApplication',
    app: {
      kind: 'game', name: 'Flap', blurb: 'Flap through the pipes',
      best: 'bdnix_flappy_best',   // the key the game keeps its best score under
      keywords: 'game arcade bird pipes fly tap',
      icon: [
        '<rect x="27" y="2" width="9" height="11" rx="1.5" fill="#22d3ee" opacity=".55"/>',
        '<rect x="27" y="27" width="9" height="11" rx="1.5" fill="#22d3ee" opacity=".55"/>',
        '<circle cx="14" cy="20" r="9" fill="#facc15"/>',
        '<ellipse cx="11" cy="22" rx="4.5" ry="2.6" fill="#f59e0b"/>',
        '<circle cx="17.5" cy="17" r="2.6" fill="#fff"/>',
        '<path d="M21 20l6 2-6 2z" fill="#fb923c"/>'
      ]
    }
  },
  {
    path: '/road-hop/',
    title: 'Road Hop — Play free in your browser | bdnix',
    description: 'Play Road Hop free in your browser: help a chicken hop across busy roads and ride logs over rivers. Keep moving, go as far as you can and beat your best. Nothing to install.',
    schema: 'WebApplication', category: 'GameApplication',
    app: {
      kind: 'game', name: 'Road Hop', blurb: 'Help a chicken cross the road',
      best: 'bdnix_hop_best',   // the key the game keeps its best score under
      keywords: 'game arcade chicken cross road cars traffic',
      icon: [
        '<rect x="0" y="4" width="40" height="10" rx="2" fill="#22d3ee" opacity=".3"/>',
        '<rect x="24" y="5.5" width="12" height="7" rx="2.5" fill="#f472b6"/>',
        '<rect x="0" y="26" width="40" height="10" rx="2" fill="#22d3ee" opacity=".3"/>',
        '<rect x="3" y="27.5" width="12" height="7" rx="2.5" fill="#a855f7"/>',
        '<ellipse cx="20" cy="21" rx="7" ry="7.5" fill="#f8fafc"/>',
        '<ellipse cx="20" cy="15" rx="2" ry="2.6" fill="#ef4444"/>',
        '<path d="M18 14l2-3.5 2 3.5z" fill="#fb923c"/>'
      ]
    }
  },
  {
    path: '/snake/',
    title: 'Snake — Play free in your browser | bdnix',
    description: 'Play Snake free in your browser: steer the snake to the food, grow longer with every bite and don’t hit the walls or your own tail. Beat your best, nothing to install.',
    schema: 'WebApplication', category: 'GameApplication',
    app: {
      kind: 'game', name: 'Snake', blurb: 'Eat, grow, don’t bite your tail',
      best: 'bdnix_snake_best',   // the key the game keeps its best score under
      keywords: 'game arcade classic grow',
      icon: [
        '<path d="M6 32h14V20h12V9" fill="none" stroke="#a855f7" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
        '<path d="M20 20h12V9" fill="none" stroke="#22d3ee" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
        '<circle cx="30.5" cy="8" r="1.3" fill="#080a12"/>',
        '<circle cx="33.5" cy="8" r="1.3" fill="#080a12"/>',
        '<circle cx="10" cy="11" r="4" fill="#f472b6"/>'
      ]
    }
  },
  {
    path: '/brick-bounce/',
    title: 'Brick Bounce — Play free in your browser | bdnix',
    description: 'Play Brick Bounce free in your browser: bounce the ball off your paddle to smash a wall of bricks, row by row, before your three balls run out. Nothing to install.',
    schema: 'WebApplication', category: 'GameApplication',
    app: {
      kind: 'game', name: 'Brick Bounce', blurb: 'Bounce the ball, smash the bricks',
      best: 'bdnix_bricks_best',   // the key the game keeps its best score under
      keywords: 'game arcade ball paddle bricks',
      icon: [
        '<rect x="3" y="5" width="10" height="6" rx="1.5" fill="#f472b6"/>',
        '<rect x="15" y="5" width="10" height="6" rx="1.5" fill="#f472b6"/>',
        '<rect x="27" y="5" width="10" height="6" rx="1.5" fill="#f472b6"/>',
        '<rect x="3" y="13" width="10" height="6" rx="1.5" fill="#a855f7"/>',
        '<rect x="27" y="13" width="10" height="6" rx="1.5" fill="#a855f7"/>',
        '<circle cx="20" cy="26" r="3" fill="#eef1f8"/>',
        '<rect x="11" y="32" width="18" height="4" rx="2" fill="#22d3ee"/>'
      ]
    }
  },
  {
    path: '/merge-pdf/',
    title: 'Merge PDFs — Combine PDF files free and private | bdnix',
    description: 'Combine several PDF files into one, free: put them in order and pick the pages you want from each. Runs in your browser; your files are never uploaded.',
    schema: 'WebApplication', category: 'UtilitiesApplication',
    app: {
      kind: 'tool', name: 'Merge PDFs', blurb: 'Combine PDFs into one',
      keywords: 'tool pdf combine join documents',
      icon: [
        '<rect x="5" y="5" width="18" height="23" rx="3" fill="#22d3ee" opacity=".55"/>',
        '<rect x="17" y="12" width="18" height="23" rx="3" fill="#a855f7"/>',
        '<path d="M21 20h10M21 24h10M21 28h6" stroke="#eef1f8" stroke-width="2" stroke-linecap="round" opacity=".8"/>'
      ]
    }
  },
  {
    path: '/watermark-pdf/',
    title: 'Watermark a PDF — Add text or image watermarks | bdnix',
    description: 'Add a text or image watermark to a PDF, free: pick the font, size, opacity, angle and position, or repeat it across the page. Runs in your browser; your file is never uploaded.',
    schema: 'WebApplication', category: 'UtilitiesApplication',
    app: {
      kind: 'tool', name: 'Watermark a PDF', blurb: 'Stamp text or a logo',
      keywords: 'tool pdf stamp logo text documents',
      icon: [
        '<rect x="9" y="4" width="22" height="32" rx="3" fill="#22d3ee" opacity=".55"/>',
        '<path d="M12 28 L28 12" stroke="#f472b6" stroke-width="4" stroke-linecap="round"/>',
        '<path d="M13 9h9M13 33h7" stroke="#eef1f8" stroke-width="2" stroke-linecap="round" opacity=".7"/>'
      ]
    }
  },
  {
    path: '/redact-pdf/',
    title: 'Redact a PDF — Black out text for good | bdnix',
    description: 'Black out names, numbers and anything else in a PDF for good, free: find words on every page or draw boxes by hand. Runs in your browser; your file is never uploaded.',
    schema: 'WebApplication', category: 'UtilitiesApplication',
    app: {
      kind: 'tool', name: 'Redact a PDF', blurb: 'Black out text for good',
      keywords: 'tool pdf black out hide censor private documents',
      icon: [
        '<rect x="9" y="4" width="22" height="32" rx="3" fill="#22d3ee" opacity=".55"/>',
        '<rect x="12" y="11" width="16" height="5" rx="1" fill="#080a12"/>',
        '<path d="M13 22h14M13 28h8" stroke="#eef1f8" stroke-width="2" stroke-linecap="round" opacity=".7"/>',
        '<rect x="19" y="25.5" width="9" height="5" rx="1" fill="#080a12"/>'
      ]
    }
  },
  {
    path: '/sign-pdf/',
    title: 'Sign a PDF — Add your signature free | bdnix',
    description: 'Sign a PDF free: draw your signature, type it in a handwriting font or upload a picture of it, then move, resize and turn it anywhere on the page. Runs in your browser; your file is never uploaded.',
    schema: 'WebApplication', category: 'UtilitiesApplication',
    app: {
      kind: 'tool', name: 'Sign a PDF', blurb: 'Draw, type or upload a signature',
      keywords: 'tool pdf signature sign esign autograph initials documents',
      icon: [
        '<rect x="9" y="4" width="22" height="32" rx="3" fill="#22d3ee" opacity=".55"/>',
        '<path d="M13 10h14M13 15h10" stroke="#eef1f8" stroke-width="2" stroke-linecap="round" opacity=".7"/>',
        '<path d="M11 28c3-6 5-10 7-10s-1 9 2 9 3-4 5-4 1 3 4 3" fill="none" stroke="#a855f7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
        '<path d="M12 32h18" stroke="#f472b6" stroke-width="2" stroke-linecap="round"/>'
      ]
    }
  },
  {
    path: '/unlock-pdf/',
    title: 'Unlock a PDF — Remove a PDF password free | bdnix',
    description: 'Remove the password from a PDF you can open, free: type its password once and download a copy that opens without one. Runs in your browser; your file and password are never uploaded.',
    schema: 'WebApplication', category: 'UtilitiesApplication',
    app: {
      kind: 'tool', name: 'Unlock a PDF', blurb: 'Remove a PDF’s password',
      keywords: 'tool pdf password unlock decrypt remove protection encryption security documents',
      icon: [
        '<rect x="9" y="4" width="22" height="32" rx="3" fill="#22d3ee" opacity=".55"/>',
        '<path d="M13 9h14M13 14h9" stroke="#eef1f8" stroke-width="2" stroke-linecap="round" opacity=".7"/>',
        '<path d="M16 23v-4a4 4 0 0 1 7.6-1.7" fill="none" stroke="#f472b6" stroke-width="2.4" stroke-linecap="round"/>',
        '<rect x="13" y="23" width="14" height="10" rx="2" fill="#a855f7"/>',
        '<circle cx="20" cy="28" r="1.6" fill="#eef1f8"/>'
      ]
    }
  },
  {
    path: '/mp4-to-mp3/',
    title: 'MP4 to MP3 — Convert video to audio free | bdnix',
    description: 'Extract the sound from MP4, MOV, WebM and MKV videos, or convert M4A, WAV, FLAC and Ogg audio, to MP3 (64 to 320 kbps) or WAV, in stereo or mono. Convert several files at once. Runs in your browser; your files are never uploaded.',
    schema: 'WebApplication', category: 'MultimediaApplication',
    app: {
      kind: 'tool', name: 'MP4 to MP3', blurb: 'Video or audio to MP3 or WAV',
      keywords: 'tool audio video music sound convert extract wav',
      icon: [
        '<rect x="3" y="8" width="22" height="17" rx="3" fill="#22d3ee" opacity=".55"/>',
        '<path d="M11 12.5v8l6.5-4z" fill="#eef1f8" opacity=".8"/>',
        '<path d="M27 31V16l9-2v14" fill="none" stroke="#a855f7" stroke-width="2.4" stroke-linejoin="round"/>',
        '<circle cx="24.5" cy="31" r="3.5" fill="#a855f7"/>',
        '<circle cx="33.5" cy="28" r="3.5" fill="#a855f7"/>'
      ]
    }
  },
  {
    path: '/compress-image/',
    title: 'Compress Images — Shrink JPEG, PNG and WebP free | bdnix',
    description: 'Make photos and images smaller: save JPEG, PNG and WebP at the quality you choose, shrink big photos to a size you pick, and strip location data. Runs in your browser; your images are never uploaded.',
    schema: 'WebApplication', category: 'MultimediaApplication',
    app: {
      kind: 'tool', name: 'Compress Images', blurb: 'Make photos smaller',
      keywords: 'tool image photo picture jpg jpeg png webp shrink smaller resize',
      icon: [
        '<rect x="3" y="5" width="26" height="22" rx="3" fill="#22d3ee" opacity=".55"/>',
        '<circle cx="11" cy="12" r="3" fill="#eef1f8" opacity=".8"/>',
        '<path d="M3 24l8-7 6 5 5-4 7 6v0a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill="#eef1f8" opacity=".35"/>',
        '<rect x="20" y="20" width="16" height="16" rx="3" fill="#a855f7"/>',
        '<path d="M24 24l3 3M32 32l-3-3M27 24v3h-3M29 32v-3h3" fill="none" stroke="#eef1f8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
      ]
    }
  },
  {
    path: '/photo-collage/',
    title: 'Photo Collage Maker — 3, 6 or 9 photos free | bdnix',
    description: 'Make a photo collage from 3, 6 or 9 photos: pick a layout and shape, set the spacing, corners and background, and download a JPEG or PNG. Runs in your browser; your photos are never uploaded.',
    schema: 'WebApplication', category: 'MultimediaApplication',
    app: {
      kind: 'tool', name: 'Photo Collage', fullName: 'Photo Collage Maker', blurb: '3, 6 or 9 photos in one',
      keywords: 'tool image photo picture grid combine',
      icon: [
        '<rect x="4" y="4" width="19" height="19" rx="3" fill="#22d3ee" opacity=".55"/>',
        '<rect x="26" y="4" width="10" height="8" rx="2" fill="#a855f7"/>',
        '<rect x="26" y="15" width="10" height="8" rx="2" fill="#f472b6"/>',
        '<rect x="4" y="26" width="10" height="10" rx="2" fill="#a855f7"/>',
        '<rect x="17" y="26" width="19" height="10" rx="2" fill="#22d3ee" opacity=".55"/>',
        '<circle cx="10" cy="10" r="2.5" fill="#eef1f8" opacity=".8"/>',
        '<path d="M4 20l6-5 5 4 3-2 5 4v0a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="#eef1f8" opacity=".35"/>'
      ]
    }
  },
  {
    path: '/fit-to-frame/',
    title: 'Resize Without Cropping — Fit any shape, free | bdnix',
    description: 'Make a photo fit a post, story or banner without cropping it: add white or coloured space to its sides or top and bottom. Runs in your browser; your images are never uploaded.',
    schema: 'WebApplication', category: 'MultimediaApplication',
    app: {
      kind: 'tool', name: 'Resize Without Cropping', blurb: 'Add space to fit any shape',
      keywords: 'tool image photo picture resize crop pad border frame square social',
      icon: [
        '<rect x="4" y="4" width="32" height="32" rx="3" fill="#eef1f8" opacity=".85"/>',
        '<rect x="4" y="11" width="32" height="18" fill="#22d3ee" opacity=".75"/>',
        '<circle cx="12" cy="17" r="2.5" fill="#eef1f8" opacity=".85"/>',
        '<path d="M4 27l9-6 6 4 6-5 11 7v2H4z" fill="#a855f7"/>'
      ]
    }
  },
  {
    path: '/profile/',
    title: 'Your profile — bdnix',
    description: 'Your bdnix name and best game scores, kept in this browser.',
    noindex: true
  }
];
