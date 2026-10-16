// Keeps a game in progress across a reload or a later visit: each game saves
// its state to localStorage as the page goes away (and whenever it pauses),
// and on the next load picks it up again, paused. One key per game,
// bdnix_<game>_save; nothing leaves the browser. No DOM, so it can be unit tested.
(function(){
  var VERSION = 1;

  function key(game){ return 'bdnix_' + game + '_save'; }

  // Returns whether it was saved (storage can be full or blocked).
  function save(game, data){
    try {
      localStorage.setItem(key(game), JSON.stringify({ v: VERSION, data: data }));
      return true;
    } catch (e) { return false; }
  }

  // The saved state, or null if there's none or it can't be read.
  function load(game){
    try {
      var s = JSON.parse(localStorage.getItem(key(game)));
      if (s && s.v === VERSION && s.data && typeof s.data === 'object') return s.data;
    } catch (e) {}
    return null;
  }

  function clear(game){
    try { localStorage.removeItem(key(game)); } catch (e) {}
  }

  // Saves whatever snapshot() returns when the page is hidden for good
  // (reload, closing the tab, leaving the page), or clears the save when it
  // returns null (no game in progress). Returns the same save-now function,
  // for the game to call when it pauses, starts or ends.
  function keep(game, snapshot){
    function flush(){
      var data = snapshot();
      if (data) save(game, data); else clear(game);
    }
    window.addEventListener('pagehide', flush);
    return flush;
  }

  // True for a finite number (JSON turns NaN and Infinity into null).
  function num(n){ return typeof n === 'number' && isFinite(n); }

  window.bdnixSave = { VERSION: VERSION, key: key, save: save, load: load, clear: clear, keep: keep, num: num };
})();
