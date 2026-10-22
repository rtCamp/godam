/* global hbspt */

/**
 * HubSpot form layer — frontend loader (GoDAM Central source).
 *
 * The player template renders an empty
 * `<div class="form-container hubspot-form" data-portal-id data-form-id data-region>`
 * inside each Central HubSpot layer overlay. This script uses HubSpot's forms v2
 * library to render the form into every such container with
 * `hbspt.forms.create( { portalId, formId, region, target } )` — the same call
 * the in-editor preview makes.
 *
 * Account details come from each container's own data attributes (written by the
 * player template from the active GoDAM Central connection). The overlay starts
 * hidden; the form can be rendered immediately and the player's FormLayerManager
 * unhides it at the layer's display time.
 */

( function() {
	const SELECTOR = '.hubspot-form[data-form-id]';

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
		waitForHbspt();
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
}() );
