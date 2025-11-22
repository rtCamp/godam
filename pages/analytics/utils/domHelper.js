/**
 * Safely update DOM element content
 *
 * @param {string} elementId       - Element ID
 * @param {string} content         - Content to set
 * @param {string} className       - Optional class to add
 * @param {string} removeClassName - Optional class to remove
 */
function updateElement( elementId, content, className = null, removeClassName = null ) {
	const element = document.getElementById( elementId );
	if ( element ) {
		element.innerHTML = content;
		if ( removeClassName ) {
			element.classList.remove( removeClassName );
		}
		if ( className ) {
			element.classList.add( className );
		}
	}
}

/**
 * Show/hide elements by toggling visibility classes
 *
 * @param {string}  elementId - Element ID
 * @param {boolean} show      - Whether to show or hide
 */
function toggleElementVisibility( elementId, show = true ) {
	const element = document.getElementById( elementId );
	if ( element ) {
		if ( show ) {
			element.classList.remove( 'hidden' );
		} else {
			element.style.display = 'none';
		}
	}
}

export {
	updateElement,
	toggleElementVisibility,
};
