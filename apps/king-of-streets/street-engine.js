// King of Streets: the engines and the street, played with the Web Audio
// API (no sound files). The player's engine follows the revs, in its own
// bike's voice; the rivals' are heard as they pass, nearer louder, panned
// to their side and higher as they close in; and around it all the street:
// the hum of traffic, CNGs' two-stroke rattle, buses' and trucks' diesels
// and Dhaka's horns, busier at rush hour, quiet after midnight. Muted with
// everything else (the mute button, M). bdnixStreetScene works out the
// revs (engine()) and how a sound is heard (heard()).
(function(){
  var S = window.bdnixStreetScene, sound = window.bdnixSound;
  var ctx = null, out = null, on = false, me = null, rivals = [], street = null, lastHorn = 0;
  var shown = { running: false, hz: 0, gain: 0, rivals: 0, horns: 0 };

  function context(){
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = sound.isMuted() ? 0 : 1;
    out.connect(ctx.destination);
    sound.onChange(function(muted){ out.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02); });
    return ctx;
  }
  var noiseBuf = null;
  function noise(c){
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      var d = noiseBuf.getChannelData(0), last = 0;
      // Brown-ish: rumble rather than hiss.
      for (var i = 0; i < d.length; i++) { last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04; d[i] = last * 3.5; }
    }
    var n = c.createBufferSource();
    n.buffer = noiseBuf;
    n.loop = true;
    return n;
  }
  function osc(c, type){ var o = c.createOscillator(); o.type = type; return o; }
  function gain(c, v){ var g = c.createGain(); g.gain.value = v; return g; }

  // An engine's voice: its firing note as a sawtooth, a square an octave
  // down for the thump, noise for the intake, through a filter that opens
  // with the revs; a supercharger's whine for the H2.
  var VOICES = {
    buzz: { saw: 0.5, sub: 0.15, hiss: 0.35, up: 2, open: 900 },
    thump: { saw: 0.35, sub: 0.6, hiss: 0.25, up: 1, open: 700 },
    scream: { saw: 0.55, sub: 0.1, hiss: 0.2, up: 2, open: 2400 },
    whine: { saw: 0.5, sub: 0.15, hiss: 0.2, up: 2, open: 2000, whine: 0.08 }
  };
  function Voice(c, voice, dest){
    var v = VOICES[voice] || VOICES.buzz;
    this.v = v;
    this.filter = c.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 3;
    this.level = gain(c, 0);
    this.saw = osc(c, 'sawtooth'); this.sub = osc(c, 'square'); this.hiss = noise(c);
    this.hissFilter = c.createBiquadFilter(); this.hissFilter.type = 'bandpass'; this.hissFilter.Q.value = 1.5;
    this.saw.connect(gain(c, v.saw)).connect(this.filter);
    this.sub.connect(gain(c, v.sub)).connect(this.filter);
    this.hiss.connect(this.hissFilter).connect(gain(c, v.hiss)).connect(this.filter);
    this.filter.connect(this.level);
    if (v.whine) { this.whine = osc(c, 'sine'); this.whineLevel = gain(c, 0); this.whine.connect(this.whineLevel).connect(this.level); this.whine.start(); }
    this.level.connect(dest);
    this.saw.start(); this.sub.start(); this.hiss.start();
  }
  // Sets the note (Hz), how hard it's working (0 to 1) and how loud.
  Voice.prototype.set = function(hz, revs, loud){
    var t = ctx.currentTime, k = 0.05, f = Math.max(12, hz) * this.v.up;
    this.saw.frequency.setTargetAtTime(f, t, k);
    this.sub.frequency.setTargetAtTime(f / 2, t, k);
    this.hissFilter.frequency.setTargetAtTime(f * 4, t, k);
    this.filter.frequency.setTargetAtTime(this.v.open * (0.4 + revs * 1.6), t, k);
    this.level.gain.setTargetAtTime(loud, t, k);
    if (this.whine) { this.whine.frequency.setTargetAtTime(f * 7, t, k); this.whineLevel.gain.setTargetAtTime(revs * revs * this.v.whine, t, k); }
  };
  Voice.prototype.stop = function(){
    var t = ctx.currentTime;
    this.level.gain.setTargetAtTime(0, t, 0.05);
    var nodes = [this.saw, this.sub, this.hiss].concat(this.whine ? [this.whine] : []);
    nodes.forEach(function(n){ try { n.stop(t + 0.3); } catch (e) {} });
  };

  // The street: a hum of distant traffic, the nearest CNG's rattle and the
  // nearest diesel's rumble.
  function Street(c, dest){
    this.hum = noise(c);
    this.humFilter = c.createBiquadFilter(); this.humFilter.type = 'lowpass'; this.humFilter.frequency.value = 400;
    this.humLevel = gain(c, 0);
    this.hum.connect(this.humFilter).connect(this.humLevel).connect(dest);
    this.cng = osc(c, 'sawtooth'); this.cng.frequency.value = 95;
    this.cngFilter = c.createBiquadFilter(); this.cngFilter.type = 'bandpass'; this.cngFilter.frequency.value = 700; this.cngFilter.Q.value = 1.2;
    this.cngLevel = gain(c, 0); this.cngPan = c.createStereoPanner();
    this.cng.connect(this.cngFilter).connect(this.cngLevel).connect(this.cngPan).connect(dest);
    this.diesel = osc(c, 'square'); this.diesel.frequency.value = 42;
    this.dieselFilter = c.createBiquadFilter(); this.dieselFilter.type = 'lowpass'; this.dieselFilter.frequency.value = 220;
    this.dieselLevel = gain(c, 0); this.dieselPan = c.createStereoPanner();
    this.diesel.connect(this.dieselFilter).connect(this.dieselLevel).connect(this.dieselPan).connect(dest);
    this.hum.start(); this.cng.start(); this.diesel.start();
  }
  Street.prototype.stop = function(){
    var t = ctx.currentTime;
    [this.humLevel, this.cngLevel, this.dieselLevel].forEach(function(g){ g.gain.setTargetAtTime(0, t, 0.05); });
    [this.hum, this.cng, this.diesel].forEach(function(n){ try { n.stop(t + 0.3); } catch (e) {} });
  };

  // A horn: two quick blasts of two notes, from where the vehicle is.
  function horn(pan, loud, kind){
    var t = ctx.currentTime, p = ctx.createStereoPanner(), g = gain(ctx, 0);
    p.pan.value = pan;
    g.connect(p).connect(out);
    var notes = kind === 'bus' || kind === 'truck' ? [220, 277] : kind === 'cng' ? [520, 610] : [392, 494];
    notes.forEach(function(f){
      var o = osc(ctx, 'square');
      o.frequency.value = f;
      o.connect(g);
      o.start(t); o.stop(t + 0.62);
    });
    [0, 0.34].forEach(function(at){
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(0.06 * loud, t + at + 0.02);
      g.gain.setValueAtTime(0.06 * loud, t + at + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.26);
    });
    shown.horns++;
  }

  // Starts the sound of a race: the player on bike `bike` (its id), the
  // rivals on theirs. Only after a press (a browser rule), so from the
  // start button.
  function start(bike, rivalBikes){
    stop();
    var c = context();
    if (!c) return false;
    if (c.state === 'suspended' && c.resume) c.resume();
    me = { id: bike, voice: new Voice(c, S.engine(bike, 0).voice, out) };
    rivals = rivalBikes.map(function(id){
      var pan = c.createStereoPanner();
      pan.connect(out);
      return { id: id, pan: pan, voice: new Voice(c, S.engine(id, 0).voice, pan) };
    });
    street = new Street(c, out);
    on = true;
    shown.running = true;
    return true;
  }
  function stop(){
    if (!on) return;
    me.voice.stop();
    rivals.forEach(function(r){ r.voice.stop(); });
    street.stop();
    me = null; rivals = []; street = null; on = false;
    shown.running = false; shown.hz = 0; shown.gain = 0; shown.rivals = 0;
  }
  // Each frame: f = { speed, throttle (0 to 1), listener: { x, z, heading,
  // speed }, rivals: [{ x, z, speed, down }], cars: [{ kind, x, z, speed }],
  // busy (the level's traffic, 0 to 1), night, time (seconds) }, positions
  // on the map. A rival down or a racer off their bike is silent.
  function update(f){
    if (!on) return;
    var e = S.engine(me.id, f.speed), L = f.listener, loud = f.off ? 0 : 0.05 + 0.08 * e.revs + 0.04 * (f.throttle || 0);
    me.voice.set(e.hz, e.revs, loud);
    shown.hz = e.hz; shown.gain = loud;
    var heardRivals = 0;
    rivals.forEach(function(r, i){
      var o = f.rivals[i];
      if (!o || o.down) { r.voice.set(20, 0, 0); return; }
      var h = S.heard(L.x, L.z, L.heading, o.x, o.z, o.speed, L.speed), re = S.engine(r.id, o.speed);
      r.pan.pan.setTargetAtTime(h.pan, ctx.currentTime, 0.05);
      r.voice.set(re.hz * h.pitch, re.revs, 0.12 * h.gain);
      if (h.gain > 0.05) heardRivals++;
    });
    shown.rivals = heardRivals;
    // The street around: its hum, and the nearest CNG and diesel.
    var t = ctx.currentTime, near = { cng: null, diesel: null };
    f.cars.forEach(function(c){
      var h = S.heard(L.x, L.z, L.heading, c.x, c.z, c.speed, L.speed), k = c.kind === 'cng' ? 'cng' : c.kind === 'bus' || c.kind === 'truck' ? 'diesel' : null;
      if (k && (!near[k] || h.gain > near[k].gain)) near[k] = h;
    });
    street.humLevel.gain.setTargetAtTime(0.01 + 0.05 * f.busy, t, 0.3);
    street.cngLevel.gain.setTargetAtTime(near.cng ? 0.05 * near.cng.gain : 0, t, 0.1);
    if (near.cng) { street.cngPan.pan.setTargetAtTime(near.cng.pan, t, 0.1); street.cng.frequency.setTargetAtTime(95 * near.cng.pitch, t, 0.1); }
    street.dieselLevel.gain.setTargetAtTime(near.diesel ? 0.09 * near.diesel.gain : 0, t, 0.1);
    if (near.diesel) street.dieselPan.pan.setTargetAtTime(near.diesel.pan, t, 0.1);
    // Horns: every few seconds at rush hour, seldom at night.
    var every = f.night ? 25 : 3 + 12 * (1 - f.busy);
    if (f.time - lastHorn > every && f.cars.length) {
      lastHorn = f.time;
      var c2 = f.cars[Math.floor((f.time * 7.31) % f.cars.length)], h2 = S.heard(L.x, L.z, L.heading, c2.x, c2.z, c2.speed, L.speed);
      if (h2.gain > 0.02) horn(h2.pan, Math.min(1, h2.gain * 4), c2.kind);
    }
    if (f.time < lastHorn) lastHorn = f.time;
  }
  // What's playing, for checking: whether the engines run, the player's
  // engine's note and loudness, how many rivals can be heard and how many
  // horns have sounded.
  function state(){
    return { running: shown.running, hz: shown.hz, gain: shown.gain, rivals: shown.rivals, horns: shown.horns, muted: sound.isMuted() };
  }

  window.bdnixStreetAudio = { start: start, stop: stop, update: update, state: state };
})();
