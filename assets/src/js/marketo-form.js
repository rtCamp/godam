/* global MktoForms2 */

/**
 * Marketo form layer — frontend loader.
 *
 * The player template renders an empty `<form id="mktoForm_<formId>">` inside
 * each Marketo layer overlay. This script uses Marketo's forms2 library to
 * populate every such form on the page with
 * `MktoForms2.loadForm( instanceHost, munchkinId, formId )`.
 *
 * Credentials come from `window.godamMarketoFormData`, localized by
 * `Marketo_Form_Assets` (inc/classes/assets/class-marketo-form-assets.php).
 * The overlay starts hidden; the form can be loaded immediately and the
 * player's FormLayerManager unhides it at the layer's display time.
 */

( function() {
	const data = window.godamMarketoFormData || {};
	const instanceHost = data.instanceHost || ( data.podId ? '//' + data.podId + '.mktoweb.com' : '' );
	const munchkinId = data.munchkinId || '';

	/**
	 * Load every not-yet-loaded Marketo form on the page.
	 */
	function loadMarketoForms() {
		if ( ! instanceHost || ! munchkinId || typeof MktoForms2 === 'undefined' ) {
			return;
		}

		const forms = document.querySelectorAll( '.marketo-form-container form[id^="mktoForm_"]' );

		forms.forEach( function( formEl ) {
			// Skip forms already loaded / in-progress.
			if ( formEl.dataset.godamMarketoLoaded === 'true' ) {
				return;
			}

			const formId = parseInt( formEl.id.replace( 'mktoForm_', '' ), 10 );
			if ( ! formId ) {
				return;
			}

			formEl.dataset.godamMarketoLoaded = 'true';
			MktoForms2.loadForm( instanceHost, munchkinId, formId );
		} );
	}

	/**
	 * forms2.min.js is enqueued as a dependency and should be present, but it
	 * can finish evaluating slightly after this script. Retry briefly until the
	 * global is available.
	 *
	 * @param {number} [attempt] Current retry count.
	 */
	function waitForMktoForms2( attempt ) {
		attempt = attempt || 0;

		if ( typeof MktoForms2 !== 'undefined' ) {
			loadMarketoForms();
			return;
		}

		// Give up after ~10s (50 × 200ms) to avoid an endless timer.
		if ( attempt >= 50 ) {
			return;
		}

		window.setTimeout( function() {
			waitForMktoForms2( attempt + 1 );
		}, 200 );
	}

	function init() {
		if ( ! instanceHost || ! munchkinId ) {
			return;
		}
		waitForMktoForms2();
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
}() );
