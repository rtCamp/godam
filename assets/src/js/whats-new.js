document.addEventListener( 'DOMContentLoaded', function() {
	document.addEventListener( 'whatsNewContentReady', () => {
		// Modal functionality
		const modal = document.getElementById( 'featureModal' );
		const modalBodies = document.querySelectorAll( '.modal-body' );

		// Function to open modal with specific content
		function openModal( contentId ) {
			// Hide all modal bodies
			modalBodies.forEach( ( body ) => {
				body.style.display = 'none';
			} );

			// Show the selected modal body
			document.getElementById( contentId ).style.display = 'block';

			// Display the modal
			modal.style.display = 'block';

			// Prevent scrolling on the body when modal is open
			document.body.style.overflow = 'hidden';
		}

		// Function to close modal
		function closeModal() {
			modal.style.display = 'none';
			document.body.style.overflow = 'auto';
		}

		// Close modal when clicking outside the modal content
		window.onclick = function( event ) {
			if ( event.target === modal ) {
				closeModal();
			}
		};

		// Close modal when pressing Escape key
		document.addEventListener( 'keydown', function( event ) {
			if ( event.key === 'Escape' && modal.style.display === 'block' ) {
				closeModal();
			}
		} );

		document.querySelectorAll( '.feature-card' )?.forEach( ( button ) => {
			button.addEventListener( 'click', function() {
				const contentId = this.getAttribute( 'data-target' );
				openModal( contentId );
			} );
		} );

		document.querySelectorAll( '.close-button' )?.forEach( ( button ) => {
			button.addEventListener( 'click', closeModal );
		} );
	} );
} );
