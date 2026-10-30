/* global MktoForms2 */

/**
 * Marketo form layer — frontend loader.
 *
 * The player template renders an empty
 * `<form data-marketo-form-id="<formId>">` inside each Marketo layer overlay.
 * This script uses Marketo's forms2 library to populate every such form on the
 * page with `MktoForms2.loadForm( instanceHost, munchkinId, formId )`.
 *
 * Two things the naive one-call-per-node version got wrong, both fixed here.
 *
 * Submitting took the viewer off the video: forms2 follows the form's follow-up
 * redirect (or reloads the page) after a submit unless an `onSuccess` handler
 * returns `false`. We register one that swaps in a thank-you message and returns
 * false, so the viewer stays on the video and the player's FormLayerManager sees
 * `.godam-marketo-success` and shows "Continue".
 *
 * The same form ID twice on one page rendered each form's fields twice: forms2
 * targets `form#mktoForm_<id>`, which matches every node with that id. So the
 * nodes carry a unique id plus `data-marketo-form-id`, and we load them one at a
 * time: give the next node the `mktoForm_<id>` id only for its own load, then
 * restore it before moving on, so forms2 only ever sees one match.
 *
 * Credentials come from `window.godamMarketoFormData`, localized by
 * `Marketo_Form_Assets` (inc/classes/assets/class-marketo-form-assets.php).
 */

( function() {
	const data = window.godamMarketoFormData || {};
	const instanceHost = data.instanceHost || '';
	const munchkinId = data.munchkinId || '';
	const successText = data.successText || 'Thank you! Your submission has been received.';
	const unavailableText = data.unavailableText || 'This form could not be loaded.';

	/**
	 * Replace a form that did not load with a message. The player's
	 * FormLayerManager sees `.godam-marketo-unavailable` and shows "Continue",
	 * so the viewer is never stuck on an empty layer, even with skip turned off.
	 *
	 * @param {HTMLElement} formEl The form node that did not load.
	 */
	function showUnavailable( formEl ) {
		// Built as a text node, like the success message.
		const message = document.createElement( 'p' );
		message.className = 'godam-marketo-unavailable';
		message.textContent = unavailableText;

		formEl.after( message );
		formEl.style.display = 'none';
	}

	/**
	 * forms2 sends a submission through a hidden iframe on the Marketo host and
	 * only accepts its replies from the exact protocol it asked for. On an HTTP
	 * page it asks for `http://<host>`, the browser upgrades the iframe to HTTPS,
	 * every reply is dropped and the submit button stays on "Please Wait". Only
	 * `app-*.marketo.com` hosts are always asked for over HTTPS.
	 *
	 * @return {boolean} Whether submissions will hang on this page.
	 */
	function isInsecurePage() {
		return 'http:' === window.location.protocol && ! /^\/\/app-.*?\.marketo\.com/i.test( instanceHost );
	}

	/**
	 * Load one node, then the next, so forms2 never sees two nodes with the same
	 * `mktoForm_<id>` id at once.
	 *
	 * @param {HTMLElement[]} nodes Form nodes still to load.
	 * @param {number}        index Current index.
	 */
	function loadNext( nodes, index ) {
		if ( index >= nodes.length ) {
			return;
		}

		const formEl = nodes[ index ];
		const formId = parseInt( formEl.dataset.marketoFormId, 10 );

		// Mark loaded up front so a re-run never doubles a node.
		formEl.dataset.godamMarketoLoaded = 'true';

		if ( ! formId ) {
			loadNext( nodes, index + 1 );
			return;
		}

		// forms2 finds its target with `form#mktoForm_<id>`. Give this node that
		// id only while it loads, so two layers with the same form id do not fill
		// each other.
		const originalId = formEl.id;
		formEl.id = 'mktoForm_' + formId;

		MktoForms2.loadForm( instanceHost, munchkinId, formId, function( form ) {
			// forms2 renders before it calls back, so a form with no fields here
			// never loaded: null when Marketo cannot return the form (an unknown,
			// deleted or unapproved id), or an empty render for a form ID from
			// another Marketo instance. Either way the id is still restored and the
			// forms after this one on the page still load.
			if ( ! form || ! formEl.querySelector( 'input, select, textarea, button' ) ) {
				showUnavailable( formEl );
			} else {
				form.onSuccess( function() {
					// Built as a text node: a translated string containing `<` or `&`
					// must not be read as markup.
					const message = document.createElement( 'p' );
					message.className = 'godam-marketo-success';
					message.textContent = successText;

					formEl.after( message );
					formEl.style.display = 'none';

					// Returning false stops forms2 from navigating to the follow-up URL.
					return false;
				} );
			}

			// Restore a stable id before loading the next node.
			formEl.id = originalId;
			loadNext( nodes, index + 1 );
		} );
	}

	/**
	 * Load every not-yet-loaded Marketo form on the page.
	 */
	function loadMarketoForms() {
		if ( ! instanceHost || ! munchkinId || typeof MktoForms2 === 'undefined' ) {
			return;
		}

		const nodes = Array.prototype.slice
			.call( document.querySelectorAll( '.marketo-form-container [data-marketo-form-id]' ) )
			.filter( function( el ) {
				return el.dataset.godamMarketoLoaded !== 'true';
			} );

		loadNext( nodes, 0 );
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
		if ( isInsecurePage() ) {
			// eslint-disable-next-line no-console
			console.warn( 'GoDAM: Marketo forms can only be submitted on HTTPS pages. On this HTTP page the submit button will stay on "Please Wait".' );
		}
		waitForMktoForms2();
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
}() );
