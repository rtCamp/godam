/**
 * External dependencies
 */
import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export const VideoJS = ( props ) => {
	const videoRef = useRef( null );
	const playerRef = useRef( null );
	const { options, onReady, onTimeupdate } = props;

	const videoMeta = useSelector( ( state ) => state.videoReducer );
	const videoConfig = videoMeta.videoConfig;
	const layers = videoMeta.layers;
	const skipTime = useSelector( ( state ) => state.videoReducer.skipTime );
	useEffect( () => {
		// Make sure Video.js player is only initialized once
		if ( ! playerRef.current ) {
			// The Video.js player needs to be _inside_ the component el for React 18 Strict Mode.
			const videoElement = document.createElement( 'video-js' );

			videoElement.classList.add( 'vjs-big-play-centered' );
			videoRef.current.appendChild( videoElement );

			const player = ( playerRef.current = videojs( videoElement, options, () => {
				videojs.log( 'player is ready' );
				onReady && onReady( player );
			} ) );

			// Add a 'timeupdate' event listener
			if ( onTimeupdate ) {
				player.on( 'timeupdate', () => {
					const currentTime = player.currentTime();
					onTimeupdate( player, currentTime );
				} );
			}
		} else {
			//handle skip timer control
			const player = playerRef.current;
			const skipBackwardButton = player.controlBar.getChild( 'skipBackward' );
			const skipForwardButton = player.controlBar.getChild( 'skipForward' );
			if ( skipForwardButton ) {
				skipForwardButton.off( 'click' ); // Remove default click behavior
				skipForwardButton.on( 'click', () => {
					const newTime = Math.min(
						player.currentTime() + skipTime,
						player.duration(),
					);
					player.currentTime( newTime );
				} );
			}

			// Override default skip backward button
			if ( skipBackwardButton ) {
				skipBackwardButton.off( 'click' ); // Remove default click behavior
				skipBackwardButton.on( 'click', () => {
					const newTime = Math.max( player.currentTime() - skipTime, 0 );
					player.currentTime( newTime );
				} );
			}
		}
	}, [ videoRef, skipTime ] );

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
