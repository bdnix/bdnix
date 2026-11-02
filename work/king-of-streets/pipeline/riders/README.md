# Round 2 rider fitting (work in progress, nothing approved)

Scripts written on 2 November 2026 while proving one fit (Claudia on A3). They still use the scratch paths they were run from (`/tmp/claude-0/work/...`: the decompressed bikes from `../plain.mjs`, the downloaded rider, `bpy` in a virtualenv). Rewrite the paths before reusing.

- `gripray.py <bike> x+|x-`: ray-casts the bike's real grip and fits a circle per slice: radius, centre and axis, to 2 mm. A3: radius 19.8 mm, centre (+-0.355, 1.021, 0.322), axis (+-0.895, -0.01, -0.445).
- `seatmap.py <bike>`: the seat's top surface height on a grid.
- `fit.py <bike> out.glb`: poses a rider by aiming bones (not IK; the importer's bone tails are unusable): pelvis on the seat, torso lean, two-bone arms, feet on the pegs, then every finger phalanx placed on a circle round the grip axis so bone lengths are kept. Settings come from the environment: `LEAN`, `SEATZ`, `SEATY`, `KN` (knuckle height above the grip), `TAN` (palm tilt), `PHI0` (turn about the grip axis), `HS` (hand scale). It prints `METRIC` lines.
- `measure.py <glb>`: depth of the hand inside each grip, how many vertices are more than 2 mm inside, and the arc of the grip the hand touches.
- `collide.py <glb>`: rider vertices inside the bike (nearest-surface test; it is confused by thin parts, so treat its depths as a pointer, not a verdict).
- `views.mjs`, `cand.mjs`: draw a GLB with `preview/stage.js` from chosen cameras.
- `thick.py`, `handlen.py`: finger thickness and hand length of the rider.

What the first proof showed (A3 + Claudia, Renderpeople): with hand scale 1.15, knuckle height 24 mm and palm tilt 0, the hands are at most 1.1 mm inside the grip, nothing is more than 2 mm inside, and the hands touch 315 degrees of the grip, checked from the top, front, underneath and along the axis.
Not done: the thumb, the seat and thigh clearance (the seat is only about 20 cm wide and the thighs still read as sinking in), feet on the pegs (measured nowhere yet; the woman's shoes are heels), the other four bikes, the man, the helmet, the stand.
