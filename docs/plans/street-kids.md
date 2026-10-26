# Street Kids: handoff

The plan for the Street Kids game, and everything the owner has asked for and decided so far. A new session picks the work up from here: **read all of it before doing anything**, then read [AGENTS.md](../../AGENTS.md). The branch is `street-kids`.

## What the owner asked for

In the owner's words, then what that has come to mean.

1. **The game.** "A new game called Street Kids, or রাস্তার পোলাপান in Bengali. It's a motorcycle racing game where racers can punch, kick, use nunchucks or other things on their opponents. It would be inspired by the Road Rash game. I want better graphics but the similar game play."
2. **Realistic graphics.** "I don't like the graphics, it's too unrealistic." "Show me screenshots of more realistic graphics with realistic motorcycles and riders." "Change this childlike graphics." "The other cars are horrible and not real. The bikes look weird from the side and not real at all." "It's far from being realistic… not this weird alien shit."
   - The bar is **real-looking**: real motorcycles, real riders, real cars and traffic. Flat 2D drawings, shapes built in code, and stylised, cartoon or low-poly models have all been rejected.
3. **Full screen.** "The game needs to run in 100% full screen wherever it gets played." On a computer and on a phone, the game fills the whole screen.
4. **Approval first.** "Stop writing tests for something that won't be approved. First get the graphics approved and then write the full code and tests."
   - Show screenshots and get an explicit yes on the look **before** writing game code or tests.
