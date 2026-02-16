/**
 * GoDAM Video Preview Page - Aspect Ratio Handler
 *
 * This script ensures videos maintain their proper aspect ratio
 * on the video preview page by calculating and setting container width
 * based on video dimensions.
 *
 * @since 1.5.0
 */

document.addEventListener( 'DOMContentLoaded', () => {
	// Find all video players on the preview page
	const videoContainers = document.querySelectorAll( '.godam-video-preview .easydam-video-container' );

	if ( videoContainers.length === 0 ) {
		return;
	}

	// Store resize handlers for cleanup
	const resizeHandlers = [];

	videoContainers.forEach( ( container ) => {
		const videoElement = container.querySelector( 'video' );

		if ( ! videoElement ) {
			return;
		}

		// Get the Video.js player instance using getPlayer()
		const playerId = videoElement.id;
		let player = null;

		if ( playerId && window.videojs ) {
			try {
				// Use getPlayer() to avoid creating duplicate player instances
				player = window.videojs.getPlayer( playerId );
			} catch ( error ) {
				// Player instance not found, continue without it
			}
		}

		/**
		 * Sets the Video.js player aspect ratio and container width
		 */
		const setAspectRatio = () => {
			const videoWidth = videoElement.videoWidth;
			const videoHeight = videoElement.videoHeight;

			if ( ! videoWidth || ! videoHeight ) {
				return;
			}

			// Set the aspect ratio on the Video.js player
			if ( player ) {
				const aspectRatio = `${ videoWidth }:${ videoHeight }`;
				player.aspectRatio( aspectRatio );
			}

			// Get the parent preview container
			const previewContainer = container.closest( '.godam-video-preview' );
			if ( ! previewContainer ) {
				return;
			}

			// Desired max height for the video (matches video editor)
			const targetHeight = 450;

			// Calculate width based on aspect ratio
			const calculatedWidth = Math.round( targetHeight * ( videoWidth / videoHeight ) );

			// Get max width from parent container
			const parentWidth = previewContainer.offsetWidth;
			const maxWidth = Math.min( parentWidth, 768 ); // Max 768px as per design

			// Constrain the width
			const constrainedWidth = Math.min( calculatedWidth, maxWidth );

			// Set the container width
			container.style.width = `${ constrainedWidth }px`;
			container.style.maxHeight = `${ targetHeight }px`;
		};

		// Fallback if Video.js player is not available
		if ( videoElement.readyState >= 1 ) {
			setAspectRatio();
		} else {
			videoElement.addEventListener( 'loadedmetadata', setAspectRatio );
		}

		// Store resize handler for cleanup
		resizeHandlers.push( setAspectRatio );
		window.addEventListener( 'resize', setAspectRatio );
	} );

	// Cleanup function to remove all resize listeners
	window.addEventListener( 'beforeunload', () => {
		resizeHandlers.forEach( ( handler ) => {
			window.removeEventListener( 'resize', handler );
		} );
	} );
} );
