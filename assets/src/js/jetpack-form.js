/* global godamJetpackFormData */

document.addEventListener( 'DOMContentLoaded', function() {
	// Set your REST endpoint
	const restUrl = '/wp-json/godam/v1/jetpack-form-submit';

	// Define AJAX submission handler function
	function handleRestSubmission( form ) {
		// Prevent multiple submissions
		if ( form.dataset.submitting === 'true' ) {
			return;
		}

		// Mark form as submitting
		form.dataset.submitting = 'true';

		// Remove any existing error messages
		const existingError = form.querySelector( '.contact-form-error' );
		if ( existingError ) {
			existingError.remove();
		}

		// Gather all fields
		const formData = new FormData( form );
		const fields = {};
		for ( const [ key, value ] of formData.entries() ) {
			// Only include user fields, not Jetpack hidden fields
			if ( ! [ 'action', 'contact-form-id', 'contact-form-hash', '_wpnonce', '_wp_http_referer' ].includes( key ) ) {
				fields[ key ] = value;
			}
		}

		// Get Jetpack hidden fields
		const formId = form.querySelector( 'input[name="contact-form-id"]' )?.value;
		const formHash = form.querySelector( 'input[name="contact-form-hash"]' )?.value;

		// Get origin post ID from data attribute on the form container
		const originPostId = form.closest( '.form-container' )?.dataset?.originPostId;

		if ( ! formId || ! formHash ) {
			form.dataset.submitting = 'false';
			return;
		}

		// Show loading state
		const submitBtn = form.querySelector( 'button[type="submit"], input[type="submit"]' );
		let originalContent = '';

		if ( submitBtn ) {
			originalContent = submitBtn.innerHTML;
			submitBtn.innerHTML = godamJetpackFormData?.submittingText;
			submitBtn.disabled = true;
		}

		// Prepare payload
		const payload = new FormData();
		payload.append( 'contact-form-id', formId );
		payload.append( 'contact-form-hash', formHash );
		payload.append( 'origin-post-id', originPostId );
		payload.append( 'fields', JSON.stringify( fields ) );

		// Submit to REST endpoint
		fetch( restUrl, {
			method: 'POST',
			headers: {},
			credentials: 'same-origin',
			body: payload,
		} )
			.then( ( response ) => response.json() )
			.then( ( data ) => {
				// Reset button
				if ( submitBtn ) {
					submitBtn.innerHTML = originalContent;
					submitBtn.disabled = false;
				}

				if ( data.success ) {
					// Success - replace form with success message
					const heading = data.heading || ( godamJetpackFormData?.successHeading );
					const message = data.message || ( godamJetpackFormData?.successMessage );
					form.innerHTML = '<div class="contact-form-success" style="padding:20px;background:#d4edda;border:1px solid #c3e6cb;color:#155724;border-radius:4px;"><h4>' + heading + '</h4><p>' + message + '</p></div>';
				} else {
					// Error - append error message to form
					const errorMessage = data.message || ( godamJetpackFormData?.errorMessage );
					const errorElement = document.createElement( 'div' );
					errorElement.className = 'contact-form-error';
					errorElement.style.cssText = 'padding: 15px; background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; border-radius: 4px; margin-top: 15px;';
					errorElement.innerHTML = '<p style="margin: 0;">' + errorMessage + '</p>';
					form.appendChild( errorElement );
				}
			} )
			.catch( ( ) => {
				// Reset button
				if ( submitBtn ) {
					submitBtn.innerHTML = originalContent;
					submitBtn.disabled = false;
				}

				// Show error message
				const errorElement = document.createElement( 'div' );
				errorElement.className = 'contact-form-error';
				errorElement.style.cssText = 'padding: 15px; background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; border-radius: 4px; margin-top: 15px;';
				errorElement.innerHTML = '<p style="margin: 0;">' + godamJetpackFormData?.networkErrorMessage + '</p>';
				form.appendChild( errorElement );
			} )
			.finally( () => {
				// Reset submission flag
				form.dataset.submitting = 'false';
			} );
	}

	// Find only Jetpack forms that are within GoDAM video blocks
	// Look for forms that have the data-origin-post-id attribute (which indicates they're from GoDAM)
	const godamJetpackForms = document.querySelectorAll( '.form-container[data-origin-post-id] form input[name="action"][value="grunion-contact-form"]' );

	godamJetpackForms.forEach( function( actionInput ) {
		const form = actionInput.closest( 'form' );

		// Only process forms that are within GoDAM containers
		if ( ! form.closest( '.form-container[data-origin-post-id]' ) ) {
			return;
		}

		let newForm = form;

		// If the form doesn't have the is-ajax-form class, skip form replacement.
		if ( form.classList.contains( 'is-ajax-form' ) ) {
			// Completely disable Jetpack's original form handling
			// Remove any existing event listeners by cloning the form
			newForm = form.cloneNode( true );
			form.parentNode.replaceChild( newForm, form );
		}

		// Prevent default form submission with highest priority
		newForm.addEventListener( 'submit', function( e ) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			handleRestSubmission( newForm );
			return false;
		}, true ); // Use capture phase to ensure this runs first

		// Also override the form's submit method
		newForm.submit = function() {
			handleRestSubmission( newForm );
			return false;
		};

		// Disable any Jetpack AJAX handlers
		if ( window.jQuery ) {
			window.jQuery( newForm ).off( 'submit' );
		}
	} );
} );
