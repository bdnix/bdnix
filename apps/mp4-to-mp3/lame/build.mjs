// Builds vendor/lame.wasm, the MP3 encoder: LAME's own source, downloaded
// and checked against its checksum, with glue.c, compiled to WebAssembly
// by Zig's C compiler. `npm run build:lame`; it's only needed to change
// glue.c or upgrade LAME, so neither the site's build nor CI runs it.
// Zig comes from the ZIG environment variable, or else from
// `pip install ziglang==0.17.0`. See README.md.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const VERSION = '3.100';
const SOURCE = `https://downloads.sourceforge.net/project/lame/lame/${VERSION}/lame-${VERSION}.tar.gz`;
const SHA256 = 'ddfe36cab873794038ae2c1210557ad34857a4b6bdc515785d1da9e175b1da1e';
const EXPORTS = ['enc_init', 'enc_left', 'enc_right', 'enc_out', 'enc_encode', 'enc_flush'];

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '../vendor/lame.wasm');

function zig(){
  if (process.env.ZIG) return [process.env.ZIG];
  return ['python3', '-m', 'ziglang'];
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'lame-'));
const tarball = path.join(work, `lame-${VERSION}.tar.gz`);
const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`downloading ${SOURCE}: ${res.status}`);
const bytes = Buffer.from(await res.arrayBuffer());
const sum = crypto.createHash('sha256').update(bytes).digest('hex');
if (sum !== SHA256) throw new Error(`${SOURCE} has checksum ${sum}, not ${SHA256}`);
fs.writeFileSync(tarball, bytes);
execFileSync('tar', ['-xzf', tarball, '-C', work]);

const lame = path.join(work, `lame-${VERSION}`);
const sources = fs.readdirSync(path.join(lame, 'libmp3lame'))
  .filter((f) => f.endsWith('.c') && f !== 'mpglib_interface.c')
  .sort()
  .map((f) => path.join(lame, 'libmp3lame', f));
const [cmd, ...pre] = zig();
execFileSync(cmd, [...pre, 'cc', '-target', 'wasm32-wasi', '-O3', '-w', '-s', '-DHAVE_CONFIG_H',
  '-I', here, '-I', path.join(lame, 'include'), '-I', path.join(lame, 'libmp3lame'),
  '-mexec-model=reactor', `-Wl,--export=${EXPORTS.join(',--export=')}`,
  '-o', out, path.join(here, 'glue.c'), ...sources], { stdio: 'inherit' });
fs.rmSync(work, { recursive: true, force: true });
console.log(`Wrote ${path.relative(process.cwd(), out)} (${fs.statSync(out).size} bytes) from LAME ${VERSION}.`);
