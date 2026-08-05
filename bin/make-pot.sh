#!/usr/bin/env bash
#
# Regenerate the translation template.
#
# Two passes, because WordPress and make-pot disagree about which path matters.
#
# At runtime WordPress resolves JS translations by hashing the *enqueued* script
# path — see _load_script_textdomain_from_src(), which looks for
# languages/<domain>-<locale>-md5( 'assets/build/js/main.min.js' ).json.
# translate.wordpress.org derives those filenames from the POT's own file
# references, so a JS string whose only reference is under assets/src can never
# be resolved: that path is not what gets enqueued, and .distignore strips it
# from the release anyway. Scanning assets/src *instead of* assets/build is what
# the review of rtCamp/godam#2061 caught — it left every wp_set_script_translations()
# string silently untranslated.
#
# Scanning both is still not enough on its own: '*.min.js' sits in make-pot's
# hard-coded exclude list, so a plain scan skips most of assets/build. An
# explicit --include="assets/build" outranks it, because IterableCodeExtractor
# scores an include by path depth (2) against a single-segment exclude (1).
#
#   pass 1  built files only  -> the references WordPress needs at runtime
#   pass 2  everything else   -> references and translator comments a human can
#                               read, merged on top of pass 1 so each entry
#                               carries both
#
# Usage: bin/make-pot.sh languages/godam.pot
set -euo pipefail

OUT="${1:?usage: bin/make-pot.sh <output.pot>}"
EXCLUDE="assets/node_modules,node_modules,tests,vendor"
WP="./vendor/bin/wp"

export WP_CLI_PHP_ARGS='-d memory_limit=1024M'

if [ ! -d assets/build ]; then
	echo "bin/make-pot.sh: assets/build is missing." >&2
	echo "Run 'npm run build:prod' first, or the POT loses every built-path reference." >&2
	exit 1
fi

REFS="$(mktemp "${TMPDIR:-/tmp}/godam-pot-refs.XXXXXX")"
trap 'rm -f "$REFS"' EXIT

"$WP" i18n make-pot . --include="assets/build" --exclude="$EXCLUDE" "$REFS"
"$WP" i18n make-pot . --exclude="$EXCLUDE" --merge="$REFS" "$OUT"
