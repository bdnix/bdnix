import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain, fakeStorage } from './load.mjs';

const FILE = 'assets/js/sound.js';

// Just enough Web Audio to see what gets scheduled: every oscillator, noise
// source and gain made, with the changes asked of their values.
function fakeAudio(){
  const made = [];
  const param = () => {
    const p = { events: [] };
    p.setValueAtTime = (v, t) => p.events.push(['set', v, t]);
    p.exponentialRampToValueAtTime = (v, t) => p.events.push(['ramp', v, t]);
    return p;
  };
  const node = (kind, extra) => {
    const n = { kind, connected: [], connect: (to) => n.connected.push(to), start: (t) => { n.started = t; }, stop: (t) => { n.stopped = t; }, ...extra };
    made.push(n);
    return n;
  };
  class AudioContext {
    constructor(){
      this.state = 'suspended';
      this.currentTime = 10;
      this.sampleRate = 8000;
      this.destination = { kind: 'speakers' };
      this.resumed = 0;
      AudioContext.contexts.push(this);
    }
    resume(){ this.state = 'running'; this.resumed++; }
    createOscillator(){ return node('osc', { frequency: param() }); }
    createBufferSource(){ return node('noise'); }
    createGain(){ return node('gain', { gain: param() }); }
    createBuffer(channels, length){
      const data = new Float32Array(length);
      return { channels, length, getChannelData: () => data };
    }
  }
  AudioContext.contexts = [];
  return { AudioContext, made };
}

function setup({ storage = fakeStorage(), audio = fakeAudio(), globals = {} } = {}){
  const w = load(FILE, { localStorage: storage, AudioContext: audio.AudioContext, ...globals });
  return { S: w.bdnixSound, storage, audio };
}

// Storage that throws on every call, as blocked storage does.
const blocked = {
  getItem(){ throw new Error('blocked'); },
  setItem(){ throw new Error('blocked'); },
  removeItem(){ throw new Error('blocked'); }
};

test('every sound is a list of well-formed tones', () => {
  const { S } = setup();
  const waves = ['sine', 'square', 'triangle', 'sawtooth', 'noise'];
  for (const [name, tones] of Object.entries(S.SOUNDS)) {
    assert.ok(tones.length > 0, name);
    for (const n of tones) {
      assert.ok(waves.includes(n.type), name + ' wave');
      assert.ok(n.d > 0 && n.d <= 1.5, name + ' length');
      assert.ok(n.t >= 0 && n.t < 1, name + ' start');
      assert.ok(n.v > 0 && n.v <= 1, name + ' loudness');
      // Exponential slides can't start or end at 0 Hz.
      if (n.type !== 'noise') assert.ok(n.f > 20 && n.to > 20 && n.f < 5000 && n.to < 5000, name + ' pitch');
    }
  }
});

test('the games have the sounds they play', () => {
  const { S } = setup();
  const used = ['start', 'over', 'best', 'level', 'point', 'hit', 'move', 'rotate', 'drop', 'lock', 'hold', 'clear',
    'bigclear', 'chomp', 'chomp2', 'power', 'ghost', 'fruit', 'life', 'die', 'flap', 'hop', 'crash', 'splash', 'fall', 'eat', 'win', 'paddle', 'wall', 'brick'];
  assert.deepEqual(Object.keys(S.SOUNDS).sort(), used.sort());
});

test('playing a sound schedules its tones from now', () => {
  const { S, audio } = setup();
  assert.equal(S.play('point'), true);
  const ctx = audio.AudioContext.contexts[0];
  assert.equal(ctx.state, 'running');                    // a suspended context is woken up
  const oscs = audio.made.filter((n) => n.kind === 'osc');
  assert.deepEqual(oscs.map((o) => o.started), [10, 10.06]);
  assert.deepEqual(oscs.map((o) => o.stopped), [10 + 0.06 + 0.02, 10.06 + 0.14 + 0.02]);
  // Each tone plays through its own gain, which fades it in and out.
  const gains = audio.made.filter((n) => n.kind === 'gain');
  assert.equal(gains.length, 2);
  assert.deepEqual(oscs[0].connected, [gains[0]]);
  assert.deepEqual(gains[0].connected, [ctx.destination]);
  assert.deepEqual(plain(gains[0].gain.events), [['set', 0.0001, 10], ['ramp', 0.05, 10.01], ['ramp', 0.0001, 10.06]]);
  assert.deepEqual(plain(oscs[0].frequency.events), [['set', 988, 10]]);   // a steady note doesn't slide
});

test('a sliding tone ramps its pitch, and noise uses one shared buffer', () => {
  const { S, audio } = setup();
  S.play('drop');
  S.play('hit');
  const osc = audio.made.find((n) => n.kind === 'osc');
  assert.equal(osc.type, 'triangle');
  assert.deepEqual(plain(osc.frequency.events), [['set', 320, 10], ['ramp', 90, 10.1]]);
  const noise = audio.made.filter((n) => n.kind === 'noise');
  assert.equal(noise.length, 2);
  assert.equal(noise[0].buffer, noise[1].buffer);
  assert.equal(noise[0].buffer.length, 8000);            // a second of it
  const samples = noise[0].buffer.getChannelData();
  assert.ok(samples.every((v) => v >= -1 && v <= 1));
  assert.ok(samples.some((v) => v !== samples[0]));
  assert.equal(audio.AudioContext.contexts.length, 1);   // one context for everything
});

test('nothing plays until asked, and unknown sounds do nothing', () => {
  const { S, audio } = setup();
  assert.equal(audio.AudioContext.contexts.length, 0);   // made on first use, after a key or tap
  assert.equal(S.play('nope'), false);
  assert.equal(audio.AudioContext.contexts.length, 0);
});

test('muting stops sounds and is remembered', () => {
  const { S, storage, audio } = setup();
  assert.equal(S.isMuted(), false);                      // sound is on to begin with
  const seen = [];
  S.onChange((m) => seen.push(m));
  assert.equal(S.toggle(), true);
  assert.equal(S.isMuted(), true);
  assert.equal(storage.getItem('bdnix_sound'), 'off');
  assert.equal(S.play('start'), false);
  assert.equal(audio.made.length, 0);
  S.setMuted(false);
  assert.equal(storage.getItem('bdnix_sound'), 'on');
  assert.equal(S.play('start'), true);
  assert.deepEqual(seen, [true, false]);

  // A later visit (or another game) starts muted.
  S.setMuted(true);
  assert.equal(setup({ storage }).S.isMuted(), true);
});

test('works without storage', () => {
  const { S } = setup({ storage: blocked });
  assert.equal(S.isMuted(), false);
  S.setMuted(true);                                      // still mutes for this visit
  assert.equal(S.isMuted(), true);
  assert.equal(S.play('start'), false);
});

test('a browser without Web Audio stays silent without errors', () => {
  const none = { AudioContext: undefined, made: [] };
  assert.equal(setup({ audio: none }).S.play('start'), false);

  // Older Safari only has the prefixed name.
  const audio = fakeAudio();
  const { S } = setup({ audio: none, globals: { webkitAudioContext: audio.AudioContext } });
  assert.equal(S.play('start'), true);
  assert.equal(audio.AudioContext.contexts.length, 1);

  // Audio that fails while playing doesn't break the game.
  const broken = fakeAudio();
  broken.AudioContext.prototype.createOscillator = () => { throw new Error('no audio device'); };
  assert.equal(setup({ audio: broken }).S.play('start'), false);
});
