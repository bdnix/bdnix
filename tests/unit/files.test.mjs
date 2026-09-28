import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';

const FILE = 'assets/js/files.js';
const { bdnixFiles: T } = load(FILE);

test('fmtSize', () => {
  assert.equal(T.fmtSize(0), '0 B');
  assert.equal(T.fmtSize(1023), '1023 B');
  assert.equal(T.fmtSize(1024), '1 KB');
  assert.equal(T.fmtSize(1536), '2 KB');
  assert.equal(T.fmtSize(1048576), '1.0 MB');
  assert.equal(T.fmtSize(5.5 * 1048576), '5.5 MB');
});

test('plural', () => {
  assert.equal(T.plural(0, 'page'), '0 pages');
  assert.equal(T.plural(1, 'page'), '1 page');
  assert.equal(T.plural(2, 'file'), '2 files');
});

test('readBytes: uses File.arrayBuffer when there is one', async () => {
  const buf = new ArrayBuffer(3);
  assert.equal(await T.readBytes({ arrayBuffer: async () => buf }), buf);
});

test('readBytes: falls back to a FileReader, and passes on its error', async () => {
  class FileReader {
    readAsArrayBuffer(file){
      setTimeout(() => {
        if (file.broken) { this.error = new Error('unreadable'); this.onerror(); }
        else { this.result = file.bytes; this.onload(); }
      });
    }
  }
  const { bdnixFiles } = load(FILE, { FileReader, setTimeout });
  const buf = new ArrayBuffer(2);
  assert.equal(await bdnixFiles.readBytes({ bytes: buf }), buf);
  await assert.rejects(bdnixFiles.readBytes({ broken: true }), /unreadable/);
});

test('onFileDrop: lights up the drop zone while files are dragged, and hands over dropped files', () => {
  const listeners = {};
  const document = { addEventListener: (type, fn) => { listeners[type] = fn; } };
  const { bdnixFiles } = load(FILE, { document });
  const classes = new Set();
  const zone = { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } };
  const got = [];
  bdnixFiles.onFileDrop(zone, (files) => got.push(files));

  let prevented = 0;
  const event = (types, files) => ({ dataTransfer: { types, files, dropEffect: '' }, preventDefault: () => { prevented++; } });
  const withFiles = () => event(['Files']);

  // Text being dragged around the page is left alone.
  listeners.dragenter(event(['text/plain']));
  listeners.dragleave(event(['text/plain']));
  listeners.dragover(event(['text/plain']));
  assert.equal(classes.has('over'), false);
  assert.equal(prevented, 0);

  // Entering a child element fires another dragenter before the dragleave.
  listeners.dragenter(withFiles());
  listeners.dragenter(withFiles());
  listeners.dragleave(withFiles());
  assert.equal(classes.has('over'), true);
  const over = withFiles();
  listeners.dragover(over);
  assert.equal(over.dataTransfer.dropEffect, 'copy');
  listeners.dragleave(withFiles());
  assert.equal(classes.has('over'), false);

  listeners.dragenter(withFiles());
  listeners.drop(event(['Files'], ['a.pdf']));
  assert.equal(classes.has('over'), false);
  assert.deepEqual(got, [['a.pdf']]);
  listeners.drop(event(['text/plain'], ['b.txt']));
  assert.equal(got.length, 1);
});

