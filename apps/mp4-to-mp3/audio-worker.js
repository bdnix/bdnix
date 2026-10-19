// Encodes pieces of a recording to MP3 for the audio converter, away from
// the page, so that several workers can each take a piece at the same time.
// audio.js names the scripts to load (audio-core.js and lamejs) first; each
// message after that is a piece from bdnixAudio.splitter(), answered with
// { index, bytes }, { index, error } or, if the scripts didn't load,
// { index, unloaded: true }.
/* global importScripts */
(function(){
  var loaded = false, encode = null;
  self.onmessage = function(e){
    var d = e.data, bytes;
    if (d.load) {
      // audio-core.js sets window.bdnixAudio.
      self.window = self;
      try {
        importScripts.apply(self, d.load);
        loaded = true;
      } catch (err) {}
      return;
    }
    if (!loaded) {
      self.postMessage({ index: d.index, unloaded: true });
      return;
    }
    try {
      if (!encode) encode = self.bdnixAudio.pieceEncoder(self.lamejs);
      bytes = encode(d);
    } catch (err) {
      self.postMessage({ index: d.index, error: err && err.message ? err.message : String(err) });
      return;
    }
    self.postMessage({ index: d.index, bytes: bytes }, [bytes.buffer]);
  };
})();
