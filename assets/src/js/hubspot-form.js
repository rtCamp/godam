/* global hbspt */

/**
 * HubSpot form layer — frontend loader (GoDAM Central source).
 *
 * The player template renders an empty
 * `<div class="form-container hubspot-form" data-portal-id data-form-id data-region>`
 * inside each Central HubSpot layer overlay. HubSpot's forms v2 library renders the
 * form into every such container with `hbspt.forms.create( { portalId, formId,
 * region, target } )`, the same call the in-editor preview makes.
 *
 * forms v2 handles both kinds of form: a legacy-editor form it renders itself (in
 * an iframe), and a new-editor form it switches to HubSpot's V4 embed (rendered in
 * a same-origin `srcdoc` iframe). The account details come from each container's
 * own data attributes, written by the template from the active Central connection.
 *
 * The overlay starts hidden; the form can render immediately and the player's
 * FormLayerManager unhides it at the layer's display time.
 *
 * On submit, the container is marked with `godam-hubspot-submitted` — one of the
 * FormLayerManager confirmation selectors — so the player shows "Continue" and
 * fires its `submitted` event. The success node lives inside an iframe the parent
 * cannot read into, so this class is how the player learns the form was sent, from
 * two signals that cover both form types: the legacy `onFormSubmitted` callback,
 * and HubSpot's V4 `hs-form-event:on-submission:success` window event.
 *
 * (Associating the submission with a contact is separate: it needs the `hubspotutk`
 * cookie, set by HubSpot's tracking code, which the plugin injects for a
 * Central-only site when view tracking is on — not by the form library.)
 */

( function() {
	const SELECTOR = '.hubspot-form[data-form-id]';

	/**
	 * Mark a HubSpot layer container as submitted, by its form id when one is known,
	 * otherwise every one on the page (a page rarely shows two at once).
	 *
	 * @param {string} formId - HubSpot form GUID, or '' to mark all.
	 */
	function markSubmitted( formId ) {
		document.querySelectorAll( SELECTOR ).forEach( function( container ) {
			if ( formId && container.dataset.formId && container.dataset.formId !== formId ) {
				return;
			}

			container.classList.add( 'godam-hubspot-submitted' );
		} );
	}

	/**
	 * Render every not-yet-rendered Central HubSpot form on the page.
	 */
	function loadHubSpotForms() {
		if ( typeof hbspt === 'undefined' || ! hbspt.forms || ! hbspt.forms.create ) {
			return;
		}

		const containers = document.querySelectorAll( SELECTOR );

		containers.forEach( function( container ) {
			// Skip containers already rendered / in progress.
			if ( container.dataset.godamHubspotLoaded === 'true' ) {
				return;
			}

			const portalId = container.dataset.portalId || '';
			const formId = container.dataset.formId || '';
			const region = container.dataset.region || 'na1';

			if ( ! portalId || ! formId ) {
				return;
			}

			// hbspt.forms.create injects into a selector target. Give each container
			// a unique target node so two forms never collide.
			let target = container.querySelector( '.hubspot-form-target' );
			if ( ! target ) {
				target = document.createElement( 'div' );
				target.className = 'hubspot-form-target';
				target.id = 'godam-hubspot-form-' + Math.random().toString( 36 ).slice( 2 );
				container.appendChild( target );
			}

			container.dataset.godamHubspotLoaded = 'true';

			hbspt.forms.create( {
				portalId,
				formId,
				region,
				target: '#' + target.id,
				// Fires for a legacy iframe-rendered form, whose success node lives
				// inside the iframe and cannot be queried. A new-editor (V4) form does
				// not fire this; the window listener below covers that one.
				onFormSubmitted() {
					container.classList.add( 'godam-hubspot-submitted' );
				},
			} );
		} );
	}

	/**
	 * forms/v2.js is enqueued as a dependency and should be present, but it can
	 * finish evaluating slightly after this script. Retry briefly until the global
	 * is available.
	 *
	 * @param {number} [attempt] Current retry count.
	 */
	function waitForHbspt( attempt ) {
		attempt = attempt || 0;

		if ( typeof hbspt !== 'undefined' && hbspt.forms && hbspt.forms.create ) {
			loadHubSpotForms();
			return;
		}

		// Give up after ~10s (50 × 200ms) to avoid an endless timer.
		if ( attempt >= 50 ) {
			return;
		}

		window.setTimeout( function() {
			waitForHbspt( attempt + 1 );
		}, 200 );
	}

	function init() {
		if ( ! document.querySelector( SELECTOR ) ) {
			return;
		}

		// A new-editor form rendered as HubSpot's V4 embed reports its submit with a
		// window event rather than the create() callback above. Registered once, for
		// every HubSpot layer on the page.
		window.addEventListener( 'hs-form-event:on-submission:success', function( event ) {
			const detail = event && event.detail ? event.detail : {};

			markSubmitted( detail.formId || detail.id || '' );
		} );

		waitForHbspt();
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
}() );
