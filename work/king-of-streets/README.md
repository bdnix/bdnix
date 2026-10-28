# King of Streets: work files

Models, preview and pipeline for [the plan](../../docs/plans/king-of-streets.md). Nothing here is on the site until Phase 10, when it moves into the game's module.

- `models/`: the files the game will load (GLB, meshopt geometry, WebP textures). Approved files are frozen; their SHA-256 is in the plan's register.
- `preview/stage.js`: the draw settings (renderer, tone mapping, sky, sun, shadows, camera views). Reviews and the game use the same ones. `daylight.hdr` is the sky.
- `reviews/<round>/`: the review page's source. `build_page.py` writes `index.html`; `img/` holds the stills drawn from the shipped files.
- `pipeline/`: how a source model becomes a game file. The `cfg_*.json` files hold the settings used, with the scratch paths they were run from.
  1. `sf.py` and `dl.py` search Sketchfab and download a model (token in `SF_TOKEN`, sent to `sketchfab.com`).
  2. `edits/<id>.py` removes logos from the textures (`edits/common.py` has the tools).
  3. `build.py` (Blender, `pip install bpy`) turns the model to face +Z, scales it to real size, splits the wheels into `wheel_f` and `wheel_r` parts, deletes logo-only decals, reduces triangles and exports a GLB.
  4. `opt.mjs` (`@gltf-transform`, `meshoptimizer`, `sharp`) compresses it.
  5. `render.mjs` draws stills in headless Chromium with SwiftShader.
