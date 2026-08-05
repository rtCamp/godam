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

export { triggerFilterChange, updateSelectDropdown, checkIfListSelected };
