/* global jQuery */

/**
 * Removes specific query parameters from the Cart page URL after it loads.
 *
 * This script checks whether the current URL contains the query parameters
 * `source=productHotspot` and `add-to-cart`. If both parameters are present,
 * they are removed from the URL using the History API.
 *
 * This cleanup prevents unnecessary or sensitive parameters from persisting
 * in the browser address bar, avoids duplicate cart actions on refresh,
 * and ensures a cleaner, user-friendly URL without triggering a page reload.
 */
jQuery( function() {
	const url = new URL( window.location.href );

	if (
		url.searchParams.get( 'source' ) === 'productHotspot' &&
		url.searchParams.has( 'add-to-cart' )
	) {
		url.searchParams.delete( 'add-to-cart' );
		url.searchParams.delete( 'source' );

		window.history.replaceState( {}, document.title, url.toString() );
	}
} );
