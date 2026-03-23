/**
 * Internal dependencies
 */
import './style.css';

( function() {
	const isSafari = /Safari/.test( navigator.userAgent ) && ! /Chrome|Chromium|Edg|CriOS|FxiOS|OPR/.test( navigator.userAgent );
	if ( ! isSafari ) {
		const addClass = function() {
			const elements = document.querySelectorAll( '.godam-admin-root' );
			elements.forEach( function( el ) {
				el.classList.add( 'not-safari' );
			} );
		};

		if ( document.readyState === 'loading' ) {
			document.addEventListener( 'DOMContentLoaded', addClass );
		} else {
			addClass();
		}
	}
}() );
