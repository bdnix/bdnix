// Every file the site makes downloads in a new window (bdnixFiles in
// assets/js/files.js), so a browser that shows the file rather than saving
// it leaves the tool where it was. inNewWindow() runs trigger(), which should
// open that window, and waits for the file to download there. It checks the
// window names the file and links to it, and that the tool's own page stayed
// put. Returns the download and the window.
export async function inNewWindow(page, trigger){
  const at = page.url();
  let popup;
  const download = new Promise((resolve) => {
    page.once('popup', (p) => { popup = p; p.once('download', resolve); });
  });
  await trigger();
  const dl = await download;
  const name = dl.suggestedFilename();
  const heading = await popup.locator('h1').textContent();
  const link = await popup.locator('a[download]').getAttribute('download');
  if (heading !== name || link !== name) throw new Error(`the new window shows "${heading}" and links to "${link}", not ${name}`);
  if (page.url() !== at) throw new Error(`the tool's page went to ${page.url()}`);
  return { download: dl, popup };
}
