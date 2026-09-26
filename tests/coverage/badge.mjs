// The README's coverage badge, as a shields.io endpoint
// (https://shields.io/badges/endpoint-badge). report.config.mjs writes it to
// coverage/report/coverage-badge.json, and CI publishes it to the `badges`
// branch after every push to master.

// Line coverage as a percentage, e.g. 87.25.
export function badge(pct){
  if (typeof pct !== 'number' || !isFinite(pct) || pct < 0 || pct > 100) throw new RangeError('Coverage must be a percentage: ' + pct);
  // Round down, so 99.96% never shows as 100%.
  const shown = Math.floor(pct * 10) / 10;
  const color = pct >= 90 ? 'brightgreen' : pct >= 80 ? 'green' : pct >= 70 ? 'yellowgreen' : pct >= 60 ? 'yellow' : pct >= 50 ? 'orange' : 'red';
  return { schemaVersion: 1, label: 'coverage', message: shown + '%', color };
}
