/**
 * Pin watchdog for the two Carve dependencies this editor installs.
 *
 * The editor consumes carve-grammars' Tiptap kit and carve-js' parser through
 * version/commit pins, so a pin that stops moving is the one way this app can
 * fall behind the language without any local file changing. The previous check
 * compared the declared spec string with the locked version and errored on the
 * first dependency, because `^0.1.2` never equals `0.1.2`; it therefore never
 * reached the grammar pin it was meant to watch.
 *
 * What this checks instead:
 *
 * 1. A `github:owner/repo#sha` pin must match the lockfile's resolved commit.
 * 2. That commit must be on the repository's default branch. Pinning an
 *    unmerged branch build silently reverts everything that landed after it.
 * 3. The spec revision the pinned carve-grammars build was written against is
 *    compared with the spec revision of the carve-js build this editor
 *    installs. A grammar that predates the engine cannot represent what the
 *    engine parses. Whether that gap FAILS the check depends on whose engine it
 *    is, decided from the installed revisions: when the lockfile's engine is
 *    the exact commit carve-grammars pins for its own loader, it was hoisted
 *    out of carve-grammars and nothing here can move it, so the finding is a
 *    warning naming the repository that can. Any other engine is one this repo
 *    installed, and pairing it with an older grammar fails.
 *
 * Usage: node scripts/check-carve-pins.mjs [package-dir]
 * Reads package.json and package-lock.json from <package-dir> (default: cwd).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SPEC_REPO = 'markup-carve/carve';
const GRAMMARS = '@markup-carve/carve-grammars';
const ENGINE = '@markup-carve/carve';

const dir = process.argv[2] ?? process.cwd();
const readJson = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));

const errors = [];
const warnings = [];
const notes = [];

/** GitHub REST call. The token is optional; public repositories answer without one. */
async function api(path) {
  const headers = { accept: 'application/vnd.github+json' };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GET ${path} -> ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/** `github:owner/repo#sha` -> { repo, sha }; anything else -> null. */
function parseGitPin(spec) {
  const match = /^(?:github:|git\+ssh:\/\/git@github\.com\/|git\+https:\/\/github\.com\/)([^/]+\/[^#]+?)(?:\.git)?#([0-9a-f]{40})$/.exec(spec ?? '');
  return match ? { repo: match[1], sha: match[2] } : null;
}

/** The commit a lockfile entry resolved to, when it resolved to a git build. */
function lockedCommit(lock, name) {
  return parseGitPin(lock.packages?.[`node_modules/${name}`]?.resolved ?? '');
}

/** A repository's package.json at a given ref, parsed. */
async function packageJsonAt(repo, ref) {
  const entry = await api(`/repos/${repo}/contents/package.json?ref=${ref}`);
  return JSON.parse(Buffer.from(entry.content, entry.encoding).toString('utf8'));
}

/** The submodule commit a repository records at `path` for a given ref. */
async function submoduleSha(repo, ref, path) {
  const entry = await api(`/repos/${repo}/contents/${path}?ref=${ref}`);
  if (entry.type !== 'submodule') throw new Error(`${repo}@${ref}:${path} is not a submodule`);
  return entry.sha;
}

/** How `head` stands relative to `base`, in the given repository. */
async function compare(repo, base, head) {
  return api(`/repos/${repo}/compare/${base}...${head}`);
}

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');

const declaredGrammars = pkg.dependencies?.[GRAMMARS] ?? '';
const grammarsPin = parseGitPin(declaredGrammars);
const grammarsLocked = lockedCommit(lock, GRAMMARS);

if (!grammarsPin) {
  // Skipping here would make every check below unreachable by editing one
  // line of package.json, which is the shape of drift this script exists to
  // catch. A published tarball records no spec revision, so a version spec
  // cannot be checked for staleness at all - relaxing this has to be a
  // deliberate edit to this file, not a silent pass.
  errors.push(
    `${GRAMMARS} is declared as "${declaredGrammars}", which is not a github:owner/repo#<40-hex> commit pin. ` +
      'A published version records no spec revision, so nothing below can be verified.',
  );
} else if (!grammarsLocked || grammarsLocked.sha !== grammarsPin.sha) {
  errors.push(
    `${GRAMMARS}: package.json pins ${grammarsPin.sha}, the lockfile installs ${grammarsLocked?.sha ?? 'a non-git build'}.`,
  );
} else {
  const repo = grammarsPin.repo;
  const { default_branch: branch } = await api(`/repos/${repo}`);
  const range = await compare(repo, grammarsPin.sha, branch);
  if (range.status === 'diverged' || range.behind_by > 0) {
    errors.push(
      `${GRAMMARS}: ${grammarsPin.sha.slice(0, 12)} is not on ${repo}'s ${branch} ` +
        `(status ${range.status}, ${range.behind_by} commit(s) that ${branch} does not have). ` +
        'Pin a merged commit; a branch build reverts whatever landed after it.',
    );
  } else if (range.ahead_by > 0) {
    warnings.push(
      `${GRAMMARS}: ${branch} is ${range.ahead_by} commit(s) ahead of the pin ${grammarsPin.sha.slice(0, 12)}.`,
    );
  } else {
    notes.push(`${GRAMMARS}: pinned at ${branch} head ${grammarsPin.sha.slice(0, 12)}.`);
  }
}

const engineLocked = lockedCommit(lock, ENGINE);
if (!engineLocked) {
  notes.push(`${ENGINE} did not resolve to a git build; the spec-freshness check needs a commit on both sides and is skipped.`);
} else if (grammarsPin && grammarsLocked && grammarsLocked.sha === grammarsPin.sha) {
  const grammarsSpec = await submoduleSha(grammarsPin.repo, grammarsPin.sha, 'spec');
  const engineSpec = await submoduleSha(engineLocked.repo, engineLocked.sha, 'spec');
  if (grammarsSpec === engineSpec) {
    notes.push(`spec revision: grammar and engine are both at ${grammarsSpec.slice(0, 12)}.`);
  } else {
    const range = await compare(SPEC_REPO, grammarsSpec, engineSpec);
    if (range.ahead_by > 0) {
      // WHOSE engine this is decides whether the gap is this repo's to close,
      // and that is settled from the INSTALLED revisions rather than from how
      // package.json happens to spell the dependency. carve-grammars pins the
      // engine its own loader calls to an exact commit; when the lockfile's
      // engine IS that commit, it was hoisted out of carve-grammars and nothing
      // in this repository can move it. The only lever would be rolling the
      // grammar pin back, which gives up every fix that landed after it.
      //
      // The gap is not a hazard this repo can create either way: the app hands
      // carve-grammars SOURCE, not an AST. `carveToProseMirror(source)` parses
      // with the engine carve-grammars nests, and the app's own engine is used
      // only for the preview HTML, which never touches the grammar.
      //
      // So the same finding is reported either way and blocks only where it can
      // be acted on. A grammar whose spec revision trails the engine it bundles
      // is the normal state right after that engine is bumped, and it is
      // carve-grammars' own promotion gate that closes it.
      const grammarsOwnEngine = parseGitPin(
        (await packageJsonAt(grammarsPin.repo, grammarsPin.sha)).dependencies?.[ENGINE],
      );
      const message =
        `${GRAMMARS} is pinned to a build written against spec ${grammarsSpec.slice(0, 12)}, ` +
        `which is ${range.ahead_by} commit(s) behind the spec ${engineSpec.slice(0, 12)} that the installed ` +
        `${ENGINE} build was written against. The grammar cannot represent what the engine parses.`;
      if (grammarsOwnEngine?.sha === engineLocked.sha) {
        warnings.push(
          `${message} The installed engine is ${engineLocked.sha.slice(0, 12)}, the commit ${GRAMMARS} pins ` +
            'for its own loader, so closing the gap is a carve-grammars change and not one this repository can make.',
        );
      } else {
        errors.push(message);
      }
    } else {
      // The other direction is not an error here: the editor cannot move the
      // engine that carve-grammars installs for its own loader, because that
      // dependency is pinned to an exact commit inside carve-grammars. It is
      // still the number to look at when a production the grammar knows about
      // does not survive an import, so it is reported rather than buried.
      warnings.push(
        `the installed ${ENGINE} build was written against spec ${engineSpec.slice(0, 12)}, ` +
          `${range.behind_by} commit(s) behind the spec ${grammarsSpec.slice(0, 12)} of the pinned grammar. ` +
          'Productions newer than the engine parse as literal text on import.',
      );
    }
  }
}

for (const note of notes) console.log(note);
for (const warning of warnings) console.log(`::warning::${warning}`);
for (const error of errors) console.log(`::error::${error}`);
process.exit(errors.length ? 1 : 0);
