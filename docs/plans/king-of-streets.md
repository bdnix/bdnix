# King of Streets: production plan

The plan for building King of Streets (রাস্তার রাজা) from scratch. The owner approved it on 28 October 2026. **A new session starts here: read all of this file, then [AGENTS.md](../../AGENTS.md), then carry on from [Where the work is](#where-the-work-is).**

**Nothing is approved yet, and nothing from the first attempt is kept.** That attempt (the `street-kids` branch, PR #103, closed) failed. Don't read, copy or reuse its code, models, pictures or tools. Every object, screen and setting is found, made and approved afresh. The only things that carry over are the owner's requirements and feedback ([section 5](#5-the-owners-decisions)) and the lessons ([section 6](#6-lessons-from-the-first-attempt)).

The same plan, laid out for reading on a phone: <https://claude.ai/artifact/RUArrWhgtEgsnZXeuiN1R3>. This file is the one that's kept up to date.

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

- **Nothing on the site until the end.** Nothing reaches `master` or bdnix.com until the owner approves the finished game (Phase 9). There's no pull request before Phase 10, and the owner merges it.
- **Work on the `king-of-streets` branch**, made from `master` on 28 October 2026.
- **Every review is short.**
  - A review has at most 13 items, each with its own ID, all on one page of pictures, clips or playable previews, sent as one link in the chat.
  - The owner replies in the chat: "approved", or the IDs that need work and why.
  - Everything in the game is approved as an item somewhere in this plan: every object, sound, movement, screen and name.
- **Approve what ships.** Every object is shown as the exact file the game will load, drawn with the game's own 3D engine and settings, at iPhone size. Never show a more detailed version than the game will use.
- **Phone-ready before it's shown.** Before round 1, set a budget for each kind of object (triangles, texture size, file size), worked out from the [targets](#7-quality-targets-on-the-owners-iphone-15-pro). Every object is made within its budget before it's reviewed, so it never has to be simplified after approval.
- **Approved means frozen.**
  - Record each approved file and its SHA-256 in [the register](#3-every-object-in-the-game).
  - A check before every review stops anything whose approved file has changed, until the owner has seen and approved the change.
  - In Phase 10 that check becomes a test in the repository.
- **The owner's feedback is kept.** Every point the owner raises is logged under its item's ID, and every later review is checked against all of them.
- **Check before the owner does.** Check every review at iPhone 15 Pro size (393 × 852 upright, 852 × 393 sideways) against the owner's requirements and every past point of feedback. Never send something with a known problem.
- **One phase at a time.** Nothing in a phase starts until the owner has approved everything it builds on.
- **Never ask about anything in [section 5](#5-the-owners-decisions).** Build to it.

## 2. The phases

Each phase builds only on what's already approved, and each thing is approved once, in the phase where it can first be judged properly.

| # | Phase | Builds on | The owner reviews |
|---|---|---|---|
| 1 | Objects | Section 5 | 66 objects in 7 rounds |
| 2 | Names | 1 | Names for 2 riders, 6 rivals, 5 bikes |
| 3 | Routes | 1 | 5 routes, each with its light, traffic and people, measured on the phone |
| 4 | Screens | 1, 2, 3 | Mock-ups of every screen, including the race HUD |
| 5 | Riding | 3, 4 | How riding feels, with its sounds |
| 6 | Fighting | 5 | How fighting feels, with its sounds |
| 7 | First full race | 4, 6 | Route 1 from start screen to results |
| 8 | Whole game | 7 | Routes 2 to 5, garage, race select, career, quick race |
| 9 | Final play-through | 8 | The finished game; after this, fixes only |
| 10 | Release | 9 | The owner merges; then the live page is checked |

### Phase 1: Objects

Each of the 66 objects in [section 3](#3-every-object-in-the-game) goes through the same steps:

1. Find a source afresh: free models only (CC0 or CC BY), credited.
2. Make it game-ready within its budget, with makers' logos removed.
3. Draw it with the game's engine, in plain daylight.
4. Check it against its requirements.
5. The owner approves it.
6. Freeze it.

Objects are shown in plain daylight; night and each time of day are judged with the routes in Phase 3. If no free model is good enough for an object, say so on that item. The owner decides whether to use the best there is, cut it, or stop.

| Round | Items | What |
|---|---|---|
| 1 | 5 | Bikes (A) |
| 2 | 13 | The player's two riders and the helmet (B), and each rider on every bike (C) |
| 3 | 9 | Rivals (D) and weapons (E) |
| 4 | 8 | Traffic (F) |
| 5 | 8 | People on the footpaths (G) |
| 6 | 12 | Street, H1 to H12 |
| 7 | 11 | Street, H13 to H23 |

Done when all 66 are approved. A rider on a bike is approved only with fingers closed round the grips, feet on the pegs and the stand up.

#### Phone budgets

Set on 28 October 2026, before round 1, from the [targets](#7-quality-targets-on-the-owners-iphone-15-pro) (under 15 MB a race, 60 frames a second). Every object is made within its budget before it's shown, and the file shown is the file that ships: a GLB with meshopt-compressed geometry and WebP textures. They're proposals like the targets, and are fixed in Phase 3 from the first route's real numbers. Bikes went from 30,000 to 45,000 triangles on 29 October, before anything was approved, so large body panels are never thinned (see the round 1 feedback under A). Revised on 28 October, before anything was approved: the first draft counted materials, and the best free bikes use up to 16, so the budget now counts parts drawn (draw calls), which is what costs the phone; textures are capped at 1024 px because the bikes were well under the file budget at that size.

| Kind | Triangles | Parts drawn (meshes × materials) | Textures | GLB size |
|---|---|---|---|---|
| Bike (A) | 45,000 | 30 | 1024 px at most | 1.5 MB |
| Rider (B, D), without the bike | 20,000 | 6 | 2048 px at most, 1 map | 0.5 MB |
| Weapon (E) | 3,000 | 2 | 512 px | 0.1 MB |
| Car, CNG, cycle rickshaw (F) | 20,000 | 16 | 2048 px at most | 0.8 MB |
| Bus, truck (F) | 30,000 | 20 | 2048 px at most | 1 MB |
| CNG driver, pedestrian (F2, G) | 8,000 | 4 | 1024 px at most | 0.3 MB |
| Street object (H) | 5,000, or 20,000 for a mosque or a flyover section | 8 | 1024 px at most, shared by its kind | 0.3 MB, or 0.6 MB for a mosque or a flyover section |

Per race: about 1.2 million triangles on screen and 250 draw calls at most (repeated objects drawn as instances), 15 MB to download in all. The 15 MB is the sum of one route's own set: the player's bike and the level's bike (1.5 MB each), the player's rider and up to six rivals (0.5 MB each), the weapons, the traffic kinds that route has, its people, its street objects and its sounds (1 MB). A route that has fewer kinds of traffic loads less.

The game's pictures and models live in `work/king-of-streets/` on this branch until Phase 10 moves them into the game's module, so approved files survive between sessions.

### Phase 2: Names

Once the owner has seen every character, propose names in Bangla and English, each with its meaning, in the style the owner picks. Show one page: each character's picture with its proposed name and alternatives.

| ID | Name for |
|---|---|
| N1–N2 | The player's two riders |
| N3–N8 | The six rivals |
| N9–N13 | The five bikes (made-up names, since makers' names are off) |

Style ideas already shown to the owner (28 October), none chosen yet:

- Dhaka street nicknames: Toofan, Bijli, Shikari, Bagha, Agun, Daku.
- A boss for each route: Nawab, Kuasha, Jheel Rani, Ulka, Rocket, and Raja (the reigning King).
- English rider tags: Nitro, Viper, Ghost, Razor, Venom, Blaze.

The owner rejected the old rival names (Kalu, Bablu, Mintu, Rocky, Tinku, Pinky) as uncreative; don't use them. Done when all 13 are approved. The names are then fixed for the HUD, screens, saves and Bangla.

### Phase 3: Routes

1. Propose the five routes: which Dhaka roads, at which time of day, for which level.
   - The easier levels run after midnight or early morning, with little traffic. The hardest run in the morning or evening rush hour.
   - Between them, the routes include a flyover, the elevated expressway and Hatirjheel.
2. Build them, one per review, from approved objects only. Each review is a ride along the route with no game on top.
3. This phase also makes previews send the phone's frame rate, worst frames and load time back to Claude in the background (the artifact's `db` capability), so the owner never reports them.

Each route's review covers:

| ID | Item |
|---|---|
| RT*n*.1 | Layout: streets, shops, mosques, and the flyover, expressway or lake |
| RT*n*.2 | Light and sky at its time of day, bright enough to see clearly, with street lamps lit at night |
| RT*n*.3 | Traffic: how much, and what kinds, for the time of day |
| RT*n*.4 | People on the footpaths |
| RT*n*.5 | On the phone: frame rate, load time and sharpness |

Done when all five are approved. The [targets](#7-quality-targets-on-the-owners-iphone-15-pro) are fixed from the first route's real numbers, then measured at every later review.

### Phase 4: Screens

Mock-ups at iPhone size, upright and sideways, made from approved pictures, names and routes:

| ID | Screen |
|---|---|
| SC1 | Start screen |
| SC2 | Garage: large pictures of the bikes and the player's rider, and nothing else. No races, no unexplained numbers. |
| SC3 | Race select, its own screen: each route as a picture, described in plain words |
| SC4 | Quick race |
| SC5 | Race HUD, upright: place, distance to go, speed, health, the rival in reach (name and health), the weapon held, and the Punch, Kick and Brake buttons |
| SC6 | Race HUD, sideways: as SC5 |
| SC7 | Switching between the chase camera and the rider's view |
| SC8 | Pause |
| SC9 | Results |
| SC10 | Settings, including the choice of drag or tilt steering |
| SC11 | Loading |

Done when every screen is approved. Each is then built exactly as approved.

### Phase 5: Riding

On route 1, with the approved HUD, and no rivals or traffic. A playable preview with two or three versions to switch between (for example, camera distance or how sharply it steers).

| ID | Item |
|---|---|
| RI1 | Speed and acceleration |
| RI2 | Leaning into turns, the rider's body and hands staying with the bike |
| RI3 | Braking |
| RI4 | Steering by drag |
| RI5 | Steering by tilt (if it doesn't work inside a preview, give a link that opens the ride on its own) |
| RI6 | Chase camera |
| RI7 | Rider's view, with hands and dashboard |
| RI8–RI12 | Each bike's engine sound: recorded, following the revs, gear changes and idle |
| RI13 | Wind and tyre sounds |

Done when all 13 are approved. The chosen version's settings are then frozen.

### Phase 6: Fighting

On route 1, with rivals and a few CNGs:

| ID | Item |
|---|---|
| FI1 | Seeing when a rival is in reach, and timing that's easy to hit |
| FI2 | Punch: the movement, how it lands, its sound |
| FI3 | Kick: the movement, how it lands, its sound |
| FI4 | Weapon swing: the movement, how it lands, its sound |
| FI5 | A miss, and its sound |
| FI6 | Taking a hit: a short pause, the rider reeling, the bike wobbling |
| FI7 | Knocked off the bike, and the fall's sound |
| FI8 | Taking a weapon from a rival you knock off |
| FI9 | Rivals fighting back |
| FI10 | Kicking a CNG aside: its driver gets out. Cars, buses and trucks can't be moved. |
| FI11 | A rival's bike passing, and its sound |
| FI12 | A first-race tip on how to fight |

Done when all 12 are approved on the phone.

### Phase 7: First full race

Route 1, complete:

| ID | Item |
|---|---|
| RA1 | Start screen, loading and countdown, as approved |
| RA2 | The race with rivals, traffic and people |
| RA3 | Crashing into traffic or a pole: the movement and its sound |
| RA4 | The HUD during the race |
| RA5 | Finish and results |
| RA6 | Pause and resume, including pausing when the phone is put away |
| RA7 | Leaving mid-race and coming back to it paused |
| RA8 | Street hum for the time of day, with CNG two-strokes and bus and truck diesels |
| RA9 | Horns: constant at rush hour, rare at night |
| RA10 | Sounds for the countdown, the start, the finish and a new best |
| RA11 | On the phone: the targets met over a whole race |

Done when all 11 are approved.

### Phase 8: Whole game

- Routes 2 to 5 as races, one per review, each reviewed like Phase 7.
- Then one review of everything else:
  - the garage, race select, quick race and settings, built to the Phase 4 mock-ups;
  - the career: points, buying bikes (about 15 good races to the top bike), unlocking routes, and rivals on bikes that match each level;
  - Bangla throughout.

### Phase 9: Final play-through

- The owner plays the career from the first race to the top bike.
- The preview has a shortcut to start at any level, so nothing has to be replayed to check it. The shortcut is removed before release.
- Content is frozen: only what the owner reports gets fixed, until nothing is left.

Done when the owner approves the finished game. This is the last approval.

### Phase 10: Release

- The repository's tests for everything approved, including the frozen files and pictures.
- Docs and credits.
- A full UI test run under 30 minutes, with the game's own specs taking under 5 of those minutes. A full run of `master`'s UI tests took 22 min 56 s on 26 October 2026.
- The pull request, with green CI. The owner merges it.
- Check that the live page at bdnix.com/king-of-streets matches the approved game.
- The owner reviews the Bangla after release.

## 3. Every object in the game

The register for Phase 1. Fill in each item's source, status, approval date, file and SHA-256 as the work goes. Every item starts as **to review**.

Statuses:

- **to review**
- **needs work**, with the owner's note
- **approved**, with the date and the file's SHA-256

### A. Bikes (round 1)

Shown from the side, three-quarter and rear views, close up and at race distance, with makers' logos removed.

| ID | Object | Requirements | Status |
|---|---|---|---|
| A1 | Level 1: scooter | The weakest bike; the player starts on it | to review (round 1 sent 28 Oct) |
| A2 | Level 2: 125 cc commuter | Side stand up when ridden | to review. Flag: a trail-style bike, engine size not stated by the source |
| A3 | Level 3: 135 cc street bike | | to review |
| A4 | Level 4: 600 cc sport bike | | to review. Flag: the source is a 750 |
| A5 | Level 5: hyper bike | The best bike | to review |

Round 1 files, in `work/king-of-streets/models/bikes/` (source, author and licence in [credits](../../work/king-of-streets/credits.md); how each was made in [the pipeline](../../work/king-of-streets/README.md)):

| ID | Source model | File | Triangles | SHA-256 (not frozen until approved) |
|---|---|---|---|---|
| A1 | Retro Vespa Scooter, annaandrei | `A1.glb` | 44,998 | `0033e4dd36e83c0ea8b4bbd4a5110fb5dae30f3c1abd40f707a2e1cbe2d2b791` |
| A2 | Honda NXR Bros 2003, andersonfo | `A2.glb` | 43,769 | `36441730f077cb637e14c76338c050c86a598dd4d9f9f158b409e4725129eca2` |
| A3 | pulsar 135 ls, EmanuelRestrepoVelez | `A3.glb` | 21,630 | `390b403f201947f49c05a5a224015429a7d2fe52fc4a1bfee9d1054c790896d8` |
| A4 | Suzuki GSXR 750, kaleemullah550 | `A4.glb` | 27,023 | `c97d58124915b56ae39587a6511c6c8a3de347dcc7430b73994a1fda12a67d37` |
| A5 | kawasaki ninja h2r, amogusstrikesback2 | `A5.glb` | 34,913 | `432badf4ba43561cb823e7ad5b1f67aead8326b5a59ad02209312588e95b5468` |

#### Round 1 feedback (28 and 29 October): rejected twice

| ID | The owner's points | Cause and fix |
|---|---|---|
| A1 (try 1) | The finish on the side where the blue and white parts meet is bad and not acceptable. | Texture cut to 1024 px and the body thinned hard, so edges and the stripe smeared. |
| A1 (try 2) | "A1 still has the same bad finish with crooked border between white and blue." Rejected again; the owner won't check anything until it's right. | Try 2 only raised the texture size and never touched the cause. The blue and white panels are separate meshes meeting along a seam; thinning every piece made the two sides stop lining up. Fix (try 3): pieces larger than 0.30 m keep every triangle, only small hidden pieces are thinned (`squeeze_dim` in `pipeline/build.py`); body colour 2048 px. Compared with the original model from the same three cameras: under 1% of pixels differ by more than 40 levels. A1 is 45,000 triangles; bike budget raised to match. A2 and A5 (also thinned) rebuilt with no thinning. |
| A2 | What are the huge white bars on the wheel? | The swingarm and the plate behind the sprocket had full-metal materials and mirrored the pale sky. Metalness cut in the maps; the chain no longer turns with the wheel. The swingarm is still a flat box (offered a slimmer one). |
| A3 | Why are chains hanging out? | The white drive chain turned with the wheel and swung loose, with thin rods to the hub. Chain, rods and loose orange cables removed. A short cable stub by the front brake may remain. |
| A1 (try 3) | "I don't care what original models have and have not. If you picked a bad original model, then pick again." | The Vino model itself had the crooked border; no build fix could remove it. Replaced with a different model (Retro Vespa Scooter, annaandrei, CC BY): one colour, so no blue/white border exists. Chosen after looking at about 15 scooter models up close; rejected for a faceted look (Vino 50, Vespa 50 Special lumpy shield and dented wheels, Piaggio SI), photogrammetry (Vespa scans), dirt and labels (Honda Cub), crude panels (OLA, Honda Spacy, Dio) or blurry photo textures (Nmax). The Vespa script (its own material) removed; chrome wheels turn, engine cover stays. |
| A1 to A5 | The border of the wheels doesn't rotate. | Only a loose piece called the tyre turned; the rest of the tyre, rims, discs and sprockets were fused to the body. The build now finds what turns with each wheel by shape (a part that repeats round the axle), and every bike is tested by turning the wheels and drawing the turning parts in red and blue. |

Lessons added: when the owner rejects a model's look, change the model; do not defend or patch it, and do not compare it to its source as proof. Judge candidates by looking at colour borders and panel edges close up before choosing.  turn a bike's wheels before showing it; compare a rebuilt object with its source from the same cameras as a pixel difference, not only by eye, before showing it; never thin geometry that meets another piece along a texture border; check each metal part against the daylight sky; when a fix has not touched the proven cause, say so instead of sending it.

### B. The player's riders (round 2)

Shown standing and seated, from the front, side and back, wearing the helmet.

| ID | Object | Requirements | Status |
|---|---|---|---|
| B1 | Male rider | Everyday clothes, a straight back, no face or hair showing, a smooth finish with no gap where clothes meet | to review |
| B2 | Female rider | As B1. Told apart from B1 at a glance from the game's camera. No ponytail out of the helmet. | to review |
| B3 | Full-face helmet in each rider's colour | Dark visor | to review |

### C. The player's riders on each bike (round 2)

Shown from the side, three-quarter and rear views, with close-ups of each hand and the stand.

| ID | Object | Requirements | Status |
|---|---|---|---|
| C1–C5 | B1 on A1 to A5 | Fingers closed round the grips: none under the grip or off it, and the grip not coming out between fingers. Feet on the pegs. Stand up. | to review |
| C6–C10 | B2 on A1 to A5 | As C1–C5 | to review |

### D. Rivals (round 3)

Each rival on all five bikes, with close-ups of the hands, in their own helmet and clothes colours, never quite matching the player's. They are named in Phase 2.

| ID | Object | Requirements | Status |
|---|---|---|---|
| D1–D6 | Six rivals, men and women | As B and C | to review |

### E. Weapons (round 3)

Shown on their own, and in a rider's hand on a bike.

| ID | Object | Status |
|---|---|---|
| E1 | Stick | to review |
| E2 | Chain | to review |
| E3 | Nunchaku | to review |

### F. Traffic (round 4)

Shown from the front, side and rear, at road distance.

| ID | Object | Requirements | Status |
|---|---|---|---|
| F1 | CNG auto-rickshaw | **No white rectangle on its back.** Only the Bangla number plate there. | to review |
| F2 | CNG driver | The CNG drivers' blue uniform, shirt untucked; seated, or standing near a parked CNG | to review |
| F3 | Sedan | A Bangla plate on the car's own plate area, its lettering filling the plate, nothing showing behind it | to review |
| F4 | Hatchback | As F3 | to review |
| F5 | Local bus | A Dhaka bus, not a Chinese-looking one | to review |
| F6 | Truck | A Bangladeshi painted truck | to review |
| F7 | Second truck | As F6 | to review |
| F8 | Cycle rickshaw | | to review |

### G. People on the footpaths (round 5)

Shown walking, at footpath distance.

| ID | Object | Requirements | Status |
|---|---|---|---|
| G1–G5 | Five men | Mostly darker skin, as Bangladeshi people are; a natural walk | to review |
| G6–G7 | Two women | As G1–G5 | to review |
| G8 | Another man | As G1–G5 | to review |

If no free rigged model can be found of a woman in a sari or salwar kameez, or of a man in a lungi, say so in round 5. The owner decides whether the footpaths go without them.

### H. Street and city (rounds 6 and 7)

Shown close up, and from the rider's height at race speed.

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
| H14 | Trees | Trees that grow in Dhaka: no date palms, none growing out of buildings | to review |
| H15 | Second kind of tree | As H14 | to review |
| H16 | Neighbourhood mosque | Loads of mosques along every route | to review |
| H17 | Large mosque | As H16 | to review |
| H18 | Mosque compound wall and gate | | to review |
| H19 | Number plates | Bangla, the right size, on the vehicle's own plate area, with the border inside the edge | to review |
| H20 | Start and finish lines | | to review |
| H21 | Flyover: ramps, deck and pillars | | to review |
| H22 | Elevated expressway | | to review |
| H23 | Hatirjheel lake and bridges | | to review |

Total: 66 objects.

## 4. How a review works

| Step | What happens |
|---|---|
| Send | One link in the chat to a single page for that review, published with the Artifact tool. It shows up to 13 items, each with its ID, its pictures, clip or playable preview, and its requirements. |
| Owner replies | In the chat: "approved", or the IDs that need work and what's wrong. |
| Needs work | Fix it. The next link shows only the fixed items, before and after. |
| Approved | Freeze it: record the file, its SHA-256 and the date in this file. |
| Change of mind | The owner can reopen anything. Say what else depends on it before it changes. |
| Records | This file. The owner tracks nothing. |

## 5. The owner's decisions

Build to these, and don't ask about them again. They're the owner's requirements, not approvals of anything made.

| Area | Decision |
|---|---|
| Name | King of Streets / রাস্তার রাজা. The game that inspired it is named only in the credit line on the start screen and in the Credits section of `docs/games.md` (AGENTS.md). |
| Game | Motorbike racing through Dhaka, fighting rivals with punches, kicks and weapons (a stick, a chain, a nunchaku). Riders can kick or shove CNGs off the road, but not bigger vehicles such as cars, buses or trucks. |
| Look | Real-looking: realistic motorcycles, riders, cars and traffic, from artist-made models and photo textures. Rejected so far: flat 2D, shapes built in code, cartoon or low-poly models, and graphics that look like a game from the 2000s. |
| The player's riders | Two: one man, one woman, easy to tell apart. Full-face helmets, no faces, no hair or ponytails out of the helmet, everyday clothes (not riding suits), straight backs, hands closed on the grips. |
| Names | Every character's and bike's name is confirmed in Phase 2. |
| City | Dhaka: no hills, loads of mosques, flyovers and an expressway. Dhaka buses and painted trucks, not Chinese-looking ones. CNGs with no white rectangle on the back. CNG drivers in their uniform, shirts untucked, standing near parked CNGs. Proper Bangla number plates. Shops that look real. Tiled footpaths. Poles and cables as in Dhaka today. Pedestrians mostly darker-skinned, as Bangladeshi people are. No date palms. |
| Bikes and career | Five bikes: level 1 the weakest, level 5 the best. The player starts on a scooter, wins races and earns points to buy better bikes. Prices are 1,500 / 4,000 / 10,000 / 22,500, about 15 good races to the top bike. One-off races on any bike too. |
| Routes | Time is part of each level. The easier levels are early morning or after midnight, with little traffic; the hardest are in the morning or evening rush hour. |
| Views | The chase camera, plus an optional rider's view showing the rider's hands and the bike's dashboard. |
| Controls | On a phone, steer by tilting it or by dragging a thumb, whichever the player picks. On a computer, the keyboard. |
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
| Hands came off the grips in the game, after looking right in stills | The stills used detailed models; the game shipped simplified ones nobody had approved | Every object is made within its phone budget first; the exact file that ships is approved and frozen |
| Fingers kept going wrong: under the grip, looking taped on, the grip coming out between them | Fingers fitted one by one never close like a real hand | Pose the hand as a whole from a real rider's grip, and check close-ups of every rider on every bike |
| A bike was ridden with its stand down | The fix was noted, then lost | Each object's needed fixes go in its register entry, and it isn't shown until they're done |
| Dark, pixelated, slow to load, lagging over time | Built and judged on a desktop, never measured on an iPhone | Phone budgets for every object, and the phone's own numbers at every playable review |
| Didn't feel like a motorbike game | Riding was never tested on its own | Phase 5: riding only, with versions to choose from |
| Fights unclear, fake-looking, hard to time | Built along with everything else | Phase 6: fighting only |
| Poor sound | Sounds never approved one by one | Every sound is its own item in Phases 5 to 7 |
| Garage all text, then poor pictures, with races in it | Screens designed while coding | Phase 4: mock-ups first |
| UI tests took 32 to 45 minutes | Heavy 3D specs with no time budget | A full run under 30 minutes, the game's share under 5 |
| The owner found problems Claude should have caught | Work sent before it was checked at iPhone size | Check before every review |
| Changing everything at once broke things that had been fixed | Every part built in parallel | One phase at a time, earlier work frozen |
| Asking about things already decided | No single record of decisions | Section 5 |
| Saying a 2D version was on the site when it wasn't | Stated without checking | Check facts (git, the live site) before stating them |
| Date palms beside CNGs (it looked like the Middle East), trees out of windows, Chinese-looking buses, blank or misplaced plates, a smooth footpath, shops that looked hand-drawn, old-looking poles | Generic models chosen without Dhaka in mind | Every street object judged against section 5's Dhaka requirements |
| Plans with steps out of order, or the same thing approved twice | Plans not ordered by what depends on what | Each thing approved once, in the phase where it can first be judged |
| Too much to review at once | Large batches | At most 13 items a review |

## 7. Quality targets on the owner's iPhone 15 Pro

These are proposals. They're fixed in Phase 3 from the phone's real numbers, then measured at every later review.

| Measure | Proposed target |
|---|---|
| Frame rate while racing | A steady 60 frames a second, no visible stutter |
| Over a long race | No slowdown over 10 minutes |
| From start to race ready | Under 10 seconds on home Wi-Fi |
| Download per race | Under 15 MB |
| Picture | The phone's full sharpness, never coarser |
| Brightness | Every route clearly visible, night included |
| UI tests | A full run under 30 minutes, with the game's share under 5 |

## 8. Risks

| Risk | How it's handled |
|---|---|
| No free model is good enough for an object | Found in Phase 1, before any game code. The owner decides for that object. |
| An object within its phone budget doesn't look good enough | Found in Phase 1, on the object itself. The budget or the object changes before approval, not after. |
| Claude can't play on an iPhone | Previews send back the phone's numbers. How it feels is the owner's call, from Phase 5. |
| Tilt steering may not work inside a preview | Checked at RI5. If it doesn't work, the owner gets a link that opens the ride on its own. |
| Safari draws or plays differently from Chromium | The phone's numbers and the owner's review settle it each time. |
| Frozen 3D pictures differ slightly between test machines | Compare them with a small tolerance. |

## 9. Working with the owner

- The owner tests on an **iPhone 15 Pro** and judges what they see there.
- Show, don't describe. Keep messages short. Say plainly what isn't known or doesn't look right yet.
- Never ask the owner to do work: no exporting, measuring or tracking. Never ask for tokens or passwords in the chat.
- When a host is blocked, list exactly the domains to allow, in plain text, one per line, and only ones that really are blocked.
- Don't suggest buying assets.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and no `Claude-Session:` lines (AGENTS.md). Never write CI skip keywords. Never merge.

## 10. Environment

- **Sketchfab:**
  - The token is in the environment variable `SF_TOKEN`.
  - Send it as `Authorization: Token $SF_TOKEN` to `https://sketchfab.com/v3/...`. The proxy's own credential for `api.sketchfab.com` doesn't work.
  - `GET /v3/models/<uid>/download` returns links on `sketchfab-prod-media.s3.amazonaws.com`.
  - After about 15 downloads in a row it answers 429. Wait, then retry.
- **Reachable on 28 October:**
  - `sketchfab.com` and `api.sketchfab.com`
  - Poly Haven: `api.polyhaven.com` and `dl.polyhaven.org`
  - Wikimedia: `commons.wikimedia.org` and `upload.wikimedia.org` (image downloads are rate-limited, so retry slowly)
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
  - Each file published with it can be at most 16 MB (15 MB for a binary), fetched with a relative URL.
  - three.js loads from cdnjs or jsDelivr at a pinned version.

## Where the work is

- **Done:** PR #103 closed, the `king-of-streets` branch created, this plan written, the phone budgets set. Round 1 (the five bikes) rejected three times (28 to 29 October). Fourth try published at the same link, with A1 replaced by a new model (Retro Vespa Scooter): <https://claude.ai/artifact/PYX1N4QbxCCNSL91yWGUCs> (first try: <https://claude.ai/artifact/9vjEHVRJ3TTAe9TifuGYaN>).
- **Phase:** 1, Objects, round 1 (A1 to A5), fourth try. A2 to A5 are as sent in the third try. The owner won't check anything until it's right: keep the next message short and plain.
- **Next:** the owner's reply. Rework what needs it, freeze what's approved (record the date here), then round 2 (the two riders and the helmet).
- **Waiting on the owner:** round 1, fourth try: approve, or say what's wrong. Calls to make: A2 is a trail-style bike and A4 is a 750 (plan says 600 cc); A1 is light blue and lightly worn (can be new, or another colour).
- **Working notes for the next session:** tools live in `work/king-of-streets/pipeline/` (`README.md` there); `build.py` is the current build (turning parts found by shape, `xmax` limits how far from the hub a part can be and still turn, large panels never thinned, `drop_emissive` and `img_fmt: AUTO` for models with emissive maps; `cfg12_a1.json` is the A1 build). The review page for a round is built by `reviews/<round>/build_page.py`. jsDelivr isn't reachable from the container, so a local test maps those requests to the same three.js version from npm. Bike files and the sky go up as `.wav` because artifacts serve no `.glb` or `.hdr`.
