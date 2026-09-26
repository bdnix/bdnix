// Google Analytics (gtag.js) page views, only with the visitor's consent.
// On the live site a banner asks first; Google's script is only loaded once
// they accept, and the choice can be changed on the profile page. Local
// previews and the tests never show the banner or contact Google. Only the
// page's address and title are reported: files opened in the tools stay in
// the browser.
(function(){
  var ID = 'G-67D1H8GX6X';
  var HOSTS = ['www.bdnix.com', 'bdnix.com'];
  var KEY = 'bdnix_analytics';
  var live = enabled(window.location && window.location.hostname);
  var loaded = false;
  var banner = null;

  function enabled(hostname){
    return HOSTS.indexOf(String(hostname || '').toLowerCase()) !== -1;
  }

  // 'granted', 'denied', or null if the visitor hasn't chosen yet.
  function consent(){
    try {
      var v = localStorage.getItem(KEY);
      return v === 'granted' || v === 'denied' ? v : null;
    } catch (e) { return null; }
  }

  function start(){
    if (loaded || !live) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ID);
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(script);
  }

  // Google's cookies (_ga, _ga_<id>) are set on the site's main domain.
  function clearCookies(){
    var domain = String(window.location.hostname).replace(/^www\./, '');
    String(document.cookie || '').split(';').forEach(function(c){
      var name = c.split('=')[0].replace(/^\s+|\s+$/g, '');
      if (!/^_ga(_|$)/.test(name)) return;
      var gone = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      document.cookie = gone;
      document.cookie = gone + '; domain=.' + domain;
    });
  }

  function setConsent(choice){
    choice = choice === 'granted' ? 'granted' : 'denied';
    try { localStorage.setItem(KEY, choice); } catch (e) {}
    if (choice === 'granted') {
      start();
    } else if (live) {
      if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' });
      clearCookies();
    }
    if (banner) { banner.parentNode.removeChild(banner); banner = null; }
    try { window.dispatchEvent(new Event('bdnix:consent')); } catch (e) {}
    return choice;
  }

  function showBanner(){
    banner = document.createElement('div');
    banner.className = 'consent panel';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML =
      '<p>bdnix would like to use Google Analytics cookies to count visits. ' +
      'Files you open in the tools never leave your browser. ' +
      'You can change this any time on <a href="/profile/">your profile</a>.</p>' +
      '<div class="consent-actions">' +
      '<button class="btn btn-ghost" type="button" data-consent="denied">Decline</button>' +
      '<button class="btn btn-ghost" type="button" data-consent="granted">Accept</button>' +
      '</div>';
    [].forEach.call(banner.querySelectorAll('[data-consent]'), function(b){
      b.addEventListener('click', function(){ setConsent(b.getAttribute('data-consent')); });
    });
    document.body.appendChild(banner);
  }

  window.bdnixAnalytics = { id: ID, enabled: enabled, live: live, consent: consent, setConsent: setConsent };

  if (!live) return;
  var choice = consent();
  if (choice === 'granted') start();
  else if (!choice) {
    if (document.body) showBanner();
    else document.addEventListener('DOMContentLoaded', showBanner);
  }
})();
