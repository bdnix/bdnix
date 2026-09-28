// Makes the games deterministic for tests: Math.random always returns 0
// (so Falling Blocks deals O, T, J, L, S, Z, I every bag and frightened ghosts
// always take their first option), and time only moves when a test calls
// page.clock.runFor(). Leaves the game on its start screen.
//
// The clock is paused before the page loads, so it never runs in real
// time. Pausing a clock that is already running races with its real-time
// updates, which can step time backwards and stall the games' loops.
export async function openGame(page, path){
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.goto(path);
}

export async function press(page, key, times = 1){
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
}

// How much has been drawn on a canvas (0 when it's blank).
export function inkOn(page, selector){
  return page.locator(selector).evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  });
}

// Touch controls fire on pointerdown; dispatching works at any screen size.
export async function tap(locator){
  await locator.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true });
  await locator.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
}

// Records the name of every sound the page plays from its next load on
// (sounds skipped while muted aren't recorded). Read them with heard(), which
// also forgets them, so each call returns only what played since the last.
export async function listen(page){
  await page.addInitScript(() => {
    let sound;
    window.heard = [];
    Object.defineProperty(window, 'bdnixSound', {
      configurable: true,
      get: () => sound,
      set: (s) => {
        const play = s.play;
        s.play = (name) => { const ok = play(name); if (ok) window.heard.push(name); return ok; };
        sound = s;
      }
    });
  });
}
export const heard = (page) => page.evaluate(() => window.heard.splice(0));

// What's wrong with the sounds the page's game can play, shared and its own
// (empty when nothing is): every tone well formed, every sound loud enough
// to hear on a phone, and no tones that add up past full scale.
export function soundProblems(page){
  return page.evaluate(() => {
    const S = window.bdnixSound, problems = [];
    const waves = ['sine', 'square', 'triangle', 'sawtooth', 'noise'];
    // How loud a tone is for its peak level: a square wave is as loud as
    // its peak, the others less so.
    const weight = { square: 1, sine: Math.SQRT1_2, triangle: 1 / Math.sqrt(3), sawtooth: 1 / Math.sqrt(3), noise: 1 / Math.sqrt(3) };
    for (const [name, tones] of Object.entries(S.SOUNDS)) {
      if (!tones.length) problems.push(name + ' has no tones');
      for (const n of tones) {
        if (!waves.includes(n.type)) problems.push(name + ' wave');
        if (!(n.d > 0 && n.d <= 1.5)) problems.push(name + ' length');
        if (!(n.t >= 0 && n.t < 1)) problems.push(name + ' start');
        if (!(n.v > 0 && n.v <= 1)) problems.push(name + ' loudness');
        // Exponential slides can't start or end at 0 Hz.
        if (n.type !== 'noise' && !(n.f > 20 && n.to > 20 && n.f < 5000 && n.to < 5000)) problems.push(name + ' pitch');
        // The most tones are sounding just as one starts.
        const together = tones.filter((m) => m.t <= n.t && n.t < m.t + m.d).reduce((sum, m) => sum + m.v * S.VOLUME, 0);
        if (together > 1) problems.push(name + ' clips');
      }
      if (Math.max(...tones.map((n) => n.v * S.VOLUME * (weight[n.type] || 0))) < 0.1) problems.push(name + ' is too quiet');
    }
    return [...new Set(problems)];
  });
}
