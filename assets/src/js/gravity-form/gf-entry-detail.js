/**
 * External dependencies
 */
// import 'video.js/dist/video-js.css';
import videojs from 'video.js';
import 'videojs-contrib-quality-menu';

document.addEventListener( 'DOMContentLoaded', function() {
	const GoDAMVideos = document.querySelectorAll( '.godam-player' );

	GoDAMVideos.forEach( function( video ) {
		const sources = video.getAttribute( 'data-video-sources' );

		const options = {
			controls: true,
			autoplay: true,
			preload: 'auto',
			fluid: true,
			sources: JSON.parse( sources ),
		};

		const player = videojs( video, options );

		try {
			player.play();
			player.videojsQualityMenu();
		} catch ( error ) {
			// Silently ignore the error.
		}
	} );
} );
