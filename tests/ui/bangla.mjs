// For the tests of pages in Bangla (under /bn/): what's left in English.
import { expect } from './fixtures.mjs';

// Words that stay in Latin letters on a Bangla page: names, formats and the
// like. A test passes the file names it used, too.
const ALLOWED = ['bdnix', 'PDF', 'GitHub', 'root@bdnix.com', 'PNG', 'JPG', 'WAV', 'MP3', 'MP4', 'KB', 'MB', 'B',
  'ttf', 'otf', 'pdf', 'Helvetica', 'Times', 'Courier', 'I', 'English', 'AES', 'RC4', 'bit', 'Delete', 'Stockfish'];

// The English words in what the page shows (its text, and the names of its
// controls), leaving out the allowed ones and the page's address beside the
// wordmark. Expects none.
export async function expectNoEnglish(page, also = []){
  const found = await page.evaluate((allowed) => {
    const shown = (el) => el.getClientRects().length > 0;
    const parts = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const el = n.parentElement;
      if (!el || !shown(el) || el.closest('script, style, .wordmark, [lang="en"]')) continue;
      parts.push(n.nodeValue);
    }
    document.querySelectorAll('[aria-label], [title], [placeholder]').forEach((el) => {
      if (!shown(el) || el.closest('[lang="en"]')) return;
      ['aria-label', 'title', 'placeholder'].forEach((a) => { if (el.hasAttribute(a)) parts.push(el.getAttribute(a)); });
    });
    const text = parts.join(' ');
    return (text.match(/[A-Za-z][A-Za-z0-9@.-]*/g) || []).map((w) => w.replace(/[.-]+$/, '')).filter((w) => !allowed.includes(w));
  }, ALLOWED.concat(also, also.flatMap((name) => name.split(/[^A-Za-z0-9@]+/)).filter(Boolean)));
  expect(found, 'English left on the page').toEqual([]);
}
