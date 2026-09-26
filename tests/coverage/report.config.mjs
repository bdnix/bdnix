// `npm run coverage:report`: combines the unit and UI test coverage into
// one report in coverage/report:
//   cobertura-coverage.xml  uploaded to GitHub (see .github/workflows/tests.yml)
//   index.html              browsable report, every line highlighted
//   lcov.info               for other tools
//   coverage-details.md     the table in the GitHub job summary
// A line counts as covered if either suite runs it. Scripts no test loads
// still appear, at 0%, so they count against the total.
import { sourcePath, sourceFilter } from './shared.mjs';

export default {
  name: 'bdnix test coverage',
  inputDir: ['coverage/unit/raw', 'coverage/ui/raw'],
  outputDir: 'coverage/report',
  reports: [
    'v8',
    'cobertura',
    'lcovonly',
    'console-details',
    ['markdown-details', { baseUrl: '', color: 'Unicode' }]
  ],
  all: { dir: ['assets/js'], filter: '**/*.js' },
  sourcePath,
  sourceFilter
};
