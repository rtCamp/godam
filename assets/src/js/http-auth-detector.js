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
			.then( async function( response ) {
				const hasHttpAuth = 401 === response.status;
				return saveHttpAuthStatus( hasHttpAuth );
			} )
			.catch( async function() {
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
	 * Intercept media uploads and check for HTTP auth before proceeding.
	 *
	 * @since n.e.x.t
	 *
	 * @return {void}
	 */
	function interceptMediaUploads() {
		// Hook into WordPress media uploader (Plupload).
		if ( typeof wp === 'undefined' || ! wp.Uploader ) {
			return;
		}

		// Store original init method.
		const originalInit = wp.Uploader.prototype.init;

		// Override the init method.
		wp.Uploader.prototype.init = function() {
			// Call original init.
			const result = originalInit.apply( this, arguments );

			// Before files are uploaded, check for HTTP auth.
			if ( this.uploader ) {
				this.uploader.bind( 'BeforeUpload', function( up ) {
					// If detection has already run for this uploader, allow upload to proceed.
					if ( up.httpAuthDetectionDone ) {
						return;
					}

					// If detection is already in progress, pause uploads and wait.
					if ( up.httpAuthDetectionInProgress ) {
						up.stop();
						return;
					}

					// Mark detection as in progress and pause uploads.
					up.httpAuthDetectionInProgress = true;
					up.stop();

					// Run detection and resume uploads when done.
					$.when( detectHttpAuth() ).always( function() {
						up.httpAuthDetectionDone = true;
						up.httpAuthDetectionInProgress = false;
						up.start();
					} );
				} );
			}

			return result;
		};
	}

	/**
	 * Initialize immediately (before DOM ready) to ensure we catch uploader initialization.
	 *
	 * @since n.e.x.t
	 *
	 * @return {void}
	 */
	function initializeEarly() {
		// Check if godamHttpAuthDetector is available.
		if ( typeof godamHttpAuthDetector === 'undefined' ) {
			return false;
		}

		// Intercept media uploads immediately.
		interceptMediaUploads();

		return true;
	}

	// Try to initialize immediately (before DOM ready).
	const earlyInitSuccess = initializeEarly();

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

		// If early initialization failed, try again.
		if ( ! earlyInitSuccess ) {
			interceptMediaUploads();
		}

		// Run initial detection on page load.
		detectHttpAuth();
	} );

	// Expose detectHttpAuth globally for external use if needed.
	window.godamDetectHttpAuth = detectHttpAuth;
}( jQuery ) );
