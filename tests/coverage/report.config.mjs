// `npm run coverage:report`: combines the unit and UI test coverage into
// one report in coverage/report:
//   cobertura-coverage.xml  uploaded to GitHub (see .github/workflows/tests.yml)
//   index.html              browsable report, every line highlighted
//   lcov.info               for other tools
//   coverage-details.md     the table in the GitHub job summary
//   coverage-badge.json     the README's coverage badge (see badge.mjs)
// A line counts as covered if either suite runs it. Scripts no test loads
// still appear, at 0%, so they count against the total.
import fs from 'node:fs';
import path from 'node:path';
import { sourcePath, sourceFilter } from './shared.mjs';
import { badge } from './badge.mjs';

const outputDir = 'coverage/report';

export default {
  name: 'bdnix test coverage',
  inputDir: ['coverage/unit/raw', 'coverage/ui/raw'],
  outputDir,
  reports: [
    'v8',
    'cobertura',
    'lcovonly',
    'console-details',
    ['markdown-details', { baseUrl: '', color: 'Unicode' }]
  ],
  all: { dir: ['assets/js'], filter: '**/*.js' },
  sourcePath,
  sourceFilter,
  onEnd(results){
    fs.writeFileSync(path.join(outputDir, 'coverage-badge.json'), JSON.stringify(badge(results.summary.lines.pct)) + '\n');
  }
};
