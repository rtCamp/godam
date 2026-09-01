/**
 * Classic editor Featured image support for the GoDAM tab.
 *
 * The block editor's Featured image panel routes a pick through `editPost()`, so the
 * placeholder GoDAM ID it stores can simply be repointed once the real attachment
 * exists (see replaceVirtualIdInFeaturedImage in godam-media-frame-shared.js).
 *
 * The classic editor gives us no such window. `wp.media.featuredImage.frame()` binds
 * `wp.media.featuredImage.select` to the state's `select` event at frame construction,
 * so it always runs before our own handler and immediately calls
 * `wp.media.featuredImage.set()` with whatever ID the selected model carries — the
 * Central job docname, at that point. That POSTs to `get-post-thumbnail-html`, which
 * casts the value with `(int)`: `8f7d2a1b` becomes `8`, so the meta box renders an
 * unrelated attachment and writes its ID into the `_thumbnail_id` hidden field, which
 * the next post save then persists.
 *
 * So instead of repairing the value afterwards, hold it back. `set()` is wrapped to
 * park a GoDAM pick rather than send it, and resolveClassicFeaturedImage() releases the
 * real attachment ID through the original setter once create-media-entry has answered.
 * Nothing bogus ever reaches the meta box or the hidden field.
 */

/**
 * The placeholder GoDAM ID held back from `wp.media.featuredImage.set()` while its real
 * attachment is being created. Null when no pick is in flight.
 *
 * @type {string|number|null}
 */
let deferredVirtualId = null;

/**
 * Whether a `set()` call is carrying a GoDAM pick that onGoDAMSelect() is about to turn
 * into a real attachment.
 *
 * Deliberately mirrors onGoDAMSelect()'s own gate — the two must agree, or a pick gets
 * parked with nothing on the way to release it. The ID comparison is what keeps
 * `remove()` working: it calls `set( -1 )`, which never matches the selected model, and
 * the content mode can still read as 'godam' from an earlier session.
 *
 * @param {string|number} id The ID handed to `wp.media.featuredImage.set()`.
 * @return {boolean} True when the value should be parked instead of sent.
 */
function isDeferrableGoDAMId( id ) {
	const frame = window.wp?.media?.frame;

	if ( 'godam' !== frame?.content?.mode?.() ) {
		return false;
	}

	const selected = frame.state?.()?.get?.( 'selection' )?.single?.();

	return !! selected && String( selected.id ) === String( id );
}

/**
 * Wrap `wp.media.featuredImage.set()` so a GoDAM pick is parked rather than sent.
 *
 * Called from GoDAMCreate() rather than at page load: `wp.media.featuredImage` is
 * defined by media-editor.js, which is not guaranteed to have run by the time this
 * bundle initializes, and the patch is only ever needed once the GoDAM tab is rendered.
 * Idempotent, since GoDAMCreate() runs on every tab activation.
 *
 * @return {void}
 */
export function setupClassicFeaturedImage() {
	const featuredImage = window.wp?.media?.featuredImage;

	if ( ! featuredImage || featuredImage.godamOriginalSet ) {
		return;
	}

	const originalSet = featuredImage.set;

	if ( 'function' !== typeof originalSet ) {
		return;
	}

	// Kept for resolveClassicFeaturedImage(): it runs while the modal still reports
	// 'godam' as its content mode, so releasing through the wrapper would park the real
	// ID too and the pick would never land.
	featuredImage.godamOriginalSet = originalSet;

	featuredImage.set = function( id ) {
		if ( isDeferrableGoDAMId( id ) ) {
			deferredVirtualId = id;
			return undefined;
		}

		deferredVirtualId = null;

		return originalSet.call( this, id );
	};
}

/**
 * Release a parked classic-editor featured image now that its attachment exists.
 *
 * @param {string|number} virtualMediaId The GoDAM ID that was parked.
 * @param {number}        realId         The newly created WP attachment ID.
 * @return {void}
 */
export function resolveClassicFeaturedImage( virtualMediaId, realId ) {
	if ( null === deferredVirtualId || String( deferredVirtualId ) !== String( virtualMediaId ) ) {
		return;
	}

	deferredVirtualId = null;

	const featuredImage = window.wp?.media?.featuredImage;

	featuredImage?.godamOriginalSet?.call( featuredImage, realId );
}
