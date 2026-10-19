# LAME for the audio converter

The MP3 encoder, `../vendor/lame.wasm`, is [LAME](https://lame.sourceforge.io/) 3.100 compiled to WebAssembly. It's made from:

- LAME's own source, unmodified: `build.mjs` downloads `lame-3.100.tar.gz` from SourceForge and stops unless its SHA-256 checksum is the one written in the script.
- `glue.c`: the few calls `audio-core.js` makes. It sets LAME up for constant-bitrate MP3 at quality 3 with no bit reservoir, so each frame stands alone and pieces encoded apart join up (see `docs/tools.md`).
- `config.h`: what LAME's `configure` would find on WebAssembly.

To make it again (after changing `glue.c`, or for a new LAME version, with its download and checksum in `build.mjs`):

```bash
pip install ziglang==0.17.0     # Zig's C compiler, once; or set ZIG to a zig binary
npm run build:lame
```

The build is reproducible: the same source and Zig version make the same file, byte for byte. Neither the site's build nor CI runs it. Bump `?v=` on `LAME` in `audio.js` whenever the file changes.

LAME is licensed under the LGPL; its licence is in `../vendor/lame.LICENSE.md`.
