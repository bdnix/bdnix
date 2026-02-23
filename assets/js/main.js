(function(){
  function qs(sel){return document.querySelector(sel)}
  function qsa(sel){return document.querySelectorAll(sel)}

  var launch = new Date(window.LAUNCH_DATE || Date.now() + 1000*60*60*24*30).getTime();
  var dEl = qs('#days'), hEl = qs('#hours'), mEl = qs('#minutes'), sEl = qs('#seconds');

  function updateCountdown(){
    var now = Date.now();
    var diff = Math.max(0, launch - now);
    var days = Math.floor(diff / (1000*60*60*24));
    var hours = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
    var mins = Math.floor((diff % (1000*60*60)) / (1000*60));
    var secs = Math.floor((diff % (1000*60)) / 1000);
    dEl.textContent = days;
    hEl.textContent = String(hours).padStart(2,'0');
    mEl.textContent = String(mins).padStart(2,'0');
    sEl.textContent = String(secs).padStart(2,'0');
  }
  updateCountdown();
  setInterval(updateCountdown,1000);

  // Signup handling (no backend): validates and stores locally.
  var form = qs('#signup');
  var emailInput = qs('#email');
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var email = (emailInput.value||'').trim();
    if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
      emailInput.focus();
      emailInput.setAttribute('aria-invalid','true');
      return;
    }
    emailInput.removeAttribute('aria-invalid');
    // If a FORM endpoint is configured, POST there, otherwise save locally.
    if(window.FORM_ENDPOINT && window.FORM_ENDPOINT.length){
      fetch(window.FORM_ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({email: email})
      }).then(function(res){
        if(res.ok){
          form.innerHTML = '<p class="lead" style="margin:0 0 12px">Thanks — we\'ll email you when we launch.</p>';
        } else {
          throw new Error('Network error');
        }
      }).catch(function(){
        // Fallback: store locally and show success message
        var list = JSON.parse(localStorage.getItem('bdnix_waitlist')||'[]');
        if(list.indexOf(email) === -1) list.push(email);
        localStorage.setItem('bdnix_waitlist', JSON.stringify(list));
        form.innerHTML = '<p class="lead" style="margin:0 0 12px">Thanks — we\'ll email you when we launch.</p>';
      });
    } else {
      var list = JSON.parse(localStorage.getItem('bdnix_waitlist')||'[]');
      if(list.indexOf(email) === -1) list.push(email);
      localStorage.setItem('bdnix_waitlist', JSON.stringify(list));
      form.innerHTML = '<p class="lead" style="margin:0 0 12px">Thanks — we\'ll email you when we launch.</p>';
    }
  });
})();
