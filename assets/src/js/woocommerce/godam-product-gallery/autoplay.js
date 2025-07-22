/**
 * GoDAM Product Gallery Video Autoplay Handler
 *
 * Description:
 * Automatically plays videos in product galleries for 5 seconds, then restarts the video.
 * This creates a looping preview effect specifically for videos marked with the `autoplay` attribute.
 */

export function initAutoplayGalleries() {
	const galleries = document.querySelectorAll( '.godam-product-gallery' );

	if ( galleries.length === 0 ) {
		return;
	}

	galleries.forEach( ( gallery ) => {
		const videos = gallery.querySelectorAll( 'video' );

		videos.forEach( ( video ) => {
			if ( video.hasAttribute( 'autoplay' ) ) {
				setInterval( () => {
					if ( video.currentTime >= 5 ) {
						video.pause();
						video.currentTime = 0;
						video.play();
					}
				}, 1000 );
			}
		} );
	} );
}
