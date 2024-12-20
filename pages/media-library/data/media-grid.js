/**
 * This function triggers the select box change outside of the react component.
 *
 * @param {number} itemId The ID of the folder to be selected
 */
function triggerFilterChange( itemId ) {
	// Find the select box for the media library folder filter.
	const selectBox = document.querySelector( '#media-attachment-taxonomy-filter' );

	if ( selectBox ) {
		selectBox.value = itemId;

		// Manually trigger the change event to update the media library.
		const changeEvent = new Event( 'change', { bubbles: true } );
		selectBox.dispatchEvent( changeEvent );
	}
}

export { triggerFilterChange };
