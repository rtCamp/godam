/**
 * External dependencies
 */
import React from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

// Only import qualityMenu if not already registered (this will also load qualityLevels as dependency)
if ( ! videojs.getPlugin( 'qualityMenu' ) ) {
	import( 'videojs-contrib-quality-menu' );
}

import 'videojs-flvjs-es6';

/**
 * WordPress dependencies
 */
import { useRef, useEffect } from '@wordpress/element';

export const VideoJS = ( props ) => {
	const videoRef = useRef( null );
	const playerRef = useRef( null );
	const { options, onReady, onPlayerReady } = props;

	useEffect( () => {
		// Make sure Video.js player is only initialized once
		if ( ! playerRef.current ) {
			// The Video.js player needs to be _inside_ the component el for React 18 Strict Mode.
			const videoElement = document.createElement( 'video-js' );

			videoElement.classList.add( 'vjs-big-play-centered' );
			videoElement.classList.add( 'vjs-styles-dimensions' );
			videoRef.current.appendChild( videoElement );

			playerRef.current = videojs( videoElement, options, () => {
				if ( onReady ) {
					onReady( playerRef.current );
				}
			} );

			// Add quality menu
			playerRef.current.qualityMenu();

			// You could update an existing player in the `else` block here
			// on prop change, for example:
		} else {
			const player = playerRef.current;

			player.autoplay( options.autoplay );
			player.poster( options.poster || '' );
			player.controls( options.controls );
			player.loop( options.loop );
			player.muted( options.muted );
			player.preload( options.preload || '' );
			player.playsinline( options.playsinline );
			player.src( options.sources );
			// Verify if aspectRatio is in valid format x:y
			if ( /^\d+:\d+$/.test( options.aspectRatio ) ) {
				player.aspectRatio( options.aspectRatio || '16:9' );
			}
		}
	}, [ onReady, options, videoRef ] );

	// Dispose the Video.js player when the functional component unmounts
	useEffect( () => {
		const player = playerRef.current;

		onPlayerReady( player );

		return () => {
			if ( player && ! player.isDisposed() ) {
				player.dispose();
				playerRef.current = null;
			}
		};
	}, [ playerRef ] );

	return (
		<div data-vjs-player>
			<div ref={ videoRef } />
		</div>
	);
};

export default VideoJS;