5. **No accounts or payments for assets** beyond what the owner has set up. "If I have to buy those things why on earth am I paying Anthropic for? Figure out how to make realistic models without any account or extra payments." The owner has since given a free Sketchfab account's API token as a network secret (see [Environment](#environment)). Don't suggest buying assets.
6. **Riders (second session):** "Don't show rider faces. They should be wearing helmets and motorcycle gear. There should be a choice of 6 characters in total. 3 male and 3 female."
   - Every rider wears a full-face helmet with a dark visor; no face or hair shows. They wear riding suits, gloves and boots, not street clothes.
   - The player picks one of six characters, three men and three women.
   - "Use regular clothes for the riders instead of the suits so it's easier to show differences. But do keep the helmets." (fourth round; this replaces the riding suits)
   - "Nope side view of blue helmet guy is weird between Tshirt and pants. The clothes are shit." (fifth round: the scans' office clothes and the gap where a scanned T-shirt meets jeans in a riding lean are rejected)
   - "The finishing on the characters is bad and not smooth at all. And helmets don't have pony tails out. It looks weird." (sixth round: no ponytails; smoother characters)
   - "Male and female differences are not obvious. The blue rider looks hunched back." Women and men must be told apart at a glance, in gear, from the game's camera; every rider sits with a straight back.
7. **Ask for site access when needed.** "Sites being locked isn't an issue. Tell me what you need." When a host is refused, say exactly which domain to allow, in plain text, one per line, and only domains that are actually blocked ("Don't give me things where you already have access to").

### How to work with the owner

- Be direct and honest about what will and won't look real. Don't oversell a result.
- Show, don't describe: screenshots at desktop and phone size.
- Keep messages short. Lists of domains or links go in plain text, one per line.
- Never ask for a token or password in the chat; secrets go in the environment's settings.

## Gameplay (agreed, and built in `street-core.js`)

Road Rash-style racing and fighting, tuned in `apps/street-kids/street-core.js`, which has 20 passing unit tests (`test/logic.test.mjs`). Keep these rules unless the owner changes them; only the drawing is being replaced.

- **A race:** you and six rivals (Kalu, Bablu, Mintu, Rocky, Tinku, Pinky) on a city road with bends and hills, you starting last on the grid after a 3, 2, 1, Go! countdown. The first race is 2.4 km, and each one after is 300 m longer, up to 4 km. The bike speeds up on its own to 216 km/h; you steer, brake and fight. The kerb slows you to 79 km/h, and its lamp posts, palms and trees throw you off.
- **Traffic:** rickshaws, CNG auto-rickshaws, painted trucks, buses and cars drive along in lanes. Riding into the back of one is a crash.
- **Fighting:** punch (quick, short reach), kick (longer reach, harder, shoves the rival across the road), and weapons. Some rivals carry a **stick, chain or nunchaku**; knock them off their bike and you take it, and from then on a punch swings it. A crash drops it. Rivals fight back. A rival in reach shows their name and health.
- **Health:** rivals' blows and crashes (20 each) take it away; at zero you're knocked out and the game is over.
- **Scoring:** 100 points for each rival knocked off; 1000, 600 and 300 for finishing first, second and third, times the race's number. Finish in the top three to go on to the next race, with full health; finish fourth or lower and the game ends.
- **Controls:**
  - Keyboard: ← → (or A / D) steer, ↓ (or S) brake, X (or J) punch, Z (or K) kick, P / Esc pause.
  - Touch: drag sideways to steer, tap to punch, flick up to kick, flick down to brake, tap the score to pause.
- **Saving:** a race in progress survives a reload and comes back paused (`bdnix_streetkids_save`); a race just won saves as the start of the next. The best score is kept in `bdnix_streetkids_best`.
- **Credit line:** "Inspired by Road Rash, created by Electronic Arts in 1991. Road Rash is a trademark of its owner; bdnix isn't affiliated with or endorsed by them." "Road Rash" appears nowhere else: `tests/ui/checks.mjs` and `tools/boundaries.mjs` now check that.

## Graphics: what was tried and rejected

Don't repeat these.

1. **2D canvas, flat vector shapes** (`apps/street-kids/street.js`, still on the branch): a synthwave dusk city, a pseudo-3D road and cartoon riders. Rejected as "childlike" and "too unrealistic". It is to be **replaced**.
2. **three.js scene with bikes, riders and vehicles built from primitives** (spheres, boxes, capsules). Rejected: "other cars are horrible", "bikes look weird from the side". The lighting and buildings were the best part.
3. **A sport bike modelled in Blender from code** to Yamaha R15 V4 measurements (1990 mm long, 1325 mm wheelbase, 815 mm seat, 17" wheels): panelled fairing, split-spoke wheels, drilled discs, chain and sprockets, rendered in Cycles. Rejected as still not realistic.
4. **A rider from MakeHuman's CC0 body**, rigged and posed in a racing crouch, with a painted suit and a modelled helmet. Rejected: "weird alien".

The lesson: realism needs **models made by 3D artists** and **real photo textures and lighting**. Code-built geometry, however careful, doesn't get there.

## The plan now

1. **Check the environment** (below): the Sketchfab network secret and `media.sketchfab.com`. Download one model and confirm it works. If a download comes from a host that's still refused, ask for exactly that domain.
2. **Get realistic models from Sketchfab** (free account, CC Attribution licence or CC0 only). Shortlist so far; check each model's page before using it, and look for better ones:
   - Suzuki GSX-R 750, `3e05cd872ef0458ca3d6b0770bb03622` (27k faces, CC BY)
   - Honda NR750 1994, `89a79e0a3c334b23830561961f9644c8` (52k, CC BY, made for the bike simulator "Ride")
   - Kawasaki Z1000 2014, `70cecfa5568347428c5ad72e9a156be9` (36k, CC BY, a naked bike)
   - Jo on Bike, rigged and animated rider, `36ee5344e81149858a664cde9f98e835` (48k, CC BY)
   - Quadbike rider, seated riding pose, `550da710f41f40e180066c58c2e7e5a7` (45k, CC BY)
   - CNG, a Bangladeshi auto-rickshaw, `011baf8efab94b37988e16756951a2b1` (271k, CC BY, needs simplifying)
   - Rickshaw, `8ffe8bae79d645aaaf83e46ce7791e49` (205k, CC BY, needs simplifying)
   - Generic Town Bus, `14fe03d792914d51b6c6250b393c44fd` (55k, CC BY)
   - Toyota Corolla 2014, `36f95efb0585464cae43a25a3b3392e8` (84k, CC BY)
   - Search more: realistic riders in racing leathers (rigged, ideally with riding, punching and kicking animations), sport bikes, Dhaka-style buses, painted trucks, cars, motorbikes, street props and buildings.
   - Avoid models under the **Sketchfab Standard** licence (such as the 2022 Yamaha R1, `9caf5493…`, and "Motorcyclist", `3dcc1ec7…`) and anything NonCommercial or NoDerivs, unless the owner agrees after the terms are checked.
   - **Brands:** real bikes and cars carry the maker's logos. Strip badges and logos and repaint them in the game's own liveries.
   - **Credits:** CC BY needs attribution. Credit each model (title, author, link, licence) in `docs/games.md` and anywhere else the site shows credits.
3. **Environment from Poly Haven (CC0):** photographed skies (499 urban ones, such as `modern_evening_street`, `urban_street_01`–`04`, `highway_bridge_sunset`, `cobblestone_street_night`), asphalt, brick, plaster, concrete and metal textures, street lamps, road barriers, a fire hydrant and trees. It works with no account (`api.polyhaven.com`, files from `dl.polyhaven.org`).
4. **Show the owner screenshots and wait for approval:** a full-screen race on a computer (1280 × 720) and an upright phone (390 × 844), the rider's bike from behind as in the game, rivals alongside, traffic, and a fight (a punch or a weapon swing). Use the real-time renderer the game will use (three.js in the browser), not offline Blender renders, so what's shown is what the game will look like. Say honestly what a phone browser can and can't do.
5. **Only after approval:** build the game on the approved look, keeping `street-core.js`'s rules; then the tests, translations and docs; then the pull request. AGENTS.md's rules all apply (a pull request with green CI, coverage, the modules' boundaries, and so on).

## Look test (second session): awaiting approval

Steps 1 to 4 are done; the owner has been shown six screenshots (a race, a punch and a stick swing, each on a computer at 1280 × 720 and an upright phone at 390 × 844) and asked for a yes. **Don't build the game until they approve.**

- **How it's made:** three.js r170 in the browser, the same renderer the game will use. A photographed sky (Poly Haven `wide_street_01`) lights the scene and is its backdrop; a sun casts shadows; ACES tone mapping. The road is Poly Haven's `asphalt_02` with painted lanes, the pavements `concrete_pavement`. Buildings, palms, lamps, traffic, bikes, riders, helmets and weapons are all Sketchfab models by 3D artists (CC BY).
- **Riders on bikes:** the scanned people are seated by code with two-bone IK (`docs/plans/street-kids-lookdev/rider.js`): hips on the seat, the back leant forward through the pelvis and spine, the head raised to the road, feet on the pegs and hands on the grips. A punch or swing moves one hand to a target. Helmets are fitted to the head bone and weapons to the hand bone. Each bike's seat, grip and peg points are in `common.js`.
- **The prototype** is in `docs/plans/street-kids-lookdev/` (code only, no models): `race.html?shot=race|punch|bat` is the scene, `seat.html` checks one rider on one bike, `view.html` shows one model on a 10 cm grid, and `tools/` has the Sketchfab search, download and thumbnail scripts and the Playwright screenshot script. Serve the scratch folder with `models/`, `ph/` and `work/node_modules/three` beside `view/`, as the import map expects.
- **Models used** (all CC Attribution; credit each in `docs/games.md`):

  | Use | Model | UID | Author |
  |---|---|---|---|
  | Player's bike | Honda NR750 1994 | `89a79e0a3c334b23830561961f9644c8` | comrade1280 |
  | Rival bike | Suzuki GSXR 750 | `3e05cd872ef0458ca3d6b0770bb03622` | kaleemullah550 |
  | Rival bike | Z1000 2014 | `70cecfa5568347428c5ad72e9a156be9` | EmanuelRestrepoVelez |
  | Rider (scanned) | Nathan Animated 003 | `143a2b1ea5eb4385ae90a73657aca3bc` | renderpeople |
  | Rider (scanned) | Manuel Animated 001 | `e65e0fef4e0743868c8d5bff36d61116` | renderpeople |
  | Rider (scanned) | Eric Rigged 001 | `a46bc9f67aaa415bb4f3241eef900e7f` | renderpeople |
  | Rider (leather jacket) | Just man | `e77a26778dc14b3c8f4838fe6a827dc3` | vrimen |
  | Helmet | Motorcycle_helmet | `6c4c23305d8148ef9717799274bdde85` | zakyora |
  | Helmet | T1 HELMET | `dd5bce9ea5ef408e96858fd0e5c93421` | Netovanniy |
  | Stick | Baseball bat | `2669cf86386747449611396c0409db47` | k_dvlt |
  | Nunchaku | Traditional Nunchaku | `7fe52a1072764b25932dcc9b69b38c09` | eltayerkebulan |
  | Car | 2014 Toyota Corolla E180 | `36f95efb0585464cae43a25a3b3392e8` | armoredwave |
  | Car | 2001 Toyota Yaris | `443fd49eb0844557a06854cae0b61267` | Tyler_Dave |
  | Bus | Generic Town Bus | `14fe03d792914d51b6c6250b393c44fd` | own.guest |
  | Truck | Indian Truck | `8c7650b96d6846de8cc54391ab16cf20` | afjalymail78692 |
  | CNG | CNG | `011baf8efab94b37988e16756951a2b1` | asrafullislamsiam |
  | Buildings | LOW POLY - SOVIET APARTMENT BUILDING 8K | `05229ac1d1f94e6c8cacaad91110c602` | Colin.Greenall |
  | Palms | Realistic Palm Tree 2 Free | `d05c8ffb6ec64a7184c4b673e21f7224` | NextSpring |
  | Lamps | Street Lamp | `6881aa1e84b047d79860fa9297e05e22` | bez_glaza |

  Check each model's page for the exact author name and licence again before shipping. Rejected on the way: "City Bus - rigged" (`36646f…`; its skin ignores scaling), the open-face "Street Rider Helmet" (`a2e5ce…`).
- **Fixes the models need before shipping:** strip the makers' badges (Honda, Suzuki, GSX-R, Kawasaki, Toyota, Bell, Tata) or repaint; the NR750's side stand is down; the CNG (271k triangles), truck (208k) and T1 helmet (236k) need simplifying.
- **Page weight:** the downloads total about 220 MB. Simplified (meshoptimizer), with 512–1024 px WebP or KTX2 textures, the set should come to roughly 10–20 MB; load the road, sky and player first and the rest in the background. Not measured yet.
- **What the screenshots don't show:** motion. They're still frames from headless Chromium with a software GPU (SwiftShader), so frame rate on a phone is untested.

### Riders in gear (after the owner's feedback)

The owner asked for no faces, helmets and gear, and six characters (3 male, 3 female). Ready-made realistic riders in gear are almost absent from Sketchfab (the few are cartoon or low-poly), so the riders are the six Renderpeople scans, dressed by code in `docs/plans/street-kids-lookdev/gear.js`:

- **Faces hidden:** vertices weighted to the head (face and hair) are pulled in to 55% around their centre, inside the helmet. Every rider wears the unbranded full-face helmet (`6c4c23…`), its shell in the character's colour and its visor opaque, dark and mirrored. The T1 helmet is dropped: it carries Fox and Alpinestars decals.
- **Gear:** the scan's texture is repainted per body part (found from each vertex's main bone) and per position on the body: a two-tone leather suit (main colour on the chest, upper arms and thighs; trim on the waist, side panels, back hump, forearms and shins; an accent stripe on the chest, arms and legs' outsides), black knee armour, gloves, boots and collar, with darkened seams where panels meet. The photo's folds stay as shading, so the cloth keeps real creases.
- **The six** (`CHARACTERS` in `common.js`): men Nathan (red and black), Manuel (blue and white), Eric (green and black, yellow stripes); women Carla `acf520f450d14dd799f98a6fede3edf5` (yellow and black), Claudia `c659bd0accab47c6bbe390cf822a2b92` (white and red), and the jungle_jim woman (orange and dark grey; see below). All Renderpeople, CC BY. Names aren't decided (the rivals in `street-core.js` are Kalu, Bablu, Mintu, Rocky, Tinku and Pinky).
- **Men and women apart** (third round): women are 1.63–1.66 m and men 1.83–1.84 m; each woman has a ponytail hanging out of the back of her helmet over her shoulders (the tail strands of "Ponytail Hair for Character" by whitewashstudio, `8ddc5c1c6cda49bc80c9f3a675b0a6c4`, CC BY, tinted per rider); women's suits have contoured side panels that trace the waist and hips, men's have a shoulder yoke, a chest stripe and a spine stripe.
- **Third woman:** Sophia's scan has long loose hair over her chest and back, part of the body mesh, which painted as strings on the suit. She's replaced by "Realistic woman walking (animated)" by jungle_jim (`d1ce2b8009b8401481408aeecea903d0`, CC BY), a Character Creator model with separate hair (hidden), converted from spec-gloss to metal-rough (`gltf-transform metalrough`). Its rig has no inverse bind matrices and its UVs use tiles 0–4, both handled.
- **Straight backs:** `seat()` first stands the spine, neck and head straight up from whatever pose the person was scanned in (Manuel was scanned mid-dance, head bowed), then leans them.
- **How the suits are painted** (`gear.js`): body parts come from skin weights, blended per pixel so part edges are smooth; panels are measured in each bone's frame in the skinned rest pose (pose-independent); paint is spread past texture-island edges so the photo's colours don't bleed in at seams. Bone names from all three rigs (Renderpeople, HumanIK, Character Creator) map through `canonical()` in `rider.js`.
- **Everyday clothes** (fourth round, the owner's call): the riders wear the scans' own clothes; the suit painting is off (`paint: false` in `CHARACTERS`; the painter stays in `gear.js`). Helmets stay, and faces stay hidden. The six now: men Nathan (white T-shirt, jeans), Manuel (grey T-shirt, jeans), and "Just man" by vrimen (`e77a26778dc14b3c8f4838fe6a827dc3`, brown leather jacket, its helmet fitted with `{ up: (0, 1, 0.15), lift: 0.06, push: 0 }`, size 0.37); women Carla (black blazer, grey trousers, dark ponytail), Claudia (white blouse, cream trousers, blonde ponytail) and Sophia (white top, jeans, her own long hair down her back). Eric (waistcoat and tie) and the jungle_jim woman are no longer used.
- **Modelled street clothes** (fifth round): the scans are dropped for six artist-made characters whose clothes are separate modelled garments, so nothing tears at the waist when leaning. All CC Attribution, all converted to metal-rough. Men: "Teen age boy chracter" by chs01148 (`638817dc37a54256adc62f25571f91b9`, red hoodie, jeans), "Casual Male 3D Character – T-Pose" by sthaarpit (`e3646e3713a14cb1a149f1b05bc261ce`, black long-sleeve top, grey trousers), "Gregory (Street Outfit)" by VladislavKolesnikov (`52ef2ba29871442ca92450a21c43f317`, printed hoodie, black trousers). Women: "Rigged Female Character: Leather Jacket & Boots" (`05c240d89fb34089ad6491ba9499ad0c`, author's username is a hash; check the page), "Character Teen Black 2k" by samsikua (`058c9393f51648a0861c732d32a90065`, black jacket, shorts, boots), "Casual Female 3D Character with Glasses" by sthaarpit (`8e97d33dc6674691842e1f24335e2c14`, white T-shirt, jeans). Their rigs use Mixamo-style names, now mapped in `canonical()`. Everything above the neck bone near the spine's line (face, chin, hair) is pulled inside the helmet by position. Rejected while searching: GTA V rips (copyrighted game assets).
- **Sixth round:** ponytails removed (the hair model and `ponytail()` stay in `gear.js`, unused). Gregory (13k triangles, faceted sleeves) replaced by "Casual Male 3D Character – T-Pose" by sthaarpit (`61c5547e918f4e9797b59184a4062858`, CC BY), his red polo dyed navy (`top` in `CHARACTERS`, `recolor()` in `gear.js`) so he doesn't match the red hoodie. `smoothNormals()` in `common.js` averages normals across UV-seam splits, so garment seams don't show as hard lines. Screenshots are now taken at real screen density (`DPR=2` for 1280 × 720, `DPR=3` for 390 × 844 in `tools/shot.mjs`); the 1× shots before this looked more jagged than the game will. Still visible: some creasing where clothes bend sharply (armpits, the chest of the leather jacket), which comes from posing a standing character's skin into a crouch.
- `lineup.html` shows all six on bikes (`?view=back`, `side`, `cfront`, `cback`). Shown to the owner with the race and punch frames; awaiting approval.
- Known flaws: the hands' fingers are open rather than curled round the grips; the suits have no real armour shapes (they're painted on the scans' bodies); the Z1000 sits its riders upright.

## Things the full-screen look must reconcile with AGENTS.md

AGENTS.md has rules every game follows. A full-screen 3D game changes how some of them are met; decide how, and tell the owner, when building:

- **The top bar and score panel:** every game has the language switch, the mute button (`#soundBtn`) and a `.stats` score you tap to pause. In full screen they become small overlays on the game.
- **Played upright on a phone** (`upright` module): it covers a phone turned sideways. Keep it, unless the owner wants landscape on phones. Ask.
- **No pause button; P / Esc, blur and leaving the page pause.**
- **Touch controls with no buttons under the board**, shown with the `gestures` component.
- **Saves, sounds, the credit line, translations** (English and Bangla, the owner reviews them) and tests, as for every game.
- **A big library** (three.js, and any loaders) is **vendored in the module** with its licence and fetched on first need. The models and textures are vendored too. Nothing loads from a CDN or any site but bdnix.com.
- **Page weight:** keep the models light enough for a phone browser. Simplify heavy meshes, compress textures, and load assets progressively.

## What's on the branch

- `apps/street-kids/`: `module.json` (title, description, card, icon), `index.html`, `street-core.js` (the rules, keep), `street.js` (the rejected 2D drawing, to be replaced), `street.css`, `lang/bn.json` (Bangla, not yet reviewed by the owner), and `test/` (logic, behaviour, page and i18n targets, all passing against the 2D version).
- The site-wide changes: the landing page's card list and description (and its Bangla), `tests/unit/parts.test.mjs`, the trademark checks, README, `docs/games.md`, `docs/privacy.md`, `docs/development.md` and AGENTS.md.
- No pull request yet. Open one only once the owner approves the graphics and the game is built and tested.

## Environment

- **Sketchfab:** the proxy's injected credential for `api.sketchfab.com` is rejected ("Authentication credentials were not provided"), and it replaces any `Authorization` header sent to that host. What works: the token is in the environment variable **`SF_TOKEN`**, sent as `Authorization: Token $SF_TOKEN` to **`https://sketchfab.com/v3/...`** (the same API on the main host). `GET /v3/models/<uid>/download` returns links on `sketchfab-prod-media.s3.amazonaws.com`, which downloads fine. The download endpoint rate-limits (HTTP 429) after about 15 downloads in a row; wait and retry. `docs/plans/street-kids-lookdev/tools/sf.py` wraps this. `cdn.polyhaven.com` (thumbnails) is refused; it isn't needed.
- **Reachable:** `sketchfab.com`, `api.sketchfab.com`, `api.polyhaven.com`, `dl.polyhaven.org`, `kenney.nl`, `raw.githubusercontent.com`, PyPI and npm.
- **Refused before the owner's latest changes:** `github.com`, `codeload.github.com`, `api.github.com`, `quaternius.com`, `opengameart.org`, `www.cgtrader.com`, `poly.pizza`, `ambientcg.com`, `blendswap.com`, `free3d.com`, `turbosquid.com` and `static.makehumancommunity.org`.
- **Blender** installs as a Python module: `pip install bpy` (5.2.x, for Python 3.13) in a virtualenv. Rendering uses Cycles on the CPU. It's good for converting, simplifying and cleaning up downloaded models, and for exporting `.glb`.
- **Playwright:** the repo pins `@playwright/test` 1.56.1, which expects Chromium build 1194, but the container has build 1243 and can't download another. Point the old path at the installed one before running UI tests:
  ```bash
  mkdir -p /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux
  ln -sf /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
  touch /opt/pw-browsers/chromium_headless_shell-1194/INSTALLATION_COMPLETE /opt/pw-browsers/chromium_headless_shell-1194/DEPENDENCIES_VALIDATED
  ```
  For WebGL screenshots in headless Chromium, launch with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.

## Questions still open with the owner

- **Approve the look?** (asked again with the six riders in gear)
- Names for the six characters, and whether the race's rivals are the five the player didn't pick (the rules have six rivals).

- Do they want to review the Bangla translations before they ship, or after?
- Phones turned sideways: keep the "turn your phone upright" note, as every other game does, or allow landscape for this one?
- Branded models: are real makes (Suzuki, Honda, Toyota) acceptable once their badges are removed?
