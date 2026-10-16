// How scripts/ui-cache.mjs shares the UI specs that need to run between the
// machines CI runs them on.

// The specs each machine runs: those that need to run, shared out by how long
// each last took (longest first, each to the least loaded machine), so the
// machines take about as long as each other. A spec that has never passed
// counts as 30 seconds.
export function share(run, durations, count){
  const ms = (spec) => durations[spec] || 30000;
  const bins = Array.from({ length: count }, () => ({ ms: 0, specs: [] }));
  const order = [...run].sort((a, b) => ms(b) - ms(a) || a.localeCompare(b));
  for (const spec of order) {
    const bin = bins.reduce((min, b) => (b.ms < min.ms ? b : min));
    bin.specs.push(spec);
    bin.ms += ms(spec);
  }
  return bins.map((b) => b.specs.sort());
}
