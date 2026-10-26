import * as bits from './streetbits.js';
export default async function (v, name) {
  if (name === 'corolla') bits.platesOnModel(v, 'গ', /^Cube00[23]/, /010/);
  if (name === 'yaris') bits.plates(v, 'গ', [{ y: 0.462, end: -1, w: 0.47, h: 0.15 }]);
}
