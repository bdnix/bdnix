// The visitor's profile: a display name plus the scores the games already
// keep in localStorage. It lives only in this browser; nothing is sent anywhere.
(function(){
  var NAME_KEY = 'bdnix_name';
  var DEFAULT_NAME = 'User';
  var MAX_NAME = 24;

  // Keys written by the games (see tetris.js and pacman.js) and main.js.
  var GAMES = [
    { id: 'tetris', name: 'Tetris', key: 'bdnix_tetris_best', href: '/play/' },
    { id: 'pacman', name: 'Pac-Man', key: 'bdnix_pacman_best', href: '/pacman/' }
  ];

  function read(key){
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function clean(name){
    return String(name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  }

  function getName(){
    return clean(read(NAME_KEY)) || DEFAULT_NAME;
  }

  // Saves the name; an empty one goes back to the default. Returns the name in use.
  function setName(name){
    name = clean(name);
    try {
      if (name && name !== DEFAULT_NAME) localStorage.setItem(NAME_KEY, name);
      else localStorage.removeItem(NAME_KEY);
    } catch (e) {}
    fill();
    return name || DEFAULT_NAME;
  }

  // First character, counting emoji and other multi-unit letters as one.
  function initial(name){
    return (Array.from(name)[0] || '?').toUpperCase();
  }

  function scores(){
    return GAMES.map(function(g){
      var best = parseInt(read(g.key), 10);
      return { id: g.id, name: g.name, href: g.href, best: best > 0 ? best : 0 };
    });
  }

  function visits(){
    return parseInt(read('bdnix_visits'), 10) || 0;
  }

  // Fills every [data-profile-name] / [data-profile-initial] on the page.
  function fill(){
    var name = getName();
    Array.prototype.forEach.call(document.querySelectorAll('[data-profile-name]'), function(el){ el.textContent = name; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-profile-initial]'), function(el){ el.textContent = initial(name); });
  }

  window.bdnixProfile = {
    DEFAULT_NAME: DEFAULT_NAME, MAX_NAME: MAX_NAME,
    getName: getName, setName: setName, initial: initial,
    scores: scores, visits: visits, fill: fill
  };

  fill();
  // Another tab changing the name keeps this one in step.
  window.addEventListener('storage', function(e){ if (e.key === NAME_KEY || e.key === null) fill(); });
})();
