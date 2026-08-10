#!/bin/sh
#
# Blocks a commit that touches GoDAM's own attachment-handling code without
# keeping the rtgodam_before_attachment_lookup / rtgodam_after_attachment_lookup
# hook pair intact and balanced.
#
# Runs the same three checks as
# .github/workflows/wp_dam_hook_integrity_on_pull_request.yml — see that
# workflow and each check script's own top-of-file comment for what they can
# and can't catch. Scoped to the same paths that workflow watches; anything
# else exits immediately without running PHP at all.
#
# Invoked from .husky/pre-commit via `npm run lint:godam-hooks`.

STAGED_FILES=$(git diff --cached --name-only)

if ! echo "$STAGED_FILES" | grep -Eq '^(inc/|admin/|assets/src/blocks/|bin/godam-wp-dam-hook-check\.php$|bin/godam-wp-dam-hook-baseline\.json$|bin/godam-interprocedural-leak-check\.php$|bin/godam-interprocedural-leak-baseline\.json$|bin/godam-attachment-access-coverage-check\.php$|bin/godam-attachment-access-coverage-baseline\.json$)'; then
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
php bin/godam-wp-dam-hook-check.php check || status=1
php bin/godam-interprocedural-leak-check.php check || status=1
php bin/godam-attachment-access-coverage-check.php check || status=1

if [ "$status" -ne 0 ]; then
	echo ""
	echo "godam-hook-check: commit blocked by the failure(s)/warning(s) above."
	echo "If this is a reviewed, intentional change (not a missed or malformed"
	echo "hook), run:"
	echo "  php bin/godam-wp-dam-hook-check.php update-baseline"
	echo "  php bin/godam-interprocedural-leak-check.php update-baseline"
	echo "  php bin/godam-attachment-access-coverage-check.php update-baseline"
	echo "then stage the updated bin/*-baseline.json file(s) and commit again."
	echo ""
	exit 1
fi

exit 0
