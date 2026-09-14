/**
 * Get the most recently opened media frame
 *
 * @return {Element|null} The active media frame element
 */
function getActiveMediaFrame() {
	const visibleFrames = Array.from( document.querySelectorAll( '.media-frame' ) )
		.filter( ( frame ) => getComputedStyle( frame ).display !== 'none' );

	return visibleFrames[ visibleFrames.length - 1 ] || null; // Most recently opened visible frame
}

/**
 * Map a sidebar folder id to the `media-folder` Backbone query prop value.
 * Mirrors the toolbar select's filter map: -1 = all, 0 = uncategorized,
 * otherwise the numeric term id.
 *
 * @param {number|string} itemId Folder id from the sidebar.
 * @return {number} The `media-folder` prop value.
 */
function normalizeFolderProp( itemId ) {
	if ( itemId === 'all' || itemId === -1 || itemId === '-1' ) {
		return -1;
	}
	if ( itemId === 'uncategorized' || itemId === 0 || itemId === '0' ) {
		return 0;
	}
	const numeric = parseInt( itemId, 10 );
	return Number.isNaN( numeric ) ? -1 : numeric;
}

/**
 * Resolve the wp.media Attachments collection backing the active media frame.
 * The frame is stashed on its own sidebar root (see
 * assets/src/js/media-library/index.js) so we target THIS frame's collection,
 * not a shared id / "last visible" guess.
 *
 * @param {Element} activeFrame The active `.media-frame` element.
 * @return {Object|null} The Backbone Attachments collection (with `.props`), or null.
 */
function getActiveFrameCollection( activeFrame ) {
	const root = activeFrame && activeFrame.querySelector( '#rt-transcoder-media-library-root' );
	const frame = root && root._godamFrame;

	if ( ! frame || typeof frame.state !== 'function' ) {
		return null;
	}

	const state = frame.state();
	const collection = ( state && typeof state.get === 'function' ) ? state.get( 'library' ) : null;

	return ( collection && collection.props ) ? collection : null;
}

/**
 * Apply a folder filter outside of the React component.
 *
 * @param {number} itemId The ID of the folder to be selected
 */
function triggerFilterChange( itemId ) {
	// Find the most recently opened media frame
	const activeFrame = getActiveMediaFrame();

	// If no active frame (we're on upload.php page), handle URL navigation
	if ( ! activeFrame ) {
		// Check if we're on the upload.php page
		if ( window.location.pathname.includes( 'upload.php' ) ) {
			const url = new URL( window.location );

			// Handle different folder types
			if ( itemId === 'all' || itemId === -1 ) {
				url.searchParams.delete( 'media-folder' );
			} else if ( itemId === 'uncategorized' || itemId === 0 ) {
				url.searchParams.set( 'media-folder', 'uncategorized' );
			} else {
				url.searchParams.set( 'media-folder', itemId );
			}

			// Navigate to the new URL
			window.location.href = url.toString();
			return;
		}
		return;
	}

	// In a media-picker modal, drive filtering through the frame's own Backbone
	// query props. Setting the `media-folder` prop re-fetches the collection the
	// modal renders — this is what the toolbar select does on change, but it works
	// even when that grid-only DOM (#media-folder-filter / #post-query-submit) is
	// absent, which is exactly why folder clicks used to silently no-op in the picker.
	const collection = getActiveFrameCollection( activeFrame );

	if ( collection ) {
		collection.props.set( { 'media-folder': normalizeFolderProp( itemId ) } );
		return;
	}

	// Fallback: the legacy grid-DOM path (standalone list/grid toolbar).
	const selectBox = activeFrame.querySelector( '#media-folder-filter' );

	if ( selectBox ) {
		selectBox.value = itemId;

		// Manually trigger the change event to update the media library.
		const changeEvent = new Event( 'change', { bubbles: true } );
		selectBox.dispatchEvent( changeEvent );
	}

	// If the post-query-submit button is present, click it to update the media library.
	const postQuerySubmitButton = activeFrame.querySelector( '#post-query-submit' );

	if ( postQuerySubmitButton ) {
		postQuerySubmitButton.click();
	}
}

