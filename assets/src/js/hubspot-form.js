/**
 * HubSpot form layer — submit bridge (GoDAM Central source).
 *
 * The player template renders HubSpot's current embed markup inside each Central
 * HubSpot layer: a `.hs-form-frame` element carrying the portal, form and region.
 * HubSpot's per-portal embed script (enqueued as a dependency) finds those and
 * renders the form itself — including a new-editor form, which the legacy
 * `hbspt.forms.create()` call did not render or report a submit for.
 *
 * So there is nothing to render here. All this script does is notice when one of
 * those forms is submitted and mark its container with `godam-hubspot-submitted`,
 * which is in the player's FormLayerManager confirmation selectors, so the player
 * shows "Continue" and fires its `submitted` event. The embed renders the form in
 * a same-origin `srcdoc` iframe, so the parent cannot see its success markup — this
 * class, set from the submit event, is how the player learns the form was sent.
 *
 * (Associating the submission with a contact is a separate matter: that needs the
 * `hubspotutk` cookie, set by HubSpot's tracking code, which the plugin injects for
 * a Central-only site when view tracking is on — not by this embed.)
 */

( function() {
	/**
	 * Mark the HubSpot layer container whose form was submitted.
	 *
	 * @param {string} formId - HubSpot form GUID, when the event names one.
	 */
	function markSubmitted( formId ) {
		const frames = document.querySelectorAll( '.hubspot-form .hs-form-frame' );

		frames.forEach( function( frame ) {
			// When HubSpot tells us which form submitted, mark only that one;
			// otherwise mark every HubSpot layer (a page rarely shows two at once).
			if ( formId && frame.dataset.formId && frame.dataset.formId !== formId ) {
				return;
			}

			const container = frame.closest( '.hubspot-form' );

			if ( container ) {
				container.classList.add( 'godam-hubspot-submitted' );
			}
		} );
	}

	// HubSpot's current embed dispatches a window-level event on a successful
	// submission (developers.hubspot.com → Global form events).
	window.addEventListener( 'hs-form-event:on-submission:success', function( event ) {
		const detail = event && event.detail ? event.detail : {};

		markSubmitted( detail.formId || detail.id || '' );
	} );

	// A collected/legacy form on the same page instead posts a message; honour both
	// so the confirmation works whichever path HubSpot takes.
	window.addEventListener( 'message', function( event ) {
		const data = event && event.data ? event.data : {};

		if ( data.type === 'hsFormCallback' && ( data.eventName === 'onFormSubmitted' || data.eventName === 'onFormSubmit' ) ) {
			markSubmitted( ( data.data && data.data.formGuid ) || data.id || '' );
		}
	} );
}() );
