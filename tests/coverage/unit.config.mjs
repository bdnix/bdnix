// `npm run coverage:unit`: node --test under mcr, which collects V8
// coverage from every process it starts.
import { suite } from './shared.mjs';

export default {
  ...suite('unit'),
  entryFilter: (entry) => /\/assets\/js\/[\w-]+\.js$/.test(entry.url)
};
