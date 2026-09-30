// The pause button in a game's top bar (#pauseBtn): shows pause while the
// game runs and play while it's paused, with a label to match. Each game
// decides when it pauses and calls setPaused() to say so.
(function(){
  var ICON_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2h3v12H4zM9 2h3v12H9z"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5z"/></svg>';

  function setPaused(paused){
    var btn = document.getElementById('pauseBtn');
    if (!btn) return;
    btn.innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
    btn.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
  }

  window.bdnixGamebar = { setPaused: setPaused };
})();
