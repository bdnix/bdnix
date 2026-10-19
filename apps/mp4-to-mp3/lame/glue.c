/* The calls the audio converter makes to LAME, built to WebAssembly by
   build.mjs. One encoder at a time: enc_init() starts it, the page writes
   samples into the buffers enc_left() and enc_right() point to, and
   enc_encode() and enc_flush() leave MP3 bytes at enc_out(). */
#include <stdlib.h>
#include "lame.h"

static lame_global_flags *flags;
static float *left, *right;
static unsigned char *out;
static int outSize;

/* Starts an encoder for constant-bitrate MP3 at quality 3, as lamejs made
   them, with no bit reservoir, so that every frame stands alone and
   pieces encoded apart can be joined, and with no tags. The buffers hold
   up to `samples` samples a channel. Returns the MP3's sample rate (LAME
   lowers it for stereo at low bitrates), or 0 if LAME refuses the
   settings. */
int enc_init(int channels, int rate, int kbps, int samples){
  if (flags) lame_close(flags);
  flags = lame_init();
  if (!flags) return 0;
  lame_set_num_channels(flags, channels);
  lame_set_in_samplerate(flags, rate);
  lame_set_brate(flags, kbps);
  lame_set_mode(flags, channels == 1 ? MONO : STEREO);
  lame_set_quality(flags, 3);
  lame_set_disable_reservoir(flags, 1);
  lame_set_bWriteVbrTag(flags, 0);
  lame_set_write_id3tag_automatic(flags, 0);
  if (lame_init_params(flags) < 0) return 0;
  free(left);
  free(right);
  free(out);
  left = malloc(samples * sizeof(float));
  right = malloc(samples * sizeof(float));
  outSize = samples * 5 / 4 + 7200;
  out = malloc(outSize);
  if (!left || !right || !out) return 0;
  return lame_get_out_samplerate(flags);
}

float *enc_left(void){ return left; }
float *enc_right(void){ return right; }
unsigned char *enc_out(void){ return out; }

/* Encodes the first n samples of the buffers (samples from -1 to 1).
   Returns how many MP3 bytes it left at enc_out(), or a negative LAME
   error. */
int enc_encode(int n){
  return lame_encode_buffer_ieee_float(flags, left, lame_get_num_channels(flags) > 1 ? right : left, n, out, outSize);
}

/* Finishes the MP3: the last frames, at enc_out(). */
int enc_flush(void){
  return lame_encode_flush(flags, out, outSize);
}