/**
 * Update the select dropdown with the new term.
 *
 * @param {number} itemId   Term ID
 * @param {string} itemName Term Name
 */
function updateSelectDropdown( itemId, itemName ) {
	// Find the most recently opened media frame
	const activeFrame = getActiveMediaFrame();

	if ( ! activeFrame ) {
		return;
	}

	// Find the select box within the active frame
	const selectBox = activeFrame.querySelector( '#media-folder-filter' );

	if ( selectBox ) {
		const option = document.createElement( 'option' );
		option.value = itemId;
		option.text = itemName;
		selectBox.add( option );
		selectBox.value = itemId;

		const changeEvent = new CustomEvent( 'change', {
			bubbles: true,
			detail: {
				term_id: itemId,
				name: itemName,
			},
		} );

		selectBox.dispatchEvent( changeEvent );
	}
}

function checkIfListSelected() {
	// Find the most recently opened media frame
	const activeFrame = getActiveMediaFrame();

	if ( ! activeFrame ) {
		return false;
	}

	const anchorTag = activeFrame.querySelector( '.wp-filter .filter-items .view-switch a.current' );

	if ( anchorTag && anchorTag.id === 'view-switch-list' ) {
		return true;
	}

	return false;
}

/**
 * Resolve the wp.media FRAME (not its collection) driving the current view.
 *
 * `getActiveFrameCollection()` above only works for picker/Elementor frames,
 * which stash themselves on their own sidebar root. On `upload.php` the sidebar
 * root is a sibling in `#wpbody`, outside the frame, so the frame has to come
 * from wp.media's own registry instead.
 *
 * @return {Object|null} A wp.media frame, or null when none is available.
 */
function getActiveFrameObject() {
	const activeFrame = getActiveMediaFrame();
	const root = activeFrame && activeFrame.querySelector( '#rt-transcoder-media-library-root' );

	if ( root && root._godamFrame ) {
		return root._godamFrame;
	}

	const media = typeof wp !== 'undefined' ? wp.media : null;

	if ( ! media ) {
		return null;
	}

	// The grid page's Manage frame registers itself as `wp.media.frames.browse` and
	// never sets `wp.media.frame` — that global is only assigned by the wp.media()
	// factory that builds MODAL frames, and it keeps pointing at the last modal long
	// after it closed. So the modal frame may only win while a modal is on screen.
	const modal = document.querySelector( '.media-modal' );
	const isModalOpen = Boolean( modal ) && window.getComputedStyle( modal ).display !== 'none';

	if ( isModalOpen && media.frame ) {
		return media.frame;
	}

	return ( media.frames && media.frames.browse ) || media.frame || null;
}

/**
 * Whether the media library is being shown as a server-rendered list table
 * (`upload.php?mode=list`) rather than a Backbone grid.
 *
 * @return {boolean} True in list mode.
 */
function isMediaListView() {
	return Boolean( document.querySelector( '#posts-filter .wp-list-table.media' ) );
}

/**
 * List mode refreshes by reloading the page, which throws away any React state —
 * including the snackbar that should report the move. Park the notice in
 * sessionStorage so the sidebar can show it once it has remounted.
 */
const PENDING_NOTICE_KEY = 'godamMoveToFolderNotice';

/**
 * Store a snackbar notice for the sidebar to pick up after a page reload.
 *
 * @param {Object} notice A `{ message, type }` payload for `updateSnackbar`.
 */
function storePendingNotice( notice ) {
	try {
		window.sessionStorage.setItem( PENDING_NOTICE_KEY, JSON.stringify( notice ) );
	} catch {
		// Private-mode / quota failures just mean the toast is skipped.
	}
}

