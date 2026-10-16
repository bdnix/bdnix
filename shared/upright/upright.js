// The games are played with the phone upright. When a phone is turned
// sideways, this covers the page with a note asking for it to be turned
// back, and tells the game so it can pause. Mouse and keyboard screens are
// never covered, however short the window.
(function(){
  var mq = window.matchMedia('(orientation:landscape) and (max-height:520px) and (pointer:coarse)');
  var turned = [];              // what each game does when the phone turns sideways

  var note = document.createElement('div');
  note.className = 'upright';
  note.setAttribute('role', 'alert');
  note.hidden = true;
  note.innerHTML =
    '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="4" y="22" width="26" height="16" rx="3" opacity=".45"/>' +
    '<rect x="28" y="12" width="16" height="28" rx="3"/>' +
    '<path d="M9 16a13 13 0 0 1 13-10M22 6l-4-2M22 6l-3 3.5"/></svg>' +
    '<h2>Turn your phone upright</h2>' +
    '<p>The games only work in portrait mode. A game in progress is paused until you turn back.</p>';
  document.body.appendChild(note);

  function update(){
    note.hidden = !mq.matches;
    if (mq.matches) turned.forEach(function(fn){ fn(); });
  }
  if (mq.addEventListener) mq.addEventListener('change', update);
  update();

  window.bdnixUpright = {
    // Calls `fn` whenever the phone is turned sideways, and now if it already is.
    onTurn: function(fn){
      turned.push(fn);
      if (mq.matches) fn();
    }
  };
})();
