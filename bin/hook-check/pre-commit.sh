#!/bin/sh
#
# Blocks a commit that touches GoDAM's own attachment-handling code without
# keeping the rtgodam_before_attachment_lookup / rtgodam_after_attachment_lookup
# hook pair intact and balanced.
#
# Runs the same two checks as
# .github/workflows/wp_dam_hook_integrity_on_pull_request.yml — see that
# workflow and each check script's own top-of-file comment for what they can
# and can't catch. Scoped to the same paths that workflow watches; anything
# else exits immediately without running PHP at all.
#
# Invoked directly from .husky/pre-commit, after `npm run lint:staged`.
#
# Scoped to .php files specifically — both check scripts only ever tokenize
# .php files (see godam_shared_list_php_files() in shared.php), so a commit
# touching only a block's .js/.scss/.json can't contain anything either
# script would look at.
#
# Deny-list, mirroring GODAM_EXCLUDED_ROOT_DIRS in shared.php and the
# workflow's own path filter — an allow-list of specific directories here
# previously meant a commit touching godam.php, lib/, or any new top-level
# directory would silently skip this check entirely. Two grep passes
# (rather than one regex with a negative lookahead) so this stays portable
# to macOS's BSD grep, which has no -P/PCRE support.

STAGED_FILES=$(git diff --cached --name-only)

STAGED_PHP_FILES=$(echo "$STAGED_FILES" | grep -E '\.php$' | grep -Ev '^(\.git|\.github|\.husky|\.idea|node_modules|tests|languages|bin)/')
STAGED_HOOK_CHECK_FILES=$(echo "$STAGED_FILES" | grep -E '^bin/hook-check/.*\.php$')

if [ -z "$STAGED_PHP_FILES" ] && [ -z "$STAGED_HOOK_CHECK_FILES" ]; then
	exit 0
fi

if ! command -v php >/dev/null 2>&1; then
	echo ""
	echo "godam-hook-check: 'php' not found on PATH, so the wp-dam hook-integrity"
	echo "checks can't run. This commit touches attachment-handling code, so"
	echo "blocking rather than committing unchecked — make sure the PHP CLI is"
	echo "available and commit again."
	echo ""
	exit 1
fi

echo ""
echo "Running wp-dam hook-integrity checks (staged changes touch tracked paths)..."
echo ""

status=0
php bin/hook-check/balance.php check || status=1
php bin/hook-check/coverage.php check || status=1

if [ "$status" -ne 0 ]; then
	echo ""
	echo "godam-hook-check: commit blocked by the failure(s) above."
	echo "If this is a reviewed, intentional change (not a missed or malformed"
	echo "hook), add a // godam-coverage-ignore/-disable/-enable/-ignore-file"
	echo "comment at the call site (see either script's own top-of-file comment"
	echo "for the exact syntax), stage the change, and commit again."
	echo ""
	exit 1
fi

exit 0
