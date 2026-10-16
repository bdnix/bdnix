// `npm run coverage:unit`: node --test under mcr, which collects V8
// coverage from every process it starts.
import { suite } from './shared.mjs';

export default {
  ...suite('unit'),
  entryFilter: (entry) => /\/(assets\/js|(apps|shared|site)\/[\w-]+)\/[\w-]+\.js$/.test(entry.url)
};
