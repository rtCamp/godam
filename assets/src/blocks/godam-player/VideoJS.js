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

// Mirror Video.js's fluid aspect-ratio padding inline on the player element.
// Video.js generates this rule in the top document only, which the block-editor iframe
// can't see — without an explicit padding-top the player collapses to zero height.
const applyAspectRatioPadding = ( player, aspectRatio ) => {
	if ( ! player || ! aspectRatio || ! /^\d+:\d+$/.test( aspectRatio ) ) {
		return;
	}
	const [ x, y ] = aspectRatio.split( ':' ).map( Number );
	if ( ! x || ! y ) {
		return;
	}
	const playerEl = player.el_;
	if ( playerEl ) {
		playerEl.style.paddingTop = `${ ( y / x ) * 100 }%`;
	}
};

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

			if ( ! options.aspectRatio ) {
				videojsOptions.aspectRatio = '16:9';
			}

			if ( options.aspectRatio && ! /^\d+:\d+$/.test( options.aspectRatio ) ) {
				// Unset the aspectRatio from videojsOptions as we will set it later
				delete videojsOptions.aspectRatio;
			}

			playerRef.current = videojs( videoElement, videojsOptions, () => {
				if ( onReady ) {
					onReady( playerRef.current );
				}

				// Video.js writes its fluid padding-top rule to the top-level document, which
				// doesn't reach the block editor's iframed canvas. Mirror it inline so the
				// player gets a visible height in either context.
				applyAspectRatioPadding( playerRef.current, videojsOptions.aspectRatio );

				// Fade the loading overlay out after a short delay so the transition feels smooth.
				setTimeout( () => {
					if ( ! videoRef.current ) {
						return;
					}
					const loadingElement = videoRef.current.parentElement?.querySelector( '.godam-video-loading' );
					if ( loadingElement ) {
						loadingElement.classList.add( 'hide' );
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
				applyAspectRatioPadding( player, options.aspectRatio );
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
			<div ref={ videoRef } />
			<div style={ { paddingTop: paddingTopValue } } className="godam-video-loading">
				<div className="godam-video-loading-spinner"></div>
			</div>
		</div>
	);
};

export default VideoJS;
