// Landing page search: which games and tools match what the visitor typed,
// kept apart from the page so it can be unit tested. main.js shows and hides
// the cards.
(function(){
  // Lower case, accents dropped and anything that isn't a letter or digit
  // turned into a space, so "Café-PDF" and "cafe pdf" read the same.
  function fold(text){
    return String(text == null ? '' : text)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  // The words of a search, without repeats.
  function terms(query){
    var words = fold(query).split(' '), out = [];
    for (var i = 0; i < words.length; i++) {
      if (words[i] && out.indexOf(words[i]) < 0) out.push(words[i]);
    }
    return out;
  }

  // True when every word of the search starts a word of the text, so "pdf"
  // finds "Merge PDFs" and "comp im" finds "Compress Images", but "ape"
  // doesn't find "shape". An empty search matches everything.
  function matches(text, query){
    var words = terms(query);
    var hay = ' ' + fold(text);
    for (var i = 0; i < words.length; i++) {
      if (hay.indexOf(' ' + words[i]) < 0) return false;
    }
    return true;
  }

  window.bdnixSearch = { fold: fold, terms: terms, matches: matches };
})();
