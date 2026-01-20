/**
 * HTTP Authentication Detection.
 *
 * Detects if HTTP authentication is enabled by making a fresh request
 * from the browser (not server-side) to check for 401 responses.
 *
 * @since n.e.x.t
 */

/* global jQuery */

( function( $ ) {
	'use strict';

	const godamHttpAuthDetector = window?.godamHttpAuthDetector || {};

	/**
	 * Check if HTTP authentication is enabled.
	 *
	 * @since n.e.x.t
	 *
	 * @return {Promise<boolean>} Promise resolving to true if HTTP auth is enabled, false otherwise.
	 */
	async function detectHttpAuth() {
		// Make a fresh GET request to home URL without credentials.
		return fetch( godamHttpAuthDetector.testUrl, {
			method: 'GET',
			credentials: 'omit',
			cache: 'no-store',
		} )
			.then( function( response ) {
				const hasHttpAuth = 401 === response.status;
				return saveHttpAuthStatus( hasHttpAuth );
			} )
			.catch( function() {
				// On error, assume no HTTP auth (fail-safe).
				return saveHttpAuthStatus( false );
			} );
	}

	/**
	 * Save HTTP auth detection result via AJAX.
	 *
	 * @since n.e.x.t
	 *
	 * @param {boolean} hasHttpAuth Whether HTTP auth is detected.
	 *
	 * @return {Promise} AJAX Promise.
	 */
	function saveHttpAuthStatus( hasHttpAuth ) {
		return $.ajax( {
			url: godamHttpAuthDetector.ajaxUrl,
			type: 'POST',
			data: {
				action: 'godam_save_http_auth_status',
				nonce: godamHttpAuthDetector.nonce,
				has_http_auth: hasHttpAuth ? '1' : '0',
			},
		} );
	}

	/**
	 * Initialize on document ready.
	 *
	 * @since n.e.x.t
	 *
	 * @return {void}
	 */
	$( document ).ready( function() {
		// Only run on upload page.
		if ( typeof godamHttpAuthDetector === 'undefined' ) {
			return;
		}

		// Run detection on every page load.
		detectHttpAuth();
	} );
}( jQuery ) );
