# bdnix

[![Tests](https://github.com/bdnix/bdnix/actions/workflows/tests.yml/badge.svg?branch=master)](https://github.com/bdnix/bdnix/actions/workflows/tests.yml?query=branch%3Amaster)
[![Coverage](https://codecov.io/gh/bdnix/bdnix/branch/master/graph/badge.svg)](https://codecov.io/gh/bdnix/bdnix)

Free, private tools and classic games that run entirely in your browser, at **[www.bdnix.com](https://www.bdnix.com)**.

There's nothing to install and no account to create. Files you open in a tool are processed on your own device and are never uploaded.

## Tools

| Tool | What it does |
|---|---|
| [Merge PDFs](https://www.bdnix.com/merge-pdf/) | Combine several PDFs into one, in any order, choosing which pages to keep from each. |
| [Watermark PDF](https://www.bdnix.com/watermark-pdf/) | Stamp text or an image on your pages, with a live preview and control over font, size, opacity, rotation, position and layering. |
| [Redact PDF](https://www.bdnix.com/redact-pdf/) | Permanently black out text and areas. Search for words or draw boxes; the covered content is removed, not just hidden. |
| [MP4 to MP3](https://www.bdnix.com/mp4-to-mp3/) | Extract the audio from videos and audio files as MP3 or WAV, at the quality and channel layout you choose. |
| [Compress Images](https://www.bdnix.com/compress-image/) | Shrink photos and images as JPEG, WebP or PNG, optionally resizing them. Camera metadata such as location is stripped. |

## Games

| Game | What it is |
|---|---|
| [Falling Blocks](https://www.bdnix.com/falling-blocks/) | Stack falling blocks and clear lines, with hold, hard drop and a ghost piece. |
| [Maze Chase](https://www.bdnix.com/maze-chase/) | Clear the maze of dots while avoiding the ghosts, or eat a power pellet and chase them. |
| [Flap](https://www.bdnix.com/flap/) | Tap to fly through the gaps in the pipes and earn medals. |
| [Road Hop](https://www.bdnix.com/road-hop/) | Help a chicken hop across busy roads and ride logs over rivers, as far as it can go. |
| [Snake](https://www.bdnix.com/snake/) | Steer the snake to the food and grow as long as you can without hitting a wall or your own tail. |
| [Brick Bounce](https://www.bdnix.com/brick-bounce/) | Bounce a ball off your paddle to smash a wall of bricks, one wall after another, before your three balls run out. |

Every game plays with keyboard, mouse or touch, has sound effects (mute them with the speaker button or M), keeps your best score, and saves a game in progress so you can pick up where you left off, even days later.

Your display name and best scores are shown on your [profile](https://www.bdnix.com/profile/), which is stored only in your browser.

## Privacy

- **No uploads.** Files are read and processed by your browser. There is no server-side processing, and libraries are served from this site rather than third-party CDNs.
- **No accounts.** Your name, scores and saved settings stay in your browser's local storage.
- **Optional analytics.** The site counts page views with Google Analytics only if you accept the cookie banner. You can change your choice at any time on the profile page.

## Documentation

- [Tools guide](docs/tools.md): every option in each tool, with its limits and browser support.
- [Games guide](docs/games.md): controls, scoring and how saved games work.
- [Privacy and data](docs/privacy.md): what the site stores in your browser and how analytics consent works.
- [Development](docs/development.md): running the site locally, project layout, tests, coverage and deployment.

## Contributing

Pull requests are welcome. Please read [AGENTS.md](AGENTS.md) for the project's conventions first: every change needs tests, and coverage must not drop.

Quick start (Node 22 or later):

```bash
npm install
npm run serve     # http://localhost:4173
npm test
```

## Requests and contact

Want a tool or game that isn't here, or a feature for one that is? [Open a request on GitHub](https://github.com/bdnix/bdnix/issues/new?template=request.yml) or email root@bdnix.com.

## Licence

The code is released under the [MIT License](LICENSE), © bdnix. The licence covers the code only, not the bdnix name or logo.

The games are original takes on classic genres and aren't affiliated with or endorsed by the owners of any similar games. Third-party libraries in [assets/vendor/](assets/vendor/) keep their own licences (MIT, Apache 2.0 and LGPL), listed in [Development](docs/development.md#third-party-libraries).
