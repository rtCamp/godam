/* global jQuery */

jQuery( document ).ready( function( $ ) {
	( 'use strict' );

	const deactivateLink = $( '#deactivate-godam' );
	const GoDAMDeactivation = window.GoDAMDeactivation || {};

	const deactivateModal = function() {
		const modalDOM = `
            <div class="rt-godam-modal-wrapper">
                <div id="deactivation-feedback-popup" class="rt-godam-modal">
                    <div>
                        <h2>${ GoDAMDeactivation?.headerText }</h2>
                    </div>
                    <select id="deactivation-reason">
                        <option value="">Select a reason</option>
                        <option value="Found a better plugin">I found a better plugin</option>
                        <option value="Not working as expected">The plugin is not working as expected</option>
                        <option value="Just testing">I was just testing</option>
                        <option value="Other">Other</option>
                    </select>
                    <textarea id="deactivation-feedback" placeholder="Additional details..." style="display: none;"></textarea>
                    <div class='button-container'>
                    <button class="skip-feedback" id="godam-skip-feedback">
                        <a href="${ deactivateLink[ 0 ].href }">
                            Skip & Deactivate
                        </a>
                    </button>
                    <div>
                        <button class="cancel-deactivation" id="cancel-deactivation">Cancel</button>
                        <button class="submit-feedback" id="submit-feedback" disabled>Submit & Deactivate</button>
                    </div>
                    </div>
                </div>
            </div>
            `;
		return modalDOM;
	};

	deactivateLink.on( 'click', function( e ) {
		e.preventDefault();
		$( '.wrap' ).append( deactivateModal() );
	} );

	const cancelPopup = '#cancel-deactivation';
	$( document.body ).on( 'click', cancelPopup, function( e ) {
		e.preventDefault();
		$( '.rt-godam-modal-wrapper' ).remove();
	} );

	// Show/hide textarea based on selected option
	$( document.body ).on( 'change', '#deactivation-reason', function() {
		if ( $( this ).val() === 'Other' ) {
			$( '#deactivation-feedback' ).show();
		} else {
			$( '#deactivation-feedback' ).hide();
		}
		$( '#submit-feedback' ).prop( 'disabled', false );
	} );

	// Handle form submission
	$( document.body ).on( 'click', '#submit-feedback', function() {
		const reasonSelect = document.getElementById( 'deactivation-reason' );
		const selectedReason = reasonSelect.value; // Get the selected value

		const additionalFeedback = document.getElementById( 'deactivation-feedback' );
		const feedback = additionalFeedback.value; // Get the selected value

		const data = {
			reason: selectedReason,
			site_url: GoDAMDeactivation?.siteUrl,
			user: {
				name: GoDAMDeactivation?.userName,
				email: GoDAMDeactivation?.userEmail,
			},
			nonce: GoDAMDeactivation?.nonce,
			additional_feedback: feedback,
		};

		$.ajax( {
			url: GoDAMDeactivation?.apiUrl,
			method: 'POST',
			data: JSON.stringify( data ),
			contentType: 'application/json',
			success() {
				window.location.href = deactivateLink[ 0 ].href; // Proceed with deactivation
			},
			error() {
				window.location.href = deactivateLink[ 0 ].href; // Proceed anyway
			},
		} );
	} );
} );
