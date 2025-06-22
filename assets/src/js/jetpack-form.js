document.addEventListener( 'DOMContentLoaded', function() {
	// Set your REST endpoint
	const restUrl = '/wp-json/godam/v1/jetpack-form-submit';

	// Define AJAX submission handler function
	function handleRestSubmission( form ) {
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
			return;
		}

		// Show loading state
		const submitBtn = form.querySelector( 'button[type="submit"], input[type="submit"]' );
		let originalText = '';

		if ( submitBtn ) {
			submitBtn.setAttribute( 'aria-disabled', true );
			submitBtn.disabled = true;
			originalText = submitBtn.innerHTML;
			submitBtn.innerHTML = originalText + ' <span class="spinner is-active" style="float:none;margin-left:5px;"></span>';
		}

		// Prepare payload
		const payload = new FormData();
		payload.append( 'contact-form-id', formId );
		payload.append( 'contact-form-hash', formHash );
		payload.append( 'origin-post-id', originPostId );

		// Add fields as a JSON string in a single parameter
		payload.append( 'fields', JSON.stringify( fields ) );

		// Submit via AJAX to Jetpack's built-in handler
		fetch( restUrl, {
			method: 'POST',
			headers: {
				// Don't set Content-Type for FormData, let the browser set it
			},
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
					submitBtn.disabled = false;
					submitBtn.innerHTML = originalText;
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
					submitBtn.disabled = false;
					submitBtn.innerHTML = originalText;
				}

				// Show error message
				form.innerHTML = '<div class="contact-form-error" style="padding:20px;background:#f8d7da;border:1px solid #f5c6cb;color:#721c24;border-radius:4px;"><p>Network error. Please try again.</p></div>';
			} );
	}

	// Find all Jetpack forms
	const jetpackForms = document.querySelectorAll( 'form input[name="action"][value="grunion-contact-form"]' );

	jetpackForms.forEach( function( actionInput ) {
		const form = actionInput.closest( 'form' );

		// Prevent default form submission
		form.addEventListener( 'submit', function( e ) {
			e.preventDefault();
			e.stopPropagation();
			handleRestSubmission( form );
			return false;
		} );

		// Also override the form's submit method
		form.submit = function() {
			handleRestSubmission( form );
			return false;
		};
	} );
} );
