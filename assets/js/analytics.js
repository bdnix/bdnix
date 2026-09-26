// Google Analytics (gtag.js) page views. It only runs on the live site, so
// local previews and the tests never send anything or fetch Google's script.
// Only the page's address and title are reported: files opened in the tools
// stay in the browser.
(function(){
  var ID = 'G-67D1H8GX6X';
  var HOSTS = ['www.bdnix.com', 'bdnix.com'];

  function enabled(hostname){
    return HOSTS.indexOf(String(hostname || '').toLowerCase()) !== -1;
  }

  window.bdnixAnalytics = { id: ID, enabled: enabled };

  if (!enabled(window.location && window.location.hostname)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', ID);

  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(script);
})();
