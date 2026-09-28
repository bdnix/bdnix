# Privacy and data

bdnix has no server-side application and no accounts. Everything the site keeps lives in the visitor's own browser, on that device only.

## Files opened in the tools

Files are read and processed by the browser. They are never uploaded or sent anywhere, and neither is anything typed into a tool. Third-party libraries (pdf-lib, PDF.js, fontkit, lamejs) are served from this site, not from a CDN.

## Profile

The chip in the top right of the landing and tool pages links to `/profile/`. It shows the visitor's name ("User" until they set one, up to 24 characters), their best Falling Blocks, Maze Chase, Flap, Road Hop, Snake and Brick Bounce scores, and the number of visits counted by the landing page. The profile page is marked `noindex`, since it only shows what's saved in the browser.

## What is stored

In `localStorage`:

| Key | Contents |
|---|---|
| `bdnix_name` | Display name |
| `bdnix_visits` | Landing page visit count |
| `bdnix_tetris_best`, `bdnix_pacman_best`, `bdnix_flappy_best`, `bdnix_hop_best`, `bdnix_snake_best`, `bdnix_bricks_best` | Best scores |
| `bdnix_tetris_save`, `bdnix_pacman_save`, `bdnix_flappy_save`, `bdnix_hop_save`, `bdnix_snake_save`, `bdnix_bricks_save` | Games in progress |
| `bdnix_sound` | Whether game sounds are on (`on`) or muted (`off`) |
| `bdnix_watermark_v1` | Watermark tool settings |
| `bdnix_analytics` | Analytics consent choice |

In IndexedDB, the `bdnix-tools` database holds the watermark tool's chosen image and font file.

Every page works without storage (for example in private browsing); it just won't remember anything. Clearing the browser's site data removes all of it.

## Analytics

The site uses Google Analytics (measurement ID `G-67D1H8GX6X`) to count page views. On the live site (`www.bdnix.com` and `bdnix.com`) a banner asks visitors first, and Google's script only loads after they click **Accept**. **Decline** is remembered too. The choice can be changed at any time under **Analytics cookies** on the profile page; turning analytics off also deletes Google's `_ga` cookies.

Only page views are recorded. Local previews and automated tests show no banner and never contact Google.
