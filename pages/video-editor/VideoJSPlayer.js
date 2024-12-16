/**
 * External dependencies
 */
import { useState, useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

import { useSelector, useDispatch } from 'react-redux';

export const VideoJS = ( props ) => {
	const videoRef = useRef( null );
	const playerRef = useRef( null );
	const { options, onReady, onTimeupdate } = props;

	const dispatch = useDispatch();
	const videoMeta = useSelector( ( state ) => state.videoReducer );
	const videoConfig = videoMeta.videoConfig;
	const layers = videoMeta.layers;

	useEffect( () => {
		// Make sure Video.js player is only initialized once
		if ( ! playerRef.current ) {
			// The Video.js player needs to be _inside_ the component el for React 18 Strict Mode.
			const videoElement = document.createElement( 'video-js' );

			videoElement.classList.add( 'vjs-big-play-centered' );
			videoRef.current.appendChild( videoElement );

			const player = playerRef.current = videojs( videoElement, options, () => {
				videojs.log( 'player is ready' );
				onReady && onReady( player );
			} );

			// Add a 'timeupdate' event listener
			if ( onTimeupdate ) {
				player.on( 'timeupdate', () => {
					const currentTime = player.currentTime();
					onTimeupdate( player, currentTime );
				} );
			}
		}
	}, [ videoRef ] );

	useEffect( () => {
		if ( playerRef.current ) {
			const player = playerRef.current;

			// Remove the old event listener on 'timeupdate' event.
			player.off( 'timeupdate' );

			// Add a new 'timeupdate' event listener
			if ( onTimeupdate ) {
				player.on( 'timeupdate', () => {
					const currentTime = player.currentTime();
					onTimeupdate( player, currentTime );
				} );
			}
		}
	}, [ layers ] );

	useEffect( () => {
		if ( playerRef.current ) {
			const player = playerRef.current;

			// player.sources( options.sources );
			player.poster( options.poster );
			player.autoplay( options.autoplay );
			player.muted( options.muted );
			player.loop( options.loop );
			player.controls( options.controls );
			player.preload( options.preload );

			const volumePanel = player.controlBar.getChild( 'volumePanel' );
			if ( options.controlBar.playToggle && ! volumePanel ) {
				player.controlBar.addChild( 'volumePanel' );
			} else if ( ! options.controlBar.playToggle && volumePanel ) {
				player.controlBar.removeChild( 'volumePanel' );
			}
		}
	}, [ options ] );

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
		<div data-vjs-player>
			<div ref={ videoRef } />
		</div>
	);
};

export default VideoJS;
