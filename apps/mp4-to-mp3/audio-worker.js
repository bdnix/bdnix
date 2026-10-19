// Encodes pieces of a recording to MP3 for the audio converter, away from
// the page, so that several workers can each take a piece at the same time.
// audio.js first sends what to load: the version of audio-core.js (the
// build's stamp), which the worker loads from its own place, and LAME's
// compiled WebAssembly module. Each message after that is a
// piece from bdnixAudio.splitter(), answered in turn with { index, bytes },
// { index, error } or, if LAME didn't load, { index, unloaded: true }.
/* global importScripts */
(function(){
  // Pieces wait their turn behind LAME starting up.
  var ready = Promise.resolve(null);
  self.onmessage = function(e){
    var d = e.data;
    if (d.load) {
      ready = new Promise(function(resolve){
        // audio-core.js sets window.bdnixAudio.
        self.window = self;
        importScripts('/assets/js/audio-core.js' + (d.core ? '?v=' + encodeURIComponent(d.core) : ''));
        resolve(self.bdnixAudio.lame(d.lame));
      }).then(function(enc){ return self.bdnixAudio.pieceEncoder(enc); }, function(){ return null; });
      return;
    }
    ready.then(function(encode){
      var bytes;
      if (!encode) {
        self.postMessage({ index: d.index, unloaded: true });
        return;
      }
      try {
        bytes = encode(d);
      } catch (err) {
        self.postMessage({ index: d.index, error: err && err.message ? err.message : String(err) });
        return;
      }
      self.postMessage({ index: d.index, bytes: bytes }, [bytes.buffer]);
    });
  };
})();
