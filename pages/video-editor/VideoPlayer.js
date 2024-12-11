/**
 * External dependencies
 */
import React, { useEffect, useRef, useState } from 'react';

const VideoPlayer = () => {
	const videoRef = useRef( null );
	const playerRef = useRef( null );
	const [ currentTime, setCurrentTime ] = useState( 0 );

	useEffect( () => {
		// Initialize the Video.js player
		playerRef.current = videojs( videoRef.current, {
			controls: true,
			preload: 'auto',
			width: 640,
			height: 360,
		} );

		// Add a 'timeupdate' event listener
		playerRef.current.on( 'timeupdate', () => {
			// Update the current time state
			setCurrentTime( playerRef.current.currentTime() );
		} );

		// Cleanup the player on component unmount
		return () => {
			if ( playerRef.current ) {
				playerRef.current.dispose();
			}
		};
	}, [] );

	return (
		<div>
			<div data-vjs-player>
				<video ref={ videoRef } className="video-js">
					<source src="https://vjs.zencdn.net/v/oceans.mp4" type="video/mp4" />
				</video>
			</div>
			<p>Current Time: { currentTime.toFixed( 2 ) } seconds</p>
		</div>
	);
};

export default VideoPlayer;
