// The site's languages. Pages and scripts are written in English; every
// other language is a pack that the build makes from that language's
// translations (English text → translation), in assets/lang/<code>/*.json
// and each module's lang/<code>.json (tools/languages.mjs). This runs
// first, in every page's <head>: it picks the visitor's language (the one
// they chose on this site, kept in this browser, or else their browser's own
// if the site has it), loads its pack, and then translates the page while
// it's read and whenever a script changes it: text, labels, placeholders and
// the page's title, with numbers in the language's own digits. Text in an
// element marked translate="no" (a file's name, the visitor's own name) is
// left as it is.
//
// Scripts only need this for text with something put into it:
// t('Reading {name}…', { name: file.name }), count(n, '{n} page', '{n} pages'),
// and num(n) for a number they draw themselves, on a canvas say.
(function(){
  // build:languages
  var LANGUAGES = [{"code":"en","name":"English"}];
  // /build:languages

  var KEY = 'bdnix_lang';
  var root = typeof document !== 'undefined' ? document.documentElement : null;

  function find(code){
    for (var i = 0; i < LANGUAGES.length; i++) if (LANGUAGES[i].code === code) return LANGUAGES[i];
    return null;
  }
  function saved(){
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function fromBrowser(){
    var nav = typeof navigator !== 'undefined' ? navigator : {};
    var list = nav.languages || [nav.language];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || '').toLowerCase().split('-')[0];
      if (find(code)) return code;
    }
    return 'en';
  }
  var current = find(saved()) || find(fromBrowser());

  var pack = null;       // English text → translation, once the pack has loaded
  var WORD = /[A-Za-z][A-Za-z0-9@._'’-]*/g;
  function bare(w){ return w.replace(/[._'’-]+$/, ''); }
  var made = {};         // text t() made, which may hold names and the like
  var madeCount = 0;
  var missing = [];      // English with no translation, for the tests
  var loading = true;    // the page is still being read: text may come in pieces

  // ---- Words ----
  function num(n){
    var s = String(n), digits = pack && current.digits;
    return digits ? s.replace(/[0-9]/g, function(d){ return digits[d]; }) : s;
  }

  // The words put into text (a file's name, what the visitor searched
  // for): they're not English left untranslated, wherever they turn up.
  var inserted = {}, insertedCount = 0;
  function put(s){
    if (!pack) return;
    if (insertedCount > 2000) { inserted = {}; insertedCount = 0; }
    // Each word, and each part of one (photos and pdf, in photos.pdf).
    (s.match(WORD) || []).concat(s.split(/[^A-Za-z0-9@]+/)).forEach(function(w){
      w = bare(w);
      if (w && !inserted[w]) { inserted[w] = true; insertedCount++; }
    });
  }

  function remember(s){
    if (!pack) return s;
    if (madeCount > 500) { made = {}; madeCount = 0; }
    if (!made[s]) { made[s] = true; madeCount++; }
    return s;
  }

  // "{n} of {total}", with each {name} put in, numbers in the language's digits.
  function fill(text, values){
    return String(text).replace(/\{(\w+)\}/g, function(all, key){
      var v = values && values[key];
      if (v === undefined || v === null) return all;
      if (typeof v === 'number') return num(v);
      put(String(v));
      return String(v);
    });
  }

  // A word that means different things in different places says which it
  // is after a bar: t('Draw|result') is "Draw", the end of a game of chess,
  // not the button that draws a box.
  function t(text, values){
    var s = pack && pack[text], bar = text.indexOf('|');
    if (typeof s !== 'string') {
      s = bar < 0 ? text : text.slice(0, bar);
      if (pack) miss(s);
    }
    return remember(fill(s, values));
  }

  // The form of "{n} page" / "{n} pages" for n. A language with more forms
  // than English gives the plural one as { one, few, many, other }. Each
  // can say which meaning it is after a bar, as t() does.
  function count(n, one, other){
    var english = (n === 1 ? one : other).split('|')[0];
    var s = pack && (pack[other] !== undefined ? pack[other] : null);
    if (s && typeof s === 'object') {
      var form = 'other';
      try { form = new Intl.PluralRules(current.code).select(n); } catch (e) {}
      s = s[form] || s.other;
    } else if (pack && n === 1 && typeof pack[one] === 'string') {
      s = pack[one];
    }
    if (typeof s !== 'string') {
      if (pack) miss(english);
      s = english;
    }
    return remember(fill(s, { n: n }));
  }

  // ---- What's left in English ----
  // Words that stay as they are in any language: names, and formats and
  // units written the same way everywhere. Words in capitals (PDF, MP3) and
  // ones with digits or dots in them (a file's name) stay too, and so do
  // names (Instagram, Full HD) in text that's been translated into another
  // script.
  var KEEP = /^(bdnix|GitHub|Stockfish|English|Space|Enter|Esc|Helvetica|Times|Courier|WebP|WebM|Ogg|Opus|kbps|Hz|px|ttf|otf|pdf|png|jpe?g|webp|gif|mp3|mp4|wav)$/;
  function english(text){
    var words = String(text).match(WORD) || [];
    var translated = /[^\s!-\u024f\u1e00-\u1eff\u2000-\u2bff]/.test(text);
    return words.some(function(w){
      w = bare(w);
      return /[a-z]/.test(w) && !/[0-9@.]/.test(w) && !KEEP.test(w) && !inserted[w] && !(translated && /^[A-Z]/.test(w));
    });
  }
  function miss(text, inPage){
    if (inPage && loading) return;
    if (english(text) && missing.indexOf(text) < 0 && missing.length < 200) missing.push(text);
  }

  // ---- Translating the page ----
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|svg)$/;
  var INLINE = /^(A|B|I|EM|STRONG|U|BR|CODE|KBD|SMALL)$/;
  var ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
  var done = typeof WeakSet === 'function' ? new WeakSet() : null;

  function keep(el){
    for (; el && el.nodeType === 1; el = el.parentNode) {
      if (SKIP.test(el.nodeName) || el.getAttribute('translate') === 'no') return true;
    }
    return false;
  }

  // Numbers on their own, not part of a word or a name (MP3, A1.pdf).
  function digits(s){
    if (!current.digits) return s;
    return s.replace(/(^|[^A-Za-z0-9_.])([0-9]+(?:[.,:][0-9]+)*)(?![A-Za-z0-9_])/g, function(all, before, n){
      return before + num(n);
    });
  }

  // The translation of a piece of text, with the spaces around it kept.
  function translateText(s){
    var key = s.replace(/\s+/g, ' ').trim();
    if (!key) return s;
    var to = pack[key];
    if (typeof to === 'string') return /^\s*/.exec(s)[0] + to + /\s*$/.exec(s)[0];
    if (!made[key] && !made[s]) miss(key, true);
    return s;
  }

  function translateNode(node){
    if (node.nodeType === 3) {
      if (keep(node.parentNode) || inMixed(node)) return;
      var v = digits(translateText(node.nodeValue));
      if (v !== node.nodeValue) node.nodeValue = v;
      return;
    }
    if (node.nodeType !== 1 || keep(node)) return;
    ATTRS.forEach(function(a){ translateAttr(node, a); });
    if (node.nodeName === 'INPUT' && node.type === 'text') translateAttr(node, 'value');
    if (node.nodeName === 'META' && node.name === 'description') translateAttr(node, 'content');
    if (node.hasAttribute('data-keywords') && !(done && done.has(node))) {
      var words = pack[node.getAttribute('data-keywords')];
      if (typeof words === 'string') node.setAttribute('data-keywords', words + ' ' + node.getAttribute('data-keywords'));
      if (done) done.add(node);
    }
    if (node.hasAttribute('data-languages')) switcher(node);
    // Text with words in bold or a link in it is translated as a whole.
    if (mixed(node)) return translateMixed(node);
    for (var c = node.firstChild; c; c = c.nextSibling) translateNode(c);
  }

  function translateAttr(el, name){
    if (!el.hasAttribute(name)) return;
    var v = el.getAttribute(name), to = translateText(v);
    to = name === 'value' ? to : digits(to);
    if (to !== v) el.setAttribute(name, to);
  }

  // Text with words in bold, a link or a line break inside it is translated
  // as a whole: "Read the code on <a>GitHub</a>." The translation keeps the
  // same elements, in the same order, and the page's own elements (with
  // their links and ids) are put back in their places.
  function mixed(el){
    if (!el || el.nodeType !== 1) return false;
    var text = false, inline = false;
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3 && /\S/.test(c.nodeValue)) text = true;
      else if (c.nodeType === 1) {
        if (!INLINE.test(c.nodeName)) return false;
        inline = true;
      }
    }
    return text && inline;
  }

  // Text that's part of such a whole, there or in its bold words or link.
  function inMixed(node){
    var p = node.parentNode;
    return mixed(p) || (!!p && INLINE.test(p.nodeName) && mixed(p.parentNode));
  }

  function translateMixed(el){
    if (done && done.has(el)) return;
    var key = el.innerHTML.replace(/<(\w+)[^>]*>/g, '<$1>').replace(/\s+/g, ' ').trim();
    var to = pack[key];
    if (typeof to !== 'string') { miss(el.textContent.replace(/\s+/g, ' ').trim(), true); return; }
    if (done) done.add(el);
    var own = Array.prototype.filter.call(el.childNodes, function(c){ return c.nodeType === 1; });
    var box = document.createElement('template');
    box.innerHTML = to;
    var theirs = Array.prototype.filter.call(box.content.childNodes, function(c){ return c.nodeType === 1; });
    theirs.forEach(function(their, i){
      var mine = own[i];
      if (!mine) return;
      if (!mine.firstElementChild) mine.innerHTML = their.innerHTML;
      box.content.replaceChild(mine, their);
    });
    el.textContent = '';
    el.appendChild(box.content);
    Array.prototype.forEach.call(el.childNodes, function(c){
      if (c.nodeType === 3) c.nodeValue = digits(c.nodeValue);
    });
  }

  // The links to the site in the other languages, in an element marked
  // data-languages (the top bar of most pages).
  function switcher(el){
    if (el.getAttribute('data-languages') === 'done') return;
    el.setAttribute('data-languages', 'done');
    LANGUAGES.forEach(function(l){
      if (l === current) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lang-switch';
      b.lang = l.code;
      b.setAttribute('translate', 'no');
      b.textContent = l.name;
      b.addEventListener('click', function(){ set(l.code); });
      el.appendChild(b);
    });
  }

  // Changes the language and shows the page again in it.
  function set(code){
    if (!find(code)) return;
    try { localStorage.setItem(KEY, code); } catch (e) {}
    location.reload();
  }

  function watch(){
    if (typeof MutationObserver !== 'function') return;
    var observer = new MutationObserver(function(records){
      if (!pack) return;
      records.forEach(function(r){
        if (r.type === 'attributes') {
          if (!keep(r.target)) translateAttr(r.target, r.attributeName);
        } else if (r.type === 'characterData') {
          translateNode(r.target);
        } else {
          Array.prototype.forEach.call(r.addedNodes, translateNode);
          // A paragraph with a link in it can be read in pieces.
          if (mixed(r.target) && !keep(r.target)) translateMixed(r.target);
        }
      });
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // The pack calls this as it loads.
  function load(words){
    pack = words || {};
    if (root) translateNode(root);
  }

  window.bdnixLang = {
    lang: current.code, name: current.name, languages: LANGUAGES,
    t: t, count: count, num: num, set: set, pack: load, missing: missing
  };

  if (!root || typeof document.write !== 'function') return;
  if (current.code === 'en') {
    // Nothing to translate: just the links to the other languages.
    document.addEventListener('DOMContentLoaded', function(){
      Array.prototype.forEach.call(document.querySelectorAll('[data-languages]'), switcher);
    });
    return;
  }
  root.lang = current.code;
  watch();
  // Loaded before the rest of the page, so the page's own scripts find it.
  if (current.style) document.write('<link rel="stylesheet" href="' + current.style + '">');
  // A module's page has a pack of its own, named on this script's tag with
  // {code} for the language (tools/languages.mjs); the others have the pack
  // with every translation. Only a path of the site's own, of the shape the
  // build writes, is taken, and it's escaped before it's written.
  var own = document.currentScript && document.currentScript.getAttribute('data-pack');
  var file = own && /^\/([a-z0-9-]+\/)*lang\/\{code\}\.js\?v=[0-9a-f]{10}$/.test(own) ? own.replace('{code}', current.code) : current.file;
  if (file) document.write('<script src="' + file.replace(/[&<>"']/g, function(c){ return '&#' + c.charCodeAt(0) + ';'; }) + '"></script>');
  document.addEventListener('DOMContentLoaded', function(){
    loading = false;
    // No pack (it didn't load): the page stays in English.
    if (!pack) root.lang = 'en';
    // Once more over the whole page, now it's all there.
    else translateNode(root);
  });
})();
