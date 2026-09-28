// Makes sure the latest commit on master was tested and deployed.
//
// A push to master should start the Tests workflow and GitHub Pages' "pages
// build and deployment". Now and then GitHub drops the push event and
// neither starts, so the commit never gets its coverage report and the site
// isn't updated. The Master watch workflow runs this after every merged pull
// request, and on a schedule in case that event is lost too.
//
// It waits a few minutes for the runs a push would start for master's head
// commit. For each that still hasn't appeared, it starts the Tests workflow
// by hand and asks Pages for a build. Nothing is started twice: a run from
// any event counts, including one this script started earlier.
//
//   GITHUB_TOKEN=... GITHUB_REPOSITORY=bdnix/bdnix node scripts/master-watch.mjs
//
// WATCH_WAIT (seconds, default 300) is how long to wait for the runs;
// WATCH_WAIT=0 checks once. WATCH_DRY_RUN=1 only reports.
import { fileURLToPath } from 'node:url';

export const BRANCH = 'master';
export const TESTS = '.github/workflows/tests.yml';
// Pages' own workflow, run for each deployment of a branch-based site.
export const PAGES = 'dynamic/pages/pages-build-deployment';

// Which of the runs a push to master starts are missing for a commit, given
// the workflow runs GitHub has for it.
export function missing(runs){
  const paths = runs.map((r) => r.path);
  return {
    tests: !paths.includes(TESTS),
    pages: !paths.includes(PAGES)
  };
}

// Calls the GitHub REST API. Returns the parsed JSON, or null for an empty
// reply; throws on an HTTP error.
export function client({ token, repo, fetch = globalThis.fetch }){
  return async function api(method, route, body){
    const res = await fetch(`https://api.github.com/repos/${repo}${route}`, {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${route}: ${res.status} ${text}`);
    return text ? JSON.parse(text) : null;
  };
}

export async function watch({ api, wait = 300, every = 30, dryRun = false, sleep = delay, log = console.log }){
  const head = (await api('GET', `/branches/${BRANCH}`)).commit.sha;
  log(`${BRANCH} is at ${head}.`);

  let gone;
  for (let waited = 0; ; waited += every) {
    const { workflow_runs: runs } = await api('GET', `/actions/runs?head_sha=${head}&per_page=100`);
    gone = missing(runs);
    if ((!gone.tests && !gone.pages) || waited >= wait) break;
    await sleep(every);
  }

  const started = [];
  if (gone.tests) {
    log('No Tests run for it: starting one.');
    if (!dryRun) await api('POST', `/actions/workflows/${TESTS.split('/').pop()}/dispatches`, { ref: BRANCH });
    started.push('tests');
  }
  if (gone.pages) {
    log('No Pages build for it: asking for one.');
    if (!dryRun) await api('POST', '/pages/builds');
    started.push('pages');
  }
  if (!started.length) log('It was tested and deployed. Nothing to do.');
  return { head, started };
}

function delay(seconds){
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = process.env;
  const api = client({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPOSITORY });
  const wait = env.WATCH_WAIT ? Number(env.WATCH_WAIT) : undefined;
  watch({ api, wait, dryRun: env.WATCH_DRY_RUN === '1' }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
