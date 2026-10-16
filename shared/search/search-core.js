// Landing page search: which games and tools match what the visitor typed,
// kept apart from the page so it can be unit tested. main.js shows and hides
// the cards.
(function(){
  // Lower case, accents dropped and anything that isn't a letter or digit
  // turned into a space, so "Café-PDF" and "cafe pdf" read the same. Bangla
  // letters count as letters, Bangla digits read as 0-9 (so "৩" finds "3"),
  // and the invisible joiners Bangla text may carry are dropped.
  function fold(text){
    return String(text == null ? '' : text)
      .normalize('NFD').replace(/[\u0300-\u036f\u200c\u200d]/g, '')
      .replace(/[\u09e6-\u09ef]/g, function(d){ return String(d.charCodeAt(0) - 0x09e6); })
      .toLowerCase()
      .replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ')
      .trim();
  }

  // The words of a search, without repeats. A final "s" is dropped so a
  // plural finds the singular ("games" finds "game"); since a word only has
  // to start a word of the text, "bricks" still finds "bricks".
  function terms(query){
    var words = fold(query).split(' '), out = [];
    for (var i = 0; i < words.length; i++) {
      var word = words[i].length > 2 ? words[i].replace(/s$/, '') : words[i];
      if (word && out.indexOf(word) < 0) out.push(word);
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
