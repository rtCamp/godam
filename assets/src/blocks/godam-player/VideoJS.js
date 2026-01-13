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
import { useRef, useEffect, useMemo } from '@wordpress/element';

export const VideoJS = ( props ) => {
	const videoRef = useRef( null );
	const playerRef = useRef( null );
	const { options, onReady, onPlayerReady } = props;

	const paddingTopValue = useMemo( () => {
		if ( options.aspectRatio ) {
			const [ x, y ] = options.aspectRatio.split( ':' );
			return `${ ( y / x ) * 100 }%`;
		}
		return '56.25%';
	}, [ options.aspectRatio ] );

	useEffect( () => {
		// Make sure Video.js player is only initialized once
		if ( ! playerRef.current ) {
			// The Video.js player needs to be _inside_ the component el for React 18 Strict Mode.
			const videoElement = document.createElement( 'video-js' );

			videoElement.classList.add( 'vjs-big-play-centered' );
			videoElement.classList.add( 'vjs-styles-dimensions' );
			videoRef.current.appendChild( videoElement );

			const videojsOptions = { ...options };

			if ( options.aspectRatio && ! /^\d+:\d+$/.test( options.aspectRatio ) ) {
				// Remove aspectRatio from options as we will set it later
				delete videojsOptions.aspectRatio;
			}

			playerRef.current = videojs( videoElement, videojsOptions, () => {
				if ( onReady ) {
					onReady( playerRef.current );
				}

				// Video.js player initialize instantly and hides the video loading spinner, so add a slight delay to hide it smoothly
				setTimeout( () => {
					if ( videoRef.current ) {
						// Hide the video player loading animation
						const parentElement = videoRef.current.parentElement;

						if ( parentElement ) {
							// Remove the child element with class name 'godam-video-loading'
							const childElement = parentElement.querySelector( '.godam-video-loading' );
							if ( childElement ) {
								childElement.classList.add( 'hide' );
							}
						}

						videoRef.current.style.display = 'block';
					}
				}, 500 );
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
				player.aspectRatio( options.aspectRatio );

				// Get x and y from aspectRatio
				const [ x, y ] = options.aspectRatio.split( ':' );
				if ( playerRef.current && x && y ) {
					const playerEl = playerRef.current.el_;
					playerEl.style.paddingTop = `${ ( y / x ) * 100 }%`;
				}
			}
		}
	}, [ options, videoRef ] );

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
			<div style={ { paddingTop: paddingTopValue } } className="godam-video-loading">
				<div className="godam-video-loading-spinner"></div>
			</div>
			<div style={ { display: 'none' } } ref={ videoRef } />
		</div>
	);
};

export default VideoJS;
