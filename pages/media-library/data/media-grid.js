/**
 * This function triggers the select box change outside of the react component.
 *
 * @param {number} itemId The ID of the folder to be selected
 */
function triggerFilterChange( itemId ) {
	// Find the select box for the media library folder filter.
	const selectBox = document.querySelector( '#media-folder-filter' );

	if ( selectBox ) {
		selectBox.value = itemId;

		// Manually trigger the change event to update the media library.
		const changeEvent = new Event( 'change', { bubbles: true } );
		selectBox.dispatchEvent( changeEvent );
	}

	// If the post-query-submit button is present, click it to update the media library.
	const postQuerySubmitButton = document.querySelector( '#post-query-submit' );

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
	const selectBox = document.querySelector( '#media-folder-filter' );

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
	const anchorTag = document.querySelector( '.wp-filter .filter-items .view-switch a.current' );

	if ( anchorTag && anchorTag.id === 'view-switch-list' ) {
		return true;
	}

	return false;
}

export { triggerFilterChange, updateSelectDropdown, checkIfListSelected };
