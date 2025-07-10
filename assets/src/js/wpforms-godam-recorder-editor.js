/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import videojs from 'video.js';

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
		const videoPreviewElement = videoContainer.querySelector( '.godam-video-preview' );
		const videoElement = videoPreviewElement.querySelector( '.video-js' );
		const uploadVideoBtn = videoContainer.querySelector( '.godam-video-upload-image' );
		const removeVideoBtn = videoContainer.querySelector( '.godam-video-remove-image' );
		const videoInput = videoContainer.querySelector( '.godam-video-field-input' );
		const videoLink = videoContainer.querySelector( '.godam-video-link' );
		const videoName = videoContainer.querySelector( '.godam-video-name' );
		const player = videojs( videoElement.id + '_html5_api' );

		uploadVideoBtn.addEventListener( 'click', function( e ) {
			e.preventDefault();

			if ( frame ) {
				frame.open();
			}

			// Image selection click handler
			frame.on( 'select', function() {
				// Get media attachment details from the frame state
				const attachment = frame.state().get( 'selection' ).first().toJSON();

				videoName.innerText = attachment?.name;

				videoLink.href = attachment?.url;

				// Send the attachment id to our hidden input
				videoInput.value = attachment.id;

				// Hide the add image link
				uploadVideoBtn.classList.add( 'hidden' );

				// Unhide the remove image link
				removeVideoBtn.classList.remove( 'hidden' );
				videoLink.classList.remove( 'hidden' );

				// Change sources in video player.
				player.src( [
					{ type: attachment?.mime, src: attachment?.url },
					{ type: 'application/dash+xml', src: attachment?.transcoded_url },
				] );

				// Un-Hide video preview.
				videoPreviewElement.classList.remove( 'hidden' );
			} );

			// Finally, open the modal on click
		} );

		// Delete image button on-click event handler
		removeVideoBtn.addEventListener( 'click', function( e ) {
			e.preventDefault();

			// Hide the video link.
			videoLink.classList.add( 'hidden' );

			// Hide video preview.
			videoPreviewElement.classList.add( 'hidden' );

			// Un-hide the add image link
			uploadVideoBtn.classList.remove( 'hidden' );

			// Hide the delete image link
			removeVideoBtn.classList.add( 'hidden' );

			// Delete the image id from the hidden input
			videoInput.value = 0;
		} );
	} );
} );
