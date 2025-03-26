/**
 * External dependencies
 */
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

/**
 * WordPress dependencies
 */
import { useEffect, useRef } from '@wordpress/element';

export const VideoJS = ( props ) => {
	const videoRef = useRef( null );
	const playerRef = useRef( null );
	const { options } = props;

	useEffect( () => {
		// Make sure Video.js player is only initialized once
		if ( ! playerRef.current ) {
			// The Video.js player needs to be _inside_ the component el for React 18 Strict Mode.
			const videoElement = document.createElement( 'video-js' );

			videoElement.classList.add( 'vjs-big-play-centered' );
			videoRef.current.appendChild( videoElement );

			( playerRef.current = videojs( videoElement, options, () => {
				videojs.log( 'player is ready' );
			} ) );
		} else {
			const player = playerRef.current;
			player.src( options.sources );
		}
	}, [ options, videoRef ] );

	// Dispose the Video.js player when the functional component unmounts
	useEffect( () => {
		const player = playerRef.current;

		return () => {
			if ( player && ! player.isDisposed() ) {
				player.dispose();
				playerRef.current = null;
			}
		};
	}, [ playerRef ] );

	return (
		<div data-vjs-player className="easydam-analytics-video-player">
			<div ref={ videoRef } />
		</div>
	);
};

export default VideoJS;
