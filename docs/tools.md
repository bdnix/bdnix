# Tools guide

Every tool runs entirely in the browser. Files are never uploaded, and all processing happens on the visitor's device.

- [Merge PDFs](#merge-pdfs)
- [Watermark PDF](#watermark-pdf)
- [Redact PDF](#redact-pdf)
- [MP4 to MP3](#mp4-to-mp3)
- [Compress Images](#compress-images)
- [Photo Collage](#photo-collage)
- [Fit to Frame](#fit-to-frame)

## Merge PDFs

`/merge-pdf/`

Add PDFs by dropping them on the page or choosing them. Reorder them by dragging or with the arrow buttons, then merge and download `merged.pdf`.

Each file has a **Pages** box. Leave it empty to include every page, or list pages and ranges separated by commas, for example `1-3, 5, 8-`:

| Entry | Meaning |
|---|---|
| `5` | Page 5 |
| `1-3` | Pages 1 to 3 |
| `8-` | Page 8 to the end |
| `-3` | Pages 1 to 3 |
| `5-3` | Pages 5, 4, 3, in that order |

Pages come out in the order they are listed. Password-protected PDFs are skipped with a message. Merging uses [pdf-lib](https://pdf-lib.js.org/).

## Watermark PDF

`/watermark-pdf/`

Open one PDF, then set up the watermark while a live preview shows it on the pages (use the arrows to flip through them).

- **Text or image.** Text can use Helvetica, Times or Courier (each with bold and italic), or a `.ttf` / `.otf` font file, in any colour. Text the chosen font can't show properly (non-Latin letters in the built-in fonts, or scripts such as Bangla and Arabic that need their letters joined) is drawn as an image instead, so any language works. An uploaded font is embedded in full, which adds its file size to the PDF. Images can be PNG, JPG, WebP or GIF, and transparency is kept.
- **Size** is the watermark's width as a share of the page's shorter side, so it looks the same on A4, Letter or landscape pages.
- **Opacity**, **rotation** (−90° to 90°, with quick buttons) and **position** on a 3×3 grid, or **Repeat across the page** to tile it.
- **Layer:** on top of the page, or behind its content so text stays readable over the watermark. Behind only shows through blank parts of the page, so it won't show on scanned pages (which are one large picture) or pages with a solid background.
- **Pages** takes the same ranges as the merger. Empty means every page.

Settings are remembered for next time: the options in `localStorage`, and the chosen image and font file in IndexedDB. The page list isn't remembered, since it belongs to one file. **Reset to defaults** clears everything.

Rotated pages are handled, so the watermark sits the same way on every page as the reader sees it. The download is named after the original, for example `report-watermarked.pdf`.

## Redact PDF

`/redact-pdf/`

Open one PDF, then mark what to black out:

- **Find text** marks every place a word or phrase appears, on every page. Capitals and the spacing between words don't matter, so `jane doe` also finds `Jane  Doe`. If there's no match on the current page, the preview jumps to the first one. Search only reads real text, so it also lists the pages that contain pictures, where any words need a box drawn over them.
- **Draw** by dragging across the page (mouse, pen or finger) to cover anything else: signatures, photos, or text on scanned pages, which have no text to search.
- Each box has a × to remove it. **Undo** takes back the last search or box, and **Clear all** starts over.

**Redact PDF** creates the file. Every page with a mark is redrawn as an image (144 dpi) with the marked areas filled solid black, so the text underneath is genuinely gone: it can't be selected, copied or uncovered by moving the box. The remaining text on those pages can't be selected either. Pages with no marks are copied unchanged. The result is a new file, so the original's title, author, bookmarks and attachments aren't carried over. The download is named after the original, for example `report-redacted.pdf`.

Search positions boxes from the PDF's own text, estimating where each letter sits, so boxes are padded slightly. Check the marks in the preview before redacting, and draw extra boxes if anything shows through.

## MP4 to MP3

`/mp4-to-mp3/`

Drop in videos or audio files (MP4, MOV, WebM, M4A, MKV, WAV, FLAC, Ogg, MP3 and similar), choose the output, and convert:

- **Convert to** MP3 or WAV (16-bit, uncompressed).
- **Quality** for MP3: 320, 256, 192 (default), 128, 96 or 64 kbps. At 96 kbps and below the encoder lowers a stereo file's sample rate, as LAME always does, to keep the sound clean.
- **Channels:** stereo keeps the left and right channels (the front pair of a surround file); mono mixes every channel into one. A mono file stays mono.

Several files can be converted at once, and each gets its own download named after the original (`clip.mp4` becomes `clip.mp3`). Changing a setting clears earlier results so they can be converted again.

The browser decodes the audio itself and [lamejs](https://github.com/zhuker/lamejs) encodes the MP3, so the formats supported depend on the browser. A file whose audio the browser can't decode is marked in the list with a message.

### Memory use and long recordings

MP4, MOV and M4A files (what phones record) are converted a piece at a time, so memory use doesn't grow with the length of the recording. Only the file's index and its audio are read, never the video; the audio is decoded with WebCodecs and encoded as it arrives, keeping its own sample rate and following the file's edit list (which trims AAC's encoder warm-up). Only the finished file is held in memory: about 1.4 MB per minute as a 192 kbps MP3, or 10.6 MB per minute as a stereo WAV.

Other formats (WebM, MKV, MP3, WAV, FLAC, Ogg), codecs the browser can't decode through WebCodecs, and browsers without WebCodecs' `AudioDecoder` (Safari before 26) are decoded whole instead and resampled to 44.1 kHz. That needs about 21 MB of memory per minute of stereo sound, so very long recordings may be too large for a phone. A browser that can't decode AAC this way shows a warning that videos over about 15 minutes may make the page reload, with how to update (iOS 26 or later on iPhone and iPad, the latest Chrome on Android). The check is based on what the browser can do, not on which device it is.

## Compress Images

`/compress-image/`

Drop in photos or other images (JPEG, PNG, WebP, GIF, BMP, AVIF, and HEIC where the browser can open it), choose the settings, and compress:

- **Save as:** the same format as the original (JPEG, PNG and WebP stay as they are; any other format becomes JPEG), or all as JPEG, WebP or PNG. Transparent areas turn white in a JPEG, which has no transparency.
- **Quality** for JPEG and WebP: 10 to 100%, 75% by default. PNG is lossless, so quality doesn't apply; the slider is hidden, or a note appears when some images in the list will be saved as PNG.
- **Longest side:** keep the original size, or scale down to 3840, 2560, 1920, 1280, 800 or 480 px, keeping the proportions. Images are never enlarged.

Several images can be compressed at once, and each gets its own download named after the original (`photo.png` saved as JPEG becomes `photo-compressed.jpg`, so it doesn't replace the original). Each row shows the new dimensions and file size and how much smaller it is, and the message under the drop zone shows the total. Changing a setting clears earlier results so they can be compressed again.

The browser decodes each image (turning phone photos upright) and a canvas saves it again, so the hidden details a camera stores (location, camera model, date) aren't carried over. If the result is no smaller than the original, in the same format and at the same size, the original is returned unchanged. Images larger than 16.7 megapixels (4096 × 4096) are scaled down to fit, because iPhones and iPads can't draw larger canvases. An image the browser can't open, or a format it can't save (Safari can't save WebP), is marked in the list with a message.

## Photo Collage

`/photo-collage/`

Drop in 3, 6 or 9 photos (any image the browser can open, as for [Compress Images](#compress-images)), pick a layout and style, and download the collage. With any other number of photos the preview says how many to add or remove, for example "Add 2 more for a collage of 6, or remove 1 for a collage of 3". A collage holds 9 photos at most; any more dropped at once are left out, with a message.

Layouts:

| Photos | Layouts |
|---|---|
| 3 | Side by side, Stacked, Big left, Big top |
| 6 | Grid 3 across, Grid 2 across, Feature (one big photo with five around it), Steps (rows of 1, 2 and 3), Columns (2 beside 4) |
| 9 | Grid, Feature (one big photo with eight around it), Steps (rows of 2, 3 and 4), Mosaic |

Settings:

- **Shape:** square 1:1, portrait 4:5 (social media feeds), story 9:16 (a phone screen), landscape 3:2 (photo prints) or widescreen 16:9.
- **Spacing** between the photos and around the edge, and **Corners** to round each photo. Both are shown in pixels at the chosen size and scale with it, so the preview looks the same as the download.
- **Background:** the colour behind the photos, white by default.
- **Size:** the longest side, 1080, 2048 (default) or 4096 px. The exact size is shown under the settings.
- **Save as** JPEG (quality 92%) or PNG. The file is `collage.jpg` or `collage.png`.

Photos fill the layout in the order listed under the preview. Tap one photo, in the list or in the preview, then another to swap them; tap it again to cancel. Each photo is cropped from its middle to fill its space, without stretching. The layout chosen for each number of photos is remembered while the page is open.

The preview draws small copies of the photos, so moving a slider stays quick. The download decodes the photos again one at a time at full size, so nine phone photos aren't all held in memory at once. As with Compress Images, the browser turns phone photos upright and a camera's hidden details (location, camera model, date) aren't carried over. A photo the browser can't open is taken off the list, with a message.

## Fit to Frame

`/fit-to-frame/`

Makes an image fit a shape it doesn't have, such as a landscape photo for a square or 4:5 post, without cropping any of it: the whole image stays in the middle and space is added to its sides or to its top and bottom. Drop in one or more images (the same formats as Compress Images), choose the settings, and fit:

- **Shape:** Square 1:1 (1080 × 1080), Portrait 4:5 (1080 × 1350), Story 9:16 (1080 × 1920), Landscape 1.91:1 (1200 × 630), Widescreen 16:9 (1920 × 1080) or Tall 2:3 (1000 × 1500), or any **width** and **height** from 1 to 10000 px. Choosing a shape fills in its size; typing a size picks the shape it matches, or Custom. A size that isn't a whole number in range is marked and nothing can be fitted until it's fixed.
- **Size:** *Keep full size* (the default) leaves the image at its own size and adds only the space the shape needs. *Exactly W × H* makes the result exactly the size typed, scaling the image up or down to fit.
- **Colour** of the space: white (the default), black, light grey, or any colour from the browser's colour picker. Transparent parts of an image take this colour too.
- **Margin:** 0 to 25% of the frame's shorter side, added on every side of the image.
- **Save as:** the same format as the original (any format other than JPEG, PNG or WebP becomes JPEG), or JPEG, WebP or PNG. JPEG and WebP are saved at 92% quality.

The preview shows the chosen image with the current settings and the size in pixels of the result; with several images, the arrows or a click on a thumbnail pick which one. Each image gets its own download (`photo.png` becomes `photo-framed.png`). Changing a setting clears earlier results. As with Compress Images, the saved images don't carry the camera's hidden details, frames bigger than 16.7 megapixels are scaled down so iPhones and iPads can draw them, and an image the browser can't open or a format it can't save is marked in the list. The placement rules live in `assets/js/frame-core.js`.
