import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';

function page(withButton){
  const btn = { innerHTML: '', attrs: {}, setAttribute(k, v){ this.attrs[k] = v; } };
  return { btn, document: { getElementById: (id) => (withButton && id === 'pauseBtn' ? btn : null) } };
}

test('setPaused swaps the icon and label of #pauseBtn', () => {
  const { btn, document } = page(true);
  const G = load('assets/js/gamebar.js', { document }).bdnixGamebar;
  G.setPaused(true);
  assert.equal(btn.attrs['aria-label'], 'Resume');
  assert.match(btn.innerHTML, /^<svg [^>]*aria-hidden="true"><path fill="currentColor" d="M4 2\.5v11/);
  G.setPaused(false);
  assert.equal(btn.attrs['aria-label'], 'Pause');
  assert.match(btn.innerHTML, /d="M4 2h3v12H4zM9 2h3v12H9z"/);
});

test('setPaused does nothing on a page without a pause button', () => {
  const { document } = page(false);
  const G = load('assets/js/gamebar.js', { document }).bdnixGamebar;
  assert.doesNotThrow(() => G.setPaused(true));
});
