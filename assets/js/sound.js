// Sound effects for the games. Every sound is made on the spot with the Web
// Audio API from short recipes, so there are no audio files to download.
// This file has the sounds every game plays; each game adds its own with
// add(). Sound is on until the visitor mutes it (the speaker button in a
// game's top bar, or M); the choice is kept in localStorage as bdnix_sound
// and applies to every game.
(function(){
  var KEY = 'bdnix_sound';
  var VOLUME = 1;               // overall loudness, on top of each tone's own

  // A sound is a list of tones. Each tone starts `t` seconds in, lasts `d`
  // seconds and slides from frequency `f` to `to` (Hz); `type` is an
  // oscillator wave or 'noise', and `v` its loudness from 0 to 1.
  function tone(f, to, d, type, v, t){ return { f: f, to: to, d: d, type: type, v: v, t: t || 0 }; }
  // Notes one after another, `step` seconds apart.
  function notes(freqs, step, d, type, v){
    return freqs.map(function(f, i){ return tone(f, f, d, type, v, i * step); });
  }

  // The sounds every game plays. A game adds its own with add().
  var SOUNDS = {
    start: notes([392, 523, 659, 784], 0.07, 0.1, 'square', 0.16),
    over: notes([494, 415, 349, 262], 0.16, 0.24, 'triangle', 0.4),
    best: notes([523, 659, 784, 1047, 784, 1047], 0.09, 0.14, 'square', 0.17)
  };

  // Adds a game's own sounds: { name: [tones] }, made with tone() and notes().
  function add(recipes){
    for (var name in recipes) SOUNDS[name] = recipes[name];
  }

  var muted = false;
  try { muted = localStorage.getItem(KEY) === 'off'; } catch (e) {}

  var ctx = null, noise = null;
  // The audio context is made on first use: browsers only let a page make
  // sound once the visitor has pressed something. Safari also puts it to
  // sleep when the phone locks or another app takes the sound ('suspended'
  // or 'interrupted'), and only lets it start again during a press.
  function context(){
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if ((ctx.state === 'suspended' || ctx.state === 'interrupted') && ctx.resume) ctx.resume();
    return ctx;
  }
  // Most sounds are played from a game's loop, not from a press (a dot is
  // eaten, a ghost catches you), so every tap and key press wakes the audio
  // up ready for them.
  function wake(){
    if (muted) return;
    try { context(); } catch (e) {}
  }
  // A second of white noise, made once and reused for every noisy tone.
  function noiseBuffer(c){
    if (!noise) {
      noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      var d = noise.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noise;
  }

  // Plays a sound by name. Returns whether it played: not when sound is
  // muted, the name is unknown or the browser can't make sound.
  function play(name){
    var recipe = SOUNDS[name];
    if (muted || !recipe) return false;
    try {
      var c = context();
      if (!c) return false;
      var now = c.currentTime;
      recipe.forEach(function(n){
        var start = now + n.t, end = start + n.d;
        var src;
        if (n.type === 'noise') {
          src = c.createBufferSource();
          src.buffer = noiseBuffer(c);
        } else {
          src = c.createOscillator();
          src.type = n.type;
          src.frequency.setValueAtTime(n.f, start);
          if (n.to !== n.f) src.frequency.exponentialRampToValueAtTime(n.to, end);
        }
        // A quick fade in and a longer fade out, so tones don't click.
        var gain = c.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(n.v * VOLUME, start + Math.min(0.01, n.d / 4));
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        src.connect(gain);
        gain.connect(c.destination);
        src.start(start);
        src.stop(end + 0.02);
      });
      return true;
    } catch (e) { return false; }
  }

  var listeners = [];
  function isMuted(){ return muted; }
  function setMuted(m){
    muted = !!m;
    try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch (e) {}
    wake();                     // unmuting is a press too
    listeners.forEach(function(fn){ fn(muted); });
  }
  function toggle(){ setMuted(!muted); return muted; }
  // Calls fn(muted) whenever sound is muted or unmuted.
  function onChange(fn){ listeners.push(fn); }

  window.bdnixSound = { VOLUME: VOLUME, SOUNDS: SOUNDS, tone: tone, notes: notes, add: add, play: play, isMuted: isMuted, setMuted: setMuted, toggle: toggle, onChange: onChange };

  if (typeof document !== 'undefined') {
    ['pointerdown', 'touchend', 'keydown', 'click'].forEach(function(type){
      document.addEventListener(type, wake, true);
    });
  }

  // ---------- Mute button ----------
  // A game page puts a #soundBtn in its top bar; M toggles it too.
  var btn = typeof document !== 'undefined' && document.getElementById('soundBtn');
  if (!btn) return;
  var ICON_ON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 6h2.5L8 3v10L4.5 10H2z"/><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6.3 6.3 0 0 1 0 9"/></svg>';
  var ICON_OFF = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 6h2.5L8 3v10L4.5 10H2z"/><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M10.5 6l4 4M14.5 6l-4 4"/></svg>';
  function show(){
    btn.innerHTML = muted ? ICON_OFF : ICON_ON;
    btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }
  onChange(show);
  show();
  btn.addEventListener('click', function(){ toggle(); btn.blur(); });
  document.addEventListener('keydown', function(e){
    if (e.code === 'KeyM' && !e.repeat) { toggle(); e.preventDefault(); }
  });
})();
