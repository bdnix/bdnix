# King of Streets: production plan

The plan for building King of Streets (রাস্তার রাজা) from scratch. The owner approved it on 28 October 2026. **A new session starts here: read all of this file, then [AGENTS.md](../../AGENTS.md), then carry on from [Where the work is](#where-the-work-is).**

**Nothing is approved yet, and nothing from the first attempt is kept.** That attempt (the `street-kids` branch and PR #103, closed) failed. Don't read, copy or reuse its code, models, pictures or tools. Every object, screen and setting is found, made and approved afresh. What this file keeps from it is only the owner's requirements and feedback ([section 5](#5-the-owners-decisions)) and the lessons ([section 6](#6-lessons-from-the-first-attempt)).

The same plan, laid out for reading on a phone: <https://claude.ai/artifact/RUArrWhgtEgsnZXeuiN1R3>. This file is the one kept up to date.

## Contents

1. [Rules for every phase](#1-rules-for-every-phase)
2. [The phases](#2-the-phases)
3. [Every object in the game](#3-every-object-in-the-game)
4. [How a review works](#4-how-a-review-works)
5. [The owner's decisions](#5-the-owners-decisions)
6. [Lessons from the first attempt](#6-lessons-from-the-first-attempt)
7. [Quality targets on the owner's iPhone 15 Pro](#7-quality-targets-on-the-owners-iphone-15-pro)
8. [Risks](#8-risks)
9. [Working with the owner](#9-working-with-the-owner)
10. [Environment](#10-environment)
11. [Where the work is](#where-the-work-is)

## 1. Rules for every phase

- **Nothing on the site until the end.** Nothing reaches `master` or bdnix.com until the owner approves the finished game (Phase 10). No pull request before Phase 11. The owner merges.
- **Work on the `king-of-streets` branch**, made from `master` on 28 October 2026.
- **Short reviews.** At most 13 items per review, on one page of pictures, clips or sounds, sent as one link in the chat. The owner replies in the chat: "approved", or the IDs that need work and why.
- **Approve what ships.** Every object is shown as the exact file the game will load, drawn by the game itself at iPhone size. Never show a more detailed version than the game will use.
- **Approved means frozen.** Record each approved file and its SHA-256 in [the register](#3-every-object-in-the-game). If the file changes afterwards, the build fails until the owner has seen and approved the change.
- **The owner's feedback is kept.** Every point the owner raises is logged under its ID in the register, and every later preview is checked against all of them.
- **Check before the owner does.** Check every preview at iPhone 15 Pro size (393 × 852 upright, 852 × 393 sideways) against the owner's requirements and every past point of feedback before sending it. Never send something with a known problem.
- **One phase at a time.** Nothing in a later phase starts until the owner has approved the one before.
- **Never ask about anything in [section 5](#5-the-owners-decisions).** Build to it.

## 2. The phases

| # | Phase | The owner reviews |
|---|---|---|
| 1 | Set-up | Nothing |
| 2 | Every object | 95 objects, in 11 rounds of 5 to 13 |
| 3 | Names | Names for every character, and made-up names for the bikes |
| 4 | The five routes | Each route's look and light, and its speed on the phone |
| 5 | Screens | Mock-ups of every screen and the in-race controls |
| 6 | Riding | How the bike feels to ride |
| 7 | Fighting | Punches, kicks and weapons |
| 8 | First full race | Route 1 from the start screen to the results |
| 9 | Whole game | Every route, the garage, race select, career and quick race |
| 10 | Final play-through | The finished game; after this, fixes only |
| 11 | Release | The owner merges; then check the live page |

### Phase 1: Set-up

- Close PR #103. (Done.)
- Create the `king-of-streets` branch from `master`. (Done.)
- Write this plan. (Done.)
- Make every playable preview send the phone's frame rate, worst frames and load time back to Claude quietly in the background (the artifact's `db` capability), so the owner never has to report them.
- The owner reviews nothing.

### Phase 2: Every object

Each of the 95 objects in [section 3](#3-every-object-in-the-game) goes through these steps:

1. Source found.
2. Made game-ready.
3. Drawn by the game.
4. Checked by Claude.
5. The owner approves.
6. Frozen.

- Search afresh for each object. Use free models only (CC0 or CC BY), each credited. Remove makers' logos.
- If no free model is good enough, say so on that item. The owner decides whether to use the best there is, cut it, or stop.
- Show each item with the owner's requirements for it (its note in the register, and [section 5](#5-the-owners-decisions)).
- One round per preview, and the next round only after the owner has replied.

| Round | Items | What |
|---|---|---|
| 1 | 5 | Bikes (A) |
| 2 | 13 | The player's two riders and the helmet (B), each rider on every bike (C) |
| 3 | 9 | Rivals (D) and weapons (E) |
| 4 | 8 | Traffic (F) |
| 5 | 9 | People on the footpaths (G) |
| 6 | 12 | Street, H1 to H12 |
| 7 | 11 | Street, H13 to H23 |
| 8 | 5 | Light at each time of day (I) |
| 9 | 8 | Movements (J) |
| 10 | 8 | Sounds for bikes and riding, K1 to K8 |
| 11 | 7 | Sounds for fights and the street, K9 to K15 |

Done when all 95 are approved. A rider on a bike is approved only with fingers closed round the grips, feet on the pegs and the side stand up.

### Phase 3: Names

Once the owner has seen every character, propose names in Bangla and English, each with its meaning, in the style the owner picks:

- the player's two riders;
- the six rivals;
- the five bikes, which need made-up names because the makers' names are off.

Show one page with each character's picture, its proposed name and some alternatives. Done when every name is approved. The names are then fixed for the HUD, the screens, saves and Bangla.

Style ideas already shown to the owner (28 October), none chosen yet:

- Dhaka street nicknames: Toofan, Bijli, Shikari, Bagha, Agun, Daku.
- A boss for each route: Nawab, Kuasha, Jheel Rani, Ulka, Rocket, and Raja (the reigning King).
- English rider tags: Nitro, Viper, Ghost, Razor, Venom, Blaze.

The owner rejected the old rival names (Kalu, Bablu, Mintu, Rocky, Tinku, Pinky) as uncreative. Don't use them.

### Phase 4: The five routes

- Lay out each route from approved objects only: its streets, mosques and shops, the flyover, expressway or lake, its time of day, its traffic and its people.
- Make each route load fast and run smoothly on an iPhone.
- One route per preview: a ride along it with no game on top. The phone's numbers come back on their own.

Done when every route looks right and meets the targets in [section 7](#7-quality-targets-on-the-owners-iphone-15-pro). The targets are fixed here and measured again at every later review.

### Phase 5: Screens

Mock-ups at iPhone size, upright and sideways, made from approved pictures and names:

- the start screen;
- the garage: large pictures of the bikes and the player's rider, and nothing else, with no races and no unexplained numbers;
- race select, on a screen of its own, each route a picture described in plain words;
- quick race, results, pause, settings and loading;
- the race HUD, with the Punch, Kick and Brake buttons and the choice of steering.

Done when every screen is approved. They're then built exactly as approved, in Phases 8 and 9.

### Phase 6: Riding

On Route 1, with no rivals or traffic:

- speed, lean and braking;
- drag and tilt steering;
- the chase camera, and the rider's view with hands and dashboard;
- engine and wind sound.

The preview is a playable ride with two or three versions to switch between, for example camera distance or how sharply the bike steers.

Done when the owner picks the version that feels like a motorbike. Its settings are then frozen.

### Phase 7: Fighting

- Rivals alongside.
- Punch and kick, with a clear sign when a rival is in reach, and timing that's easy to hit.
- Hits that look, sound and feel like they land: a short pause, the rival reeling, their bike wobbling.
- Weapons, and taking one from a rival you knock off.
- Knock-offs.
- Kicking CNGs out of the way.
- A tip in the first race on how to fight.

Done when the owner approves fighting on the phone.

### Phase 8: First full race

Route 1 complete:

- the approved start screen, loading and countdown;
- rivals, traffic, people and crashes;
- the HUD, finish and results;
- pause, resume, and a saved race coming back paused;
- the full sound mix, with street hum and horns.

Done when the race is approved and meets the targets on the phone.

### Phase 9: Whole game

- Routes 2 to 5 as races.
- The garage, race select, quick race and settings, built to the Phase 5 mock-ups.
- The career: points, buying bikes (about 15 good races to the top bike), unlocking routes.
- Rivals on bikes that match each level.
- Bangla throughout.
- One route's race per preview, then the career.

### Phase 10: Final play-through

The owner plays the career from the first race to the top bike. Content is frozen: only what the owner reports gets fixed, until nothing is left. Done when the owner approves the finished game. This is the last approval.

### Phase 11: Release

- Write the repository's tests for everything approved, including the frozen pictures.
- Write the docs and credits.
- Keep a full UI test run under 30 minutes, with the game's own specs under 5 of them. A full run of `master`'s UI tests took 22 min 56 s on 26 October 2026.
- Open the pull request with green CI. The owner merges.
- Check that the live page at bdnix.com/king-of-streets matches the approved game.
- The owner reviews the Bangla after release.

## 3. Every object in the game

This is the register. Fill in each item's source, status, approval date, frozen file and SHA-256 as the work goes. Every item starts as **to review**.

Statuses:

- **to review**
- **needs work**, with the owner's note
- **approved**, with the date and the file's SHA-256

### A. Bikes (round 1)

Shown from the side, three-quarters and rear, close up and at race distance, with makers' logos removed.

| ID | Object | Requirements | Status |
|---|---|---|---|
| A1 | Level 1: scooter | The weakest bike; the player starts on it | to review |
| A2 | Level 2: 125 cc commuter | Side stand up when ridden | to review |
| A3 | Level 3: 135 cc street bike | | to review |
| A4 | Level 4: 600 cc sport bike | | to review |
| A5 | Level 5: hyper bike | The best bike | to review |

### B. The player's riders (round 2)

Shown standing and seated, from the front, side and back, in the helmet.

| ID | Object | Requirements | Status |
|---|---|---|---|
| B1 | Male rider | Everyday clothes, straight back, no face or hair showing, smooth finish with no gaps where clothes meet | to review |
| B2 | Female rider | As B1; told apart from B1 at a glance, from the game's camera; no ponytail out of the helmet | to review |
| B3 | Full-face helmet in each rider's colour | Dark visor | to review |

### C. The player's riders on each bike (round 2)

Shown from the side, three-quarters and rear, with close-ups of each hand and of the stand.

| ID | Object | Requirements | Status |
|---|---|---|---|
| C1–C5 | B1 on A1 to A5 | Fingers closed round the grips (no finger under or off the grip, no grip coming out between fingers), feet on the pegs, stand up | to review |
| C6–C10 | B2 on A1 to A5 | As C1–C5 | to review |

### D. Rivals (round 3)

Each rival on all five bikes, with close-ups of the hands, in their own helmet and clothes colours, never quite matching the player's. Named in Phase 3.

| ID | Object | Requirements | Status |
|---|---|---|---|
| D1–D6 | Six rivals, men and women | As B and C | to review |

### E. Weapons (round 3)

Shown on their own and in a rider's hand on a bike.

| ID | Object | Status |
|---|---|---|
| E1 | Stick | to review |
| E2 | Chain | to review |
| E3 | Nunchaku | to review |

### F. Traffic (round 4)

Shown from the front, side and rear at road distance, in daylight and at night.

| ID | Object | Requirements | Status |
|---|---|---|---|
| F1 | CNG auto-rickshaw | **No white rectangle on its back.** Only the Bangla number plate there | to review |
| F2 | CNG driver | The CNG drivers' blue uniform, shirt untucked; seated, or standing near a parked CNG | to review |
| F3 | Sedan | Bangla plate on the car's own plate area, lettering filling it, nothing showing behind it | to review |
| F4 | Hatchback | As F3 | to review |
| F5 | Local bus | A Dhaka bus, not a Chinese-looking one | to review |
| F6 | Truck | A Bangladeshi painted truck | to review |
| F7 | Second truck | As F6 | to review |
| F8 | Cycle rickshaw | | to review |

### G. People on the footpaths (round 5)

Shown walking, at footpath distance.

| ID | Object | Requirements | Status |
|---|---|---|---|
| G1–G5 | Five men | Mostly darker skin, as Bangladeshi people are | to review |
| G6–G7 | Two women | As G1–G5 | to review |
| G8 | Another man | As G1–G5 | to review |
| G9 | The walk | Natural, for everyone | to review |

If no free rigged model can be found of a woman in a sari or salwar kameez, or a man in a lungi, say so in round 5. The owner decides whether the footpaths go without them.

### H. Street and city (rounds 6 and 7)

Shown close up, and from the rider's height at race speed, in the light of each time of day it appears in.

| ID | Object | Requirements | Status |
|---|---|---|---|
| H1 | Road surface and lane lines | Flat: no hills | to review |
| H2 | Kerb | | to review |
| H3 | Footpath | Tiles, not a smooth block | to review |
| H4 | Buildings | Dhaka buildings | to review |
| H5 | Window grills | | to review |
| H6 | Shopfronts | Real-looking, not drawn | to review |
| H7 | Rolling shutters | | to review |
| H8 | Open shops with goods | | to review |
| H9 | Shop signboards | In Bangla | to review |
| H10 | Billboards | | to review |
| H11 | Air-conditioner units | | to review |
| H12 | Electricity poles and cables | As in Dhaka today | to review |
| H13 | Street lamps | | to review |
| H14 | Trees | Trees that grow in Dhaka; no date palms; nothing growing out of a building | to review |
| H15 | Second kind of tree | As H14 | to review |
| H16 | Neighbourhood mosque | Loads of mosques along every route | to review |
| H17 | Large mosque | As H16 | to review |
| H18 | Mosque compound wall and gate | | to review |
| H19 | Number plates | Bangla; the right size; on the vehicle's own plate area; border inside the edge | to review |
| H20 | Start and finish lines | | to review |
| H21 | Flyover: ramps, deck and pillars | | to review |
| H22 | Elevated expressway | | to review |
| H23 | Hatirjheel lake and bridges | | to review |

### I. Light and sky (round 8)

The same street shown in each light, bright enough to see clearly.

| ID | Time | Route | Status |
|---|---|---|---|
| I1 | After midnight, little traffic | Easier level | to review |
| I2 | Early morning, little traffic | Easier level | to review |
| I3 | Midday | Middle level | to review |
| I4 | Evening rush hour | Hard level | to review |
| I5 | Morning rush hour | Hardest level | to review |

Which route goes with which time is proposed in Phase 4. The routes include a flyover, the expressway and Hatirjheel.

### J. Movements (round 9)

Shown as short clips at normal speed and slowed down, judged on pose and hands. Timing is judged later, in Phases 6 and 7.

| ID | Movement | Status |
|---|---|---|
| J1 | Leaning into a turn, body and hands staying with the bike | to review |
| J2 | Punch, left and right | to review |
| J3 | Kick, left and right | to review |
| J4 | Weapon swing | to review |
| J5 | Taking a hit: reeling, bike wobbling | to review |
| J6 | Knocked off the bike | to review |
| J7 | A CNG shoved aside, its driver getting out | to review |
| J8 | Crashing into traffic or a pole | to review |

### K. Sounds (rounds 10 and 11)

Played on their own, then in a short clip of the game. Recordings, not beeps, from free sources, credited.

| ID | Sound | Status |
|---|---|---|
| K1–K5 | Each bike's engine: a different voice for each, following the revs, gear changes and idle | to review |
| K6 | A rival's bike passing | to review |
| K7 | Wind at speed | to review |
| K8 | Tyre squeal and braking | to review |
| K9 | Punch landing | to review |
| K10 | Kick landing | to review |
| K11 | Weapon hit, and a miss | to review |
| K12 | Crash and fall | to review |
| K13 | Street hum for each time of day, with CNG two-strokes and bus and truck diesels | to review |
| K14 | Horns: constant at rush hour, rare at night | to review |
| K15 | Countdown, start, finish, new best | to review |

Total: 95 objects.

## 4. How a review works

| Step | What happens |
|---|---|
| Send | One link in the chat, to a single page for that review: up to 13 items, each with its ID, its pictures, clip or sound, and its requirements. Publish it with the Artifact tool. |
| Owner replies | In the chat: "approved", or the IDs that need work and what's wrong. |
| Needs work | Fix it. The next link shows only the fixed items, before and after. |
| Approved | Freeze it: record the file, its SHA-256 and the date in the register. |
| Change of mind | The owner can reopen anything. Say what else depends on it before it changes. |
| Records | This file. The owner tracks nothing. |

## 5. The owner's decisions

Build to these, and don't ask about them again. They're the owner's requirements, not approvals of anything made.

| Area | Decision |
|---|---|
| Name | King of Streets / রাস্তার রাজা. The game that inspired it is named only in the credit line on the start screen and in the Credits section of `docs/games.md` (see AGENTS.md). |
| Game | Motorbike racing through Dhaka, fighting rivals with punches, kicks and weapons (a stick, a chain, a nunchaku). Riders can kick or shove CNGs off the road, but not bigger vehicles like cars, buses or trucks. |
| Look | Real-looking: realistic motorcycles, riders, cars and traffic, made from artist-made models and photo textures. Rejected so far: flat 2D, shapes built in code, cartoon or low-poly models, and graphics that look like a game from the 2000s. |
| The player's riders | Two: one man and one woman, easy to tell apart. Full-face helmets, no faces, no hair or ponytails out of the helmet. Everyday clothes, not riding suits. Straight backs. Hands closed on the grips. |
| Names | Every character's and bike's name is confirmed in Phase 3. |
| City | Dhaka: no hills, loads of mosques, flyovers and an expressway. Dhaka buses and painted trucks, not Chinese-looking ones. CNGs with no white rectangle on the back. CNG drivers in their uniform, shirts untucked, standing near parked CNGs. Proper Bangla number plates. Shops that look real. Tiled footpaths. Poles and cables as in Dhaka today. Pedestrians mostly darker-skinned, as Bangladeshi people are. No date palms. |
| Bikes and career | Five bikes, level 1 the weakest and level 5 the best. Start on a scooter, win races and earn points to buy better bikes. Prices 1,500 / 4,000 / 10,000 / 22,500: about 15 good races to the top bike. Also one-off races on any bike. |
| Routes | Time is part of each level: the easier ones early morning or after midnight with little traffic, the hardest in the morning or evening rush hour. |
| Views | Chase camera, plus an optional rider's view that shows the rider's hands and the bike's dashboard. |
| Controls | On a phone, steer by tilting it or dragging a thumb, whichever the player picks. On a computer, the keyboard. |
| Screen | Full screen wherever it's played, upright or sideways. |
| Sound | Bike engine sounds and traffic sounds. |
| Logos | Removed, with made-up bike names, to avoid trademark trouble (28 October). |
| Bangla | Fully translated. The owner reviews it after release. |
| Assets | Free only; nothing to buy. Sketchfab through the owner's free account. |
| Release | Nothing on the site until the owner is fully satisfied with the previews. |
| Tests | A full UI test run takes no more than 30 minutes. |

## 6. Lessons from the first attempt

| What went wrong | Cause | The rule now |
|---|---|---|
| Hands came off the grips in the game after looking right in stills | The stills used detailed models; the game shipped simplified ones nobody had approved | Approve the exact file that ships, then freeze it |
| Fingers kept going wrong: under the grip, looking taped on, the grip coming out between them | Fingers fitted one by one never close like a real hand | Pose the hand as a whole from a real rider's grip, and check close-ups of every rider on every bike |
| A bike was ridden with its stand down | The fix was noted and then lost | Each object's needed fixes go in its register entry, and it isn't shown until they're done |
| Dark, pixelated, slow to load, lagging over time | Built and judged on a desktop, never measured on an iPhone | The phone's numbers at every playable review |
| Didn't feel like a motorbike game | Feel was never tested on its own | Phase 6: riding only, with versions to choose from |
| Fights unclear, fake-looking, hard to time | Built together with everything else | Phase 7: fighting only |
| Poor sound | Sounds never approved one by one | K1 to K15 |
| Garage all text, then poor pictures, with races in it | Screens designed while coding | Phase 5 mock-ups first |
| UI tests took 32 to 45 minutes | Heavy 3D specs with no time budget | A full run under 30 minutes, the game's share under 5 |
| The owner found problems Claude should have caught | Work sent before it was checked at iPhone size | Check everything before each review |
| Changing everything at once broke things already fixed | Every part built in parallel | One phase at a time, with earlier work frozen |
| Asking about things already decided | No single record of decisions | Section 5 |
| Saying a 2D version was on the site when it wasn't | Stated without checking | Check facts (git, the live site) before stating them |
| Date palms with CNGs (looked like the Middle East), trees out of windows, Chinese-looking buses, blank or misplaced plates, a smooth footpath, shops that looked hand-drawn, old-looking poles | Generic models chosen without Dhaka in mind | Every street object is judged against the Dhaka requirements in section 5 |
| Too much to review at once | Large batches | At most 13 items per review |

## 7. Quality targets on the owner's iPhone 15 Pro

These are proposals. They get fixed in Phase 4 from the phone's real numbers, then measured at every later review.

| Measure | Proposed target |
|---|---|
| Frame rate while racing | A steady 60 frames a second, no visible stutter |
| Over a long race | No slowdown over 10 minutes |
| From start to race ready | Under 10 seconds on home Wi-Fi |
| Download per race | Under 15 MB |
| Picture | The phone's full sharpness, never coarser |
| Brightness | Every route clearly visible, night included |
| UI tests | A full run under 30 minutes; the game's share under 5 |

## 8. Risks

| Risk | How it's handled |
|---|---|
| No free model is good enough for an object | Found in Phase 2, before any game code is written. The owner decides for that object. |
| Claude can't play on an iPhone | Previews send back the phone's numbers. How the game feels is the owner's call, in Phases 6 to 8. |
| Tilt steering may not work inside a preview | Seen at the first ride in Phase 6. If it doesn't work, give the owner a link that opens the ride on its own. |
| Safari draws or plays differently from Chromium | The phone's numbers and the owner's review settle it each time. |
| Frozen 3D pictures differ slightly between test machines | Compare them with a small tolerance. |

## 9. Working with the owner

- The owner tests on an **iPhone 15 Pro** and judges what they see there.
- Show, don't describe. Keep messages short. Say plainly what isn't known or doesn't look right yet.
- Never ask the owner to do work: no exporting, measuring or tracking. Never ask for tokens or passwords in the chat.
- When a host is blocked, list exactly the domains to allow, in plain text, one per line, and only ones that really are blocked.
- Don't suggest buying assets.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and no `Claude-Session:` lines (see AGENTS.md). Never write CI skip keywords. Never merge.

## 10. Environment

- **Sketchfab:**
  - The token is in the environment variable `SF_TOKEN`. Send it as `Authorization: Token $SF_TOKEN` to `https://sketchfab.com/v3/...`. The proxy's own credential for `api.sketchfab.com` doesn't work.
  - `GET /v3/models/<uid>/download` returns links on `sketchfab-prod-media.s3.amazonaws.com`.
  - After about 15 downloads in a row it answers 429. Wait, then retry.
- **Reachable on 28 October:**
  - `sketchfab.com` and `api.sketchfab.com`
  - Poly Haven: `api.polyhaven.com` and `dl.polyhaven.org`
  - Wikimedia: `commons.wikimedia.org` and `upload.wikimedia.org` (image downloads are rate-limited; retry slowly)
  - `kenney.nl`, `raw.githubusercontent.com`, PyPI and npm
- **Blender:** `pip install bpy` in a virtualenv, for converting and cleaning models.
- **Playwright:** the repo pins 1.56.1, which expects Chromium build 1194; the container may have another. If so, link it:
  ```bash
  mkdir -p /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux
  ln -sf /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
  touch /opt/pw-browsers/chromium_headless_shell-1194/INSTALLATION_COMPLETE /opt/pw-browsers/chromium_headless_shell-1194/DEPENDENCIES_VALIDATED
  ```
  For WebGL screenshots in headless Chromium, launch with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- **Previews:**
  - An artifact page can be at most 16 MB.
  - Each file published with it can be at most 16 MB, or 15 MB for a binary. Fetch these with relative URLs.
  - three.js loads from cdnjs or jsDelivr at a pinned version.

## Where the work is

- **Phase:** 1, set-up.
  - **Done:** PR #103 closed, the `king-of-streets` branch, this plan.
  - **Next:** phone measurements in previews, then Phase 2, round 1 (the five bikes).
- **Waiting on the owner:** nothing.
