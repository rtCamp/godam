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
 * This function triggers the select box change outside of the react component.
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

	// Find the select box within the active frame
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
