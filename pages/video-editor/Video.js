/**
 * External dependencies
 */
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
/**
 * Internal dependencies
 */
import VideoJSPlayer from './VideoJSPlayer';
import { initializeStore, saveVideoMeta } from './redux/slice/videoSlice';

const Video = ( { attachmentID, videoData, currentTime, setCurrentTime } ) => {
	const [ video, setVideo ] = useState( null );
	const dispatch = useDispatch();
	useEffect( () => {
		// Make sure the post ID is passed in the URL
		if ( ! attachmentID ) {
			return;
		}

		// Collapse the admin sidebar
		const body = document.querySelector( 'body' );
		if ( body ) {
			body.classList.add( 'folded' );
		}

		// Get the post data
		fetch( `/wp-json/wp/v2/media/${ attachmentID }`, {
			headers: {
				'X-WP-Nonce': videoData.nonce,
			},
		} )
			.then( ( response ) => response.json() )
			.then( ( data ) => {
				setVideo( data );
				const easydamMeta = data.easydam_meta;
				if ( easydamMeta ) {
					dispatch( initializeStore( easydamMeta ) );
				}
			} )
			.catch( ( error ) => {
				console.error( error );
			} );
	}, [] );

	const handleTimeUpdate = ( player, time ) => {
		// Round the current time to 2 decimal places
		setCurrentTime( time.toFixed( 2 ) );
	};
	return (
		video && (
			<div className="max-w-[740px] w-full">
				<h1 className="text-slate-700 mb-1">{ video.title.rendered }</h1>

				<div className="relative">

					<VideoJSPlayer
						options={ {
							controls: true,
							fluid: true,
							preload: 'auto',
							width: '100%',
							sources: [ { src: video.source_url, type: video.mimeType } ],
							muted: true,
							controlBar: {
								playToggle: true, // Play/Pause button
								volumePanel: true,
								currentTimeDisplay: true, // Current time
								timeDivider: true, // Divider between current time and duration
								durationDisplay: true, // Total duration
								fullscreenToggle: true, // Full-screen button
								subsCapsButton: true,
								skipButtons: {
									forward: 10,
									backward: 10,
								},
								progressControl: {
									vertical: true, // Prevent horizontal volume slider
								},
							},
						} }
						onTimeupdate={ handleTimeUpdate }
					/>

				</div>
				<div className="mt-2">Timestamp: { currentTime }</div>
			</div>
		)
	);
};

export default Video;
