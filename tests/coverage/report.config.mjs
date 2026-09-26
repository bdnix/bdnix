// `npm run coverage:report`: combines the unit and UI test coverage into
// one browsable report, coverage/report/index.html, with every line
// highlighted, plus a per-file table in the log. For local use; CI uploads
// each suite to Codecov instead, which combines them the same way.
// A line counts as covered if either suite runs it. Scripts no test loads
// still appear, at 0%, so they count against the total.
import { sourcePath, sourceFilter } from './shared.mjs';

export default {
  name: 'bdnix test coverage',
  inputDir: ['coverage/unit/raw', 'coverage/ui/raw'],
  outputDir: 'coverage/report',
  reports: ['v8', 'console-details'],
  all: { dir: ['assets/js'], filter: '**/*.js' },
  sourcePath,
  sourceFilter
};
