# AGENTS.md

Rules for any AI agent (Claude, Codex, Cursor, Copilot) working in this repo. Read it fully before editing. `CONTRIBUTING.md` has the human-facing detail.

## What this is

GoDAM is a WordPress plugin for digital asset management: video transcoding, adaptive streaming, interactive video layers, blocks, analytics. The repo is public (`rtCamp/godam`). Never put anything private in code, comments, commits, issues or PRs.

- Plugin version and header: `godam.php` (Requires PHP 7.4, WordPress 6.5+, text domain `godam`).
- PHP: `inc/` (classes, helpers, traits, templates), `admin/`, `pages/`.
- JS/CSS: `assets/src/` (blocks, layers, js, css). Built output goes to `assets/build/`.
- Tests: `tests/php`, `tests/js`, `tests/wp-admin`, `tests/wp-cli`.
- The other GoDAM repos (Core, Analytics, godam.io, Chrome extension) are separate. Do not assume their code is here.

## Setup, build, test, lint

Node version is in `.nvmrc`. Composer and npm are both needed.

```bash
composer install && npm install
npm run build:dev          # or build:prod; npm start to watch
npm run test:unit          # JS tests (Jest via wp-scripts)
composer phpunit           # PHP unit tests
npm run lint               # css + js + php + package.json
npm run lint:php           # phpcs (phpcs.xml); lint:php:fix runs phpcbf
npm run lint:godam-hooks   # wp-dam hook balance and coverage checks
```

CI on pull requests runs: PHPCS, PHP unit tests, JS unit tests, wp-dam hook integrity, and WordPress.org Plugin Check. Run the matching command locally before pushing; do not push to find out.

## Branches and PRs

- `develop` is where work lands. `main` is the public release line. Open PRs against `develop` unless told otherwise.
- Never push to `develop` or `main`. Work on a branch (`feature/`, `fix/`, `hotfix/`, `docs/` + description) and open a PR.
- Never merge a PR, enable auto-merge, create or push a release tag, or force-push a shared branch. A human does those.
- Commits follow conventional format (`fix: ...`, `feat: ...`, `docs: ...`). Keep one concern per PR.
- Use your own git worktree for edits; do not edit another person's checkout.
- PR body: say what changed and why, and a "Where to look" section pointing the reviewer at the key files. For visible UI changes attach a screenshot or short recording.
- Add the reviewer and the risk label the maintainers ask for. Do not invent reviewers.
- If the work belongs to an umbrella or tracking issue, write `Part of #N` in the PR, never `Fixes #N` or `Closes #N`, so the umbrella does not auto-close. Use `Fixes` only for an issue this PR fully resolves.
- Do not put open questions for named people in the PR body; raise them with the person you are working for.

## Code rules

- PHP must run on 7.4: no enums, readonly properties, `match`, union types, nullsafe `?->`, named arguments, or PHP 8 functions such as `str_contains` without a polyfill. CI runs on newer PHP, so a green run does not prove 7.4 safety.
- Follow WordPress and WordPress VIP coding standards (phpcs enforces them). PHPDoc on every function and class; add `@since` for new code.
- Escape output, sanitize input, check capabilities and nonces on every REST route and admin action.
- JS follows the `@wordpress/scripts` ESLint config; CSS uses Tailwind plus BEM for custom classes.
- Do not hand-edit `assets/build/`, `vendor/`, `node_modules/`, or lock files unless the task is about them.
- `RTGODAM_API_BASE`, `RTGODAM_ANALYTICS_BASE`, `RTGODAM_IO_API_BASE` and `FRAPPE_DISPATCH_SITE_URL` in `godam.php` default to production and can be overridden with `define()` in `wp-config.php`. Change defaults only when that is the task.

## Translations (POT)

- All user-facing strings use text domain `godam` and need translator comments where there are placeholders.
- Regenerate with `npm run build:prod` first, then `composer pot` (two `wp i18n make-pot` passes: built JS, then source merged in).
- If you run `wp i18n make-pot` by hand, pass `--slug=godam` on both passes. A worktree folder is not named `godam`, and the slug is otherwise taken from the folder name.
- After regenerating, check `Report-Msgid-Bugs-To` in `languages/godam.pot` is still `https://wordpress.org/support/plugin/godam` and that no unrelated line changed.
- CI checks the POT is current only on PRs into `main`. Feature PRs into `develop` do not have to regenerate it.

## Plugin Check

Run WordPress.org Plugin Check (the same check CI runs in `plugin_check_on_pull_request.yml`) on a build of the plugin before handing a change to QA. Fix errors; explain any warning you leave.

## Safety

- Test anything that writes through the SDK, API, uploads or transcoding against the dev environment (`app-godam.rt.gw` and its dev upload server). Never write to production Central (`app.godam.io`) or the production analytics server (`analytics.godam.io`).
- Never run bulk or destructive operations (deleting media, truncating tables, mass re-transcoding, analytics dumps) against a live site or server.
- Never commit secrets: API keys, license keys, tokens, app passwords, `.env` files, `wp-config.php`. Do not paste them into PRs, issues or logs. If you find one committed, stop and tell the user.
- No writes to live data (production sites, live databases, remote servers) without the user saying yes in this session. A past yes does not carry over.
- Remove any test media, test users and test options you create on a shared or dev site when you finish.
- If a task needs more access than you have, stop and ask. Do not work around a permission block.

## Writing style

- No em dashes in code comments, docs, commit messages or PR text.
- Do not add AI attribution (no "Generated with", no co-author lines for an AI tool) to files, commits or PRs.
