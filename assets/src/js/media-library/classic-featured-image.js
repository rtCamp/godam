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
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { isSameId } from './ids.js';

/**
 * The placeholder GoDAM ID held back from `wp.media.featuredImage.set()` while its real
 * attachment is being created. Null when no pick is in flight.
 *
 * @type {string|number|null}
 */
let deferredVirtualId = null;

/**
 * The meta box markup replaced by the in-flight placeholder, so a pick that never resolves
 * can put the previous featured image back. Null when nothing is parked.
 *
 * @type {string|null}
 */
let metaBoxSnapshot = null;

/**
 * Whether a media frame is the classic editor's Featured image workflow.
 *
 * `wp.media.featuredImage.frame()` is the only frame built with a `featured-image` state,
 * so its presence identifies the one context where a pick can reach
 * `wp.media.featuredImage.set()`. Everything else — Insert Media, galleries, the Document
 * block — is left alone.
 *
 * @param {Object} frame A media frame.
 * @return {boolean} True when the frame is the Featured image workflow.
 */
function isFeaturedImageFrame( frame ) {
	return !! frame?.states?.get?.( 'featured-image' );
}

/**
 * Show a placeholder in the featured image meta box while a pick is being resolved.
 *
 * Core's `set()` replaces the whole of `#postimagediv .inside` when the real ID lands, so
 * the placeholder is cleaned up for free on the success path; only the failure path has to
 * restore the snapshot.
 *
 * @return {void}
 */
function showInFlightPlaceholder() {
	const inside = document.querySelector( '#postimagediv .inside' );

	if ( ! inside ) {
		return;
	}

	metaBoxSnapshot = inside.innerHTML;
	inside.innerHTML = '<p class="godam-featured-image-pending">' + __( 'Setting featured image…', 'godam' ) + '</p>';
}

/**
 * Put the previous featured image markup back after a pick failed to resolve.
 *
 * @return {void}
 */
function restoreMetaBox() {
	const inside = document.querySelector( '#postimagediv .inside' );

	if ( inside && null !== metaBoxSnapshot ) {
		inside.innerHTML = metaBoxSnapshot;
	}

	metaBoxSnapshot = null;
}

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

	if ( ! isFeaturedImageFrame( frame ) || 'godam' !== frame?.content?.mode?.() ) {
		return false;
	}

	const selected = frame.state?.()?.get?.( 'selection' )?.single?.();

	return !! selected && isSameId( selected.id, id );
}

/**
 * Wrap `wp.media.featuredImage.set()` so a GoDAM pick is parked rather than sent.
 *
 * Called from GoDAMCreate() rather than at page load: `wp.media.featuredImage` is
 * defined by media-editor.js, which is not guaranteed to have run by the time this
 * bundle initializes, and the patch is only ever needed once the GoDAM tab is rendered.
 * Idempotent, since GoDAMCreate() runs on every tab activation.
 *
 * @param {Object} frame The media frame rendering the GoDAM tab.
 * @return {void}
 */
export function setupClassicFeaturedImage( frame ) {
	const featuredImage = window.wp?.media?.featuredImage;

	if ( ! featuredImage || featuredImage.godamOriginalSet ) {
		return;
	}

	// Only the Featured image workflow can route a pick through `featuredImage.set()`, so
	// there is no reason to override a core global while the GoDAM tab is being rendered
	// inside Insert Media or a gallery frame. GoDAMCreate() runs on every tab activation,
	// so the patch still gets installed the first time a featured-image frame shows the tab.
	if ( ! isFeaturedImageFrame( frame ) ) {
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
			showInFlightPlaceholder();
			return undefined;
		}

		deferredVirtualId = null;
		metaBoxSnapshot = null;

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
	if ( null === deferredVirtualId || ! isSameId( deferredVirtualId, virtualMediaId ) ) {
		return;
	}

	deferredVirtualId = null;

	const featuredImage = window.wp?.media?.featuredImage;

	if ( ! featuredImage?.godamOriginalSet ) {
		// Nothing will repaint the meta box, so undo the placeholder ourselves.
		restoreMetaBox();
		return;
	}

	// Core's set() replaces the meta box markup, placeholder included.
	metaBoxSnapshot = null;

	featuredImage.godamOriginalSet.call( featuredImage, realId );
}

/**
 * Release a parked classic-editor featured image without setting anything.
 *
 * Called when create-media-entry fails or answers with `success: false`. Without this the
 * park would stay held for the rest of the page's life: the original `set()` was
 * suppressed, so the meta box silently keeps its previous value while the user believes a
 * featured image was chosen. Clearing at least lets the next pick through.
 *
 * ID-matched for the same reason resolveClassicFeaturedImage() is — a slow failure must
 * not release a pick the user made after it.
 *
 * @param {string|number} virtualMediaId The GoDAM ID that was parked.
 * @return {boolean} True when a park was actually cleared.
 */
export function clearDeferredFeaturedImage( virtualMediaId ) {
	if ( null === deferredVirtualId || ! isSameId( deferredVirtualId, virtualMediaId ) ) {
		return false;
	}

	deferredVirtualId = null;
	restoreMetaBox();

	return true;
}
