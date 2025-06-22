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

		// Show loading state using Jetpack's spinner mechanism
		const submitBtn = form.querySelector( 'button[type="submit"], input[type="submit"]' );
		let originalContent = '';

		if ( submitBtn ) {
			// Store original content
			originalContent = submitBtn.innerHTML;

			// Use Jetpack's spinner mechanism
			submitBtn.setAttribute( 'aria-disabled', 'true' );

			// Create and add Jetpack's spinner
			const spinner = document.createElement( 'div' );
			spinner.classList.add( 'contact-form__spinner' );
			spinner.setAttribute( 'aria-hidden', 'true' );
			spinner.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/><path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"><animateTransform attributeName="transform" type="rotate" dur="0.75s" values="0 12 12;360 12 12" repeatCount="indefinite"/></path></svg>';

			// Add screen reader text
			const srText = document.createElement( 'span' );
			srText.classList.add( 'visually-hidden' );
			srText.textContent = 'Submitting form...';

			submitBtn.appendChild( spinner );
			submitBtn.appendChild( srText );
		}

		// Prepare payload
		const payload = new FormData();
		payload.append( 'contact-form-id', formId );
		payload.append( 'contact-form-hash', formHash );
		payload.append( 'origin-post-id', originPostId );

		// Add fields as a JSON string in a single parameter
		payload.append( 'fields', JSON.stringify( fields ) );

		// Submit to your REST endpoint
		fetch( restUrl, {
			method: 'POST',
			headers: {},
			credentials: 'same-origin',
			body: payload,
		} )
			.then( ( response ) => {
				if ( ! response.ok ) {
					throw new Error( 'Network response was not ok: ' + response.status );
				}

				// Try to get the response text first to debug
				return response.text().then( ( text ) => {
					try {
						return JSON.parse( text );
					} catch ( e ) {
						throw new Error( 'Invalid JSON response' );
					}
				} );
			} )
			.then( ( data ) => {
				// Hide loading state
				if ( submitBtn ) {
					submitBtn.removeAttribute( 'aria-disabled' );
					submitBtn.innerHTML = originalContent;
				}

				// Handle the response
				if ( data.success ) {
					// Success - replace form with success message
					const heading = data.heading || 'Success!';
					const message = data.message || 'Your message has been sent successfully.';

					form.innerHTML = '<div class="contact-form-success" style="padding:20px;background:#d4edda;border:1px solid #c3e6cb;color:#155724;border-radius:4px;"><h4>' + heading + '</h4><p>' + message + '</p></div>';
				} else {
					// Error - show error message
					let errorMessage = data.message || 'An error occurred. Please try again.';
					if ( data.errors && Object.keys( data.errors ).length > 0 ) {
						errorMessage += '<ul>';
						Object.values( data.errors ).forEach( ( error ) => {
							errorMessage += '<li>' + error + '</li>';
						} );
						errorMessage += '</ul>';
					}

					form.innerHTML = '<div class="contact-form-error" style="padding:20px;background:#f8d7da;border:1px solid #f5c6cb;color:#721c24;border-radius:4px;">' + errorMessage + '</div>';
				}
			} )
			.catch( ( ) => {
				// Hide loading state
				if ( submitBtn ) {
					submitBtn.removeAttribute( 'aria-disabled' );
					submitBtn.innerHTML = originalContent;
				}

				// Show error message
				form.innerHTML = '<div class="contact-form-error" style="padding:20px;background:#f8d7da;border:1px solid #f5c6cb;color:#721c24;border-radius:4px;"><p>Network error. Please try again.</p></div>';
			} )
			.finally( () => {
				// Reset submission flag
				form.dataset.submitting = 'false';
			} );
	}

	// Find all Jetpack forms
	const jetpackForms = document.querySelectorAll( 'form input[name="action"][value="grunion-contact-form"]' );

	jetpackForms.forEach( function( actionInput ) {
		const form = actionInput.closest( 'form' );

		// Completely disable Jetpack's original form handling
		// Remove any existing event listeners by cloning the form
		const newForm = form.cloneNode( true );
		form.parentNode.replaceChild( newForm, form );

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
