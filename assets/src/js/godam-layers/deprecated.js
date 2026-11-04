/**
 * GoDAM Layer API: deprecation notices for the add-on hooks it replaces (#2296).
 *
 * The old hooks keep working until GoDAM 2.9.0; each logs one notice per page
 * the first time it is used.
 */

export const DEPRECATED_SINCE = '2.7.0';
export const REMOVED_IN = '2.9.0';

const shown = new Set();

/**
 * Log that a hook or global is deprecated, once per page.
 *
 * @param {string} feature     What was used, e.g. `window.godamLayerCreators`.
 * @param {string} alternative What to use instead.
 */
export function deprecated( feature, alternative ) {
	if ( shown.has( feature ) ) {
		return;
	}
	shown.add( feature );
	// eslint-disable-next-line no-console
	console.warn(
		`GoDAM: ${ feature } is deprecated since version ${ DEPRECATED_SINCE } and will be removed in version ${ REMOVED_IN }. Use ${ alternative } instead.`,
	);
}
