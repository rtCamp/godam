/**
 * Write your JS code here for admin.
 */
/* eslint-disable no-console */
console.log( 'Hello from Features Plugin Admin' );
/* eslint-enable no-console */

window.pathJoin = function( parts, sep = '/' ) {
	return parts
		.map( ( part, index ) => {
			// Don't modify 'http://' or 'https://' at the beginning
			if ( index === 0 ) {
				return part.replace( new RegExp( sep + '+$', 'g' ), '' ); // Remove trailing `/`
			}
			return part.replace( new RegExp( '^' + sep + '+|' + sep + '+$', 'g' ), '' ); // Trim leading and trailing `/`
		} )
		.join( sep );
};

document.addEventListener( 'DOMContentLoaded', function() {
	const toggleButtons = document.querySelectorAll( '#easydam-tools-widget .handlediv' );

	toggleButtons.forEach( ( button ) => {
		button.addEventListener( 'click', function() {
			const postbox = button.closest( '.postbox' );
			const inside = postbox.querySelector( '.inside' );

			if ( inside ) {
				const isExpanded = button.getAttribute( 'aria-expanded' ) === 'true';
				inside.style.display = isExpanded ? 'none' : 'block';
				button.setAttribute( 'aria-expanded', ! isExpanded );
			}
		} );
	} );
} );
