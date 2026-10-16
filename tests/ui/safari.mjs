// Makes audio behave as it does in Safari on an iPhone: it only starts, or
// starts again, while the page is handling a tap or key press. Every audio
// context the page makes is kept in window.audio.
export async function likeSafari(page){
  await page.addInitScript(() => {
    const pressing = () => !!window.event && window.event.isTrusted && /^(pointer|touch|key|click|mouse)/.test(window.event.type);
    const Real = window.AudioContext;
    window.audio = [];
    window.AudioContext = class extends Real {
      constructor(){ super(); this.awake = pressing(); window.audio.push(this); }
      get state(){ return this.awake ? 'running' : 'suspended'; }
      resume(){ if (pressing()) this.awake = true; return Promise.resolve(); }
    };
  });
}
// The state of each audio context the page made (likeSafari()).
export const audioStates = (page) => page.evaluate(() => window.audio.map((c) => c.state));
