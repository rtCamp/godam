// "start:pages-css": "npx tailwindcss -i ./pages/style.css -o ./pages/build/style.css --watch",

/**
 * External dependencies
 */
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import { FastForwardFill, Forward, Trash } from 'react-bootstrap-icons';
/**
 * Internal dependencies
 */
import VideoJSPlayer from './VideoJSPlayer';

const App = () => {
	// Get the current post ID from the URL query string
	const urlParams = new URLSearchParams( window.location.search );
	const attachmentID = urlParams.get( 'id' );
	const videoData = window.videoData;

	const [ video, setVideo ] = useState( null );
	const [ currentTime, setCurrentTime ] = useState( 0 );
	const [ layers, setLayers ] = useState( [
		{
			id: uuidv4(),
			timestamp: 5,
			type: 'Ad',
			gf_id: 1,
			viewed: false,
			submitted: false,
		},
	] );
	const [ togglePlay, setTogglePlay ] = useState( true );
	const [ formHTML, setFormHTML ] = useState( null ); // Store fetched form HTML
	const [ showForm, setShowForm ] = useState( false );

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
			} )
			.catch( ( error ) => {
				console.error( error );
			} );
	}, [] );

	const handleTimeUpdate = ( player, time ) => {
		// Round the current time to 2 decimal places
		setCurrentTime( time.toFixed( 2 ) );

		if ( Math.floor( time ) >= 5 ) {
			player.pause(); // Pause the video
			fetchGravityForm( 1 ); // Fetch Gravity Form with ID 1
			setShowForm( true ); // Show overlay
		}
	};

	// Fetch the Gravity Form HTML
	const fetchGravityForm = async ( formId ) => {
		try {
			const response = await fetch(
				`/wp-admin/admin-ajax.php?action=get_gravity_form&form_id=${ formId }`,
			);
			const result = await response.json();
			if ( result.success ) {
				setFormHTML( result.data ); // Update form HTML
			} else {
				console.error( 'Error fetching form:', result.data );
			}
		} catch ( error ) {
			console.error( 'AJAX request failed:', error );
		}
	};

	const addLayer = ( time ) => {
		const newLayer = {
			id: uuidv4(),
			timestamp: time,
			type: [ 'Form', 'Layer', 'Ad' ][ Math.floor( Math.random() * 3 ) ],
			content: 'New layer',
		};

		setLayers( [ ...layers, newLayer ] );
	};

	return (
		<>

			<div className="video-editor-container">
				<aside className="py-3">
					<div id="sidebar-content">
					</div>
				</aside>

				<main className="flex justify-center items-center p-4">
					{ video && (
						<div className="max-w-[740px] w-full">
							<h1 className="text-slate-700 mb-1">{ video.title.rendered }</h1>

							<div className="relative">
								<VideoJSPlayer
									options={
										{
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
										}
									}
									onTimeupdate={ handleTimeUpdate }
								/>
								{ /* Form Overlay */ }
								{ showForm && (
									<div
										style={ {
											position: 'absolute',
											top: '0',
											left: '0',
											right: '0',
											bottom: '0',
											zIndex: 999,
											background: 'rgba(255, 255, 255, 0.8)',
											padding: '20px',
											border: '2px solid black',
											display: 'flex',
											flexDirection: 'column',
											justifyContent: 'center',
											alignItems: 'center',
										} }
									>
										<div className="max-w-[700px]">
											<div dangerouslySetInnerHTML={ { __html: formHTML } }></div>
											<button
												className="absolute bottom-6 flex justify-center items-center gap-2 right-0 px-4 py-2 bg-blue-500 hover:bg-blue-700 text-white"
												onClick={ () => {
													setShowForm( false ); // Hide form overlay
													setLayers( layers.map( ( layer ) => {
														if ( layer.timestamp === 5 ) {
															return { ...layer, viewed: true };
														}
														return layer;
													} ) );
												} }
											>
												Skip <FastForwardFill />
											</button>
										</div>
									</div>
								) }
							</div>
							<div className="mt-2">Timestamp: { currentTime }</div>

						</div>
					) }
				</main>
			</div>

		</>
	);
};

export default App;

ReactDOM.render( <App />, document.getElementById( 'root-video-editor' ) );
