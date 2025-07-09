/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

document.addEventListener( 'DOMContentLoaded', function() {
	const videoContainers = document.querySelectorAll( '#wpforms-edit-entry-form .wpforms-edit-entry-field-godam-video .wpforms-field.wpforms-field-godam-video' );

	const frame = wp.media( {
		title: __( 'Select or Upload Video Of Your Choice', 'godam' ),
		library: {
			type: [ 'video' ],
		},
		button: {
			text: __( 'Use this video', 'godam' ),
		},
		multiple: false, // Set to true to allow multiple files to be selected
	} );

	videoContainers.forEach( ( videoContainer ) => {
		const image = videoContainer.querySelector( '.godam-video-file-thumbnail' );
		const uploadImageBtn = videoContainer.querySelector( '.godam-video-upload-image' );
		const removeImageBtn = videoContainer.querySelector( '.godam-video-remove-image' );
		const videoInput = videoContainer.querySelector( '.godam-video-field-input' );
		const videoLink = videoContainer.querySelector( '.godam-video-link' );
		const videoName = videoContainer.querySelector( '.godam-video-name' );

		uploadImageBtn.addEventListener( 'click', function( e ) {
			e.preventDefault();

			if ( frame ) {
				frame.open();
			}

			// Image selection click handler
			frame.on( 'select', function() {
				// Get media attachment details from the frame state
				const attachment = frame.state().get( 'selection' ).first().toJSON();

				// Send the attachment URL to our custom image input field.
				image.src = attachment?.thumb?.src;

				videoName.innerText = attachment?.name;

				videoLink.href = attachment?.url;

				// Send the attachment id to our hidden input
				videoInput.value = attachment.id;

				// Hide the add image link
				uploadImageBtn.classList.add( 'hidden' );

				// Unhide the remove image link
				removeImageBtn.classList.remove( 'hidden' );
				image.classList.remove( 'hidden' );
				videoLink.classList.remove( 'hidden' );
			} );

			// Finally, open the modal on click
		} );

		// Delete image button on-click event handler
		removeImageBtn.addEventListener( 'click', function( e ) {
			e.preventDefault();

			// Clear out the preview image
			image.classList.add( 'hidden' );
			videoLink.classList.add( 'hidden' );

			// Un-hide the add image link
			uploadImageBtn.classList.remove( 'hidden' );

			// Hide the delete image link
			removeImageBtn.classList.add( 'hidden' );

			// Delete the image id from the hidden input
			videoInput.value = 0;
		} );
	} );
} );