/**
 * Read and clear the notice parked by `storePendingNotice()`.
 *
 * @return {Object|null} The stored notice, or null if there was none.
 */
function consumePendingNotice() {
	try {
		const raw = window.sessionStorage.getItem( PENDING_NOTICE_KEY );

		if ( ! raw ) {
			return null;
		}

		window.sessionStorage.removeItem( PENDING_NOTICE_KEY );

		return JSON.parse( raw );
	} catch {
		return null;
	}
}

/**
 * Bring the attachment view back in sync after media has been moved between
 * folders.
 *
 * This replaces the per-id DOM removal the drop handler used to do
 * (`jQuery( 'li.attachment[data-id=…]' ).remove()`), which was wrong in three
 * ways: it did nothing in "All Media" (where moved items legitimately stay but
 * still need re-rendering), it left the Backbone collection holding models the
 * current filter no longer matches, and in list mode it orphaned the pagination
 * counts and row actions around the rows it deleted.
 *
 * The grid path mirrors core's own post-bulk-delete sequence
 * (`wp-includes/js/media-views.js` ~L4670): clear the selection, re-run the
 * query, then let the frame leave Bulk Select. `Query.get()` empties its cache on
 * every call, so `_requery()` always refetches rather than replaying stale data.
 *
 * @param {Object}      options        Refresh options.
 * @param {Object|null} options.notice Snackbar payload to show after a list-mode reload.
 */
function refreshAfterMove( { notice = null } = {} ) {
	// List mode is server-rendered: there is no collection to requery, and whether a
	// row should disappear depends on the active filter. A reload is the only
	// correct answer.
	if ( isMediaListView() ) {
		if ( notice ) {
			storePendingNotice( notice );
		}

		window.location.reload();
		return;
	}

	const frame = getActiveFrameObject();
	const state = frame && typeof frame.state === 'function' ? frame.state() : null;
	const library = state && typeof state.get === 'function' ? state.get( 'library' ) : null;
	const selection = state && typeof state.get === 'function' ? state.get( 'selection' ) : null;

	if ( selection && typeof selection.reset === 'function' ) {
		selection.reset();
	}

	if ( library && typeof library._requery === 'function' ) {
		library._requery( true );
	}

	// What core's "Bulk Select" toggle listens to in order to step back out of
	// select mode; without it the toolbar is left in a half-selected state.
	if ( frame && typeof frame.trigger === 'function' ) {
		frame.trigger( 'selection:action:done' );
	}

	// Existing contract: both FolderTree and App refetch their counts on this.
	document.dispatchEvent( new CustomEvent( 'godam-attachment-browser:changed' ) );
}

/**
 * Attachment ids currently selected in the media view.
 *
 * Read on demand rather than subscribed to: the only React consumer is the folder
 * context menu, which mounts fresh on every open, so a snapshot is enough and
 * avoids wiring the sidebar to Backbone's `selection` collection events.
 *
 * @return {Array} Selected attachment ids, newest selection state.
 */
function getSelectedAttachmentIds() {
	if ( isMediaListView() ) {
		return Array.from(
			document.querySelectorAll( '#posts-filter .wp-list-table.media tbody input[name="media[]"]:checked' ),
		).map( ( checkbox ) => Number( checkbox.value ) ).filter( Boolean );
	}

	const frame = getActiveFrameObject();
	const state = frame && typeof frame.state === 'function' ? frame.state() : null;
	const selection = state && typeof state.get === 'function' ? state.get( 'selection' ) : null;

	if ( ! selection || typeof selection.map !== 'function' ) {
		return [];
	}

	return selection.map( ( model ) => Number( model.get( 'id' ) ) ).filter( Boolean );
}

export {
	triggerFilterChange,
	updateSelectDropdown,
	checkIfListSelected,
	isMediaListView,
	refreshAfterMove,
	consumePendingNotice,
	getSelectedAttachmentIds,
};
