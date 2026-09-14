/**
 * Media ID comparison shared by the GoDAM virtual-to-real ID swaps.
 *
 * Deliberately kept out of utility.js: that module imports models/attachments.js, which
 * reads a bare `wp` global at load time, so anything importing it cannot be unit tested.
 */

/**
 * Compare two media IDs across the virtual/real boundary.
 *
 * A GoDAM placeholder ID is a Central job docname (a string) while a WordPress attachment
 * ID is an integer, and the same value arrives as either type depending on whether it came
 * from a Backbone model, a block attribute or the post entity. Coercing both sides keeps
 * that one matching rule in a single place.
 *
 * @param {string|number|null|undefined} a First ID.
 * @param {string|number|null|undefined} b Second ID.
 * @return {boolean} True when both IDs refer to the same media item.
 */
export function isSameId( a, b ) {
	if ( a === undefined || a === null || b === undefined || b === null ) {
		return false;
	}

	return String( a ) === String( b );
}
