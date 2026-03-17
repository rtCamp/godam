/**
 * HTTP Authentication Detection.
 *
 * Detects if HTTP authentication is enabled by making a fresh request
 * from the browser (not server-side) to check for 401 responses.
 *
 * @since 1.7.1
 */

/* global jQuery */

( function( $ ) {
	'use strict';

	const godamHttpAuthDetector = window?.godamHttpAuthDetector || {};

	// Try to initialize immediately (before DOM ready).
	const earlyInitSuccess = initializeEarly();

	/**
	 * Check if HTTP authentication is enabled.
	 *
	 * @since 1.7.1
	 *
	 * @return {Promise<boolean>} Promise resolving to true if HTTP auth is enabled, false otherwise.
	 */
	async function detectHttpAuth() {
		const controller = new AbortController();
		const timeout = setTimeout( function() {
			controller.abort();
		}, 5000 );

		// Make a fresh GET request to home URL without credentials.
		return fetch( godamHttpAuthDetector.testUrl, {
			method: 'GET',
			credentials: 'omit',
			cache: 'no-store',
			signal: controller.signal,
		} )
			.then( async function( response ) {
				clearTimeout( timeout );
				const hasHttpAuth = 401 === response.status;
				return saveHttpAuthStatus( hasHttpAuth );
			} )
			.catch( async function() {
				clearTimeout( timeout );

				// On error, assume no HTTP auth (fail-safe).
				return saveHttpAuthStatus( false );
			} );
	}

	/**
	 * Save HTTP auth detection result via AJAX.
	 *
	 * @since 1.7.1
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
	 * @since 1.7.1
	 *
	 * @return {boolean} True if interception is set up, false otherwise.
	 */
	function interceptMediaUploads() {
		// Hook into WordPress media uploader (Plupload).
		if ( typeof wp === 'undefined' || ! wp.Uploader ) {
			return false;
		}

		// Store original init method.
		const originalInit = wp.Uploader.prototype.init;

		// Override the init method.
		wp.Uploader.prototype.init = function() {
			// Call original init.
			const result = originalInit.apply( this, arguments );

			// Before files are uploaded, check for HTTP auth.
			if ( this.uploader ) {
				this.uploader.bind( 'BeforeUpload', function( up, file ) {
					// If this file has already been checked, allow upload to proceed.
					if ( file.httpAuthChecked ) {
						return;
					}

					// If detection is already in progress, pause uploads and wait.
					if ( up.httpAuthDetectionInProgress ) {
						file.status = window?.plupload?.STOPPED;
						return;
					}

					// Mark detection as in progress and pause uploads.
					up.httpAuthDetectionInProgress = true;
					file.status = window?.plupload?.STOPPED;

					// Run detection and resume uploads when done.
					$.when( detectHttpAuth() ).always( function() {
						up.httpAuthDetectionInProgress = false;
						// Mark this file as checked so we don't run detection again for it.
						file.httpAuthChecked = true;
						up.start();
					} );
				} );
			}

			return result;
		};

		return true;
	}

	/**
	 * Initialize immediately (before DOM ready) to ensure we catch uploader initialization.
	 *
	 * @since 1.7.1
	 *
	 * @return {boolean} True if interception is set up, false otherwise.
	 */
	function initializeEarly() {
		// Check if godamHttpAuthDetector is available.
		if ( ! window?.godamHttpAuthDetector ) {
			return false;
		}

		// Intercept media uploads immediately.
		return interceptMediaUploads();
	}

	/**
	 * Initialize on document ready.
	 *
	 * @since 1.7.1
	 *
	 * @return {void}
	 */
	$( document ).ready( function() {
		// Only run on upload page.
		if ( ! window?.godamHttpAuthDetector ) {
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
