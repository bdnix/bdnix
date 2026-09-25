// `npm run coverage:unit`: node --test under mcr, which collects V8
// coverage from every process it starts. The unit tests load each script
// twice (source and .min.js); only the source copy is counted.
import { report } from './shared.mjs';

export default {
  ...report('unit'),
  entryFilter: (entry) => /\/assets\/js\/[\w-]+\.js$/.test(entry.url) && !entry.url.endsWith('.min.js')
};
