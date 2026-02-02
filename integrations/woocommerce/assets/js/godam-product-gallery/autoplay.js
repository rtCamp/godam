/**
 * GoDAM Product Gallery Video Autoplay Handler
 *
 * Description:
 * Automatically plays videos in product galleries for 5 seconds, then restarts the video.
 * This creates a looping preview effect specifically for videos marked with the `autoplay` attribute.
 *
 * Uses timeupdate event instead of setInterval to avoid memory leaks.
 */

// WeakMap to track video event listeners for proper cleanup
const videoListeners = new WeakMap();

export function initAutoplayGalleries() {
	const galleries = document.querySelectorAll( '.godam-product-gallery' );

	if ( galleries.length === 0 ) {
		return;
	}

	galleries.forEach( ( gallery ) => {
		const videos = gallery.querySelectorAll( 'video' );

		videos.forEach( ( video ) => {
			if ( video.hasAttribute( 'autoplay' ) ) {
				// Create event listener for this video
				const handleTimeUpdate = () => {
					if ( video.currentTime >= 5 ) {
						video.currentTime = 0;
						video.play();
					}
				};

				// Store listener reference for cleanup
				videoListeners.set( video, handleTimeUpdate );

				// Add event listener
				video.addEventListener( 'timeupdate', handleTimeUpdate );
			}
		} );
	} );
}

/**
 * Clean up autoplay galleries to prevent memory leaks.
 * Call this when galleries are removed from DOM or page is unloaded.
 */
export function cleanupAutoplayGalleries() {
	const galleries = document.querySelectorAll( '.godam-product-gallery' );

	galleries.forEach( ( gallery ) => {
		const videos = gallery.querySelectorAll( 'video' );

		videos.forEach( ( video ) => {
			const listener = videoListeners.get( video );
			if ( listener ) {
				video.removeEventListener( 'timeupdate', listener );
				videoListeners.delete( video );
			}
		} );
	} );
}
