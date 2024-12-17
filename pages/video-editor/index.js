/**
 * External dependencies
 */
import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import { FastForwardFill } from 'react-bootstrap-icons';
import { useSelector, useDispatch, Provider } from 'react-redux';
import axios from 'axios';
import { initializeStore, saveVideoMeta } from './redux/slice/videoSlice';
/**
 * Internal dependencies
 */
import store from './redux/store';

/**
 * Internal dependencies
 */
import VideoJSPlayer from './VideoJSPlayer';
import SidebarLayers from './components/SidebarLayers';

/**
 * WordPress dependencies
 */
import { Button, TabPanel, Snackbar } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const VideoEditor = () => {
	// Get the current post ID from the URL query string
	const urlParams = new URLSearchParams( window.location.search );
	const attachmentID = urlParams.get( 'id' );
	const videoData = window.videoData;

	const [ video, setVideo ] = useState( null );
	const [ currentTime, setCurrentTime ] = useState( 0 );
	const [ formHTML, setFormHTML ] = useState( null ); // Store fetched form HTML
	const [ showForm, setShowForm ] = useState( false );
	const [ showSaveMessage, setShowSaveMessage ] = useState( false );
	const cta = useSelector( ( state ) => state.videoReducer.cta );

	const dispatch = useDispatch();
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const isChanged = useSelector( ( state ) => state.videoReducer.isChanged );

	const [ viewedLayers, setViewedLayers ] = useState( [] );

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
				let easydamMeta = data.easydam_meta;
				if ( easydamMeta ) {
					easydamMeta = JSON.parse( easydamMeta );
					dispatch( initializeStore( easydamMeta ) );
				}
				
			} )
			.catch( ( error ) => {
				console.error( error );
			} );
	}, [] );

	const handleTimeUpdate = ( player, time ) => {

		console.log('currentTime', currentTime);
		console.log('layer', layers);
		

		// Round the current time to 2 decimal places
		setCurrentTime( time.toFixed( 2 ) );

		// Check if the current time is greater than or equal to layer's display time.
		const activeGFLayer = layers.find( ( layer ) => layer.type === 'form' && time.toFixed( 2 ) >= layer.displayTime && viewedLayers.indexOf( layer.id ) === -1 );

		if ( activeGFLayer ) {
			player.pause(); // Pause the video
			fetchGravityForm( activeGFLayer.gf_id ); // Fetch Gravity Form with ID 1
			setShowForm( true ); // Show overlay
			setViewedLayers( [ ...viewedLayers, activeGFLayer.id ] );
		}
	};

	const handleCtaTimeUpdate =
		( player, time ) => {
			setCurrentTime( time.toFixed( 2 ) );
			// console.log("from function:", cta);

			// Show CTA at a specific timestamp
			if ( Math.floor( time ) >= 10 ) {
				player.pause();
				setShowForm( true );
			}
		};

	const saveAttachmentMeta = () => {
		// Update the attchment meta
		const data = {
			easydam_meta: { videoConfig, layers },
		};

		// update media meta via REST API
		axios.post( `/wp-json/wp/v2/media/${ attachmentID }`, data, {
			headers: {
				'X-WP-Nonce': videoData.nonce,
			},
		} )
			.then( ( response ) => {
				if ( response.status === 200 ) {
					// Dispatch the action to update the store
					dispatch( saveVideoMeta() );
					setShowSaveMessage( true );
					setTimeout( () => {
						setShowSaveMessage( false );
					}, 2500 );
				}
			} )
			.catch( ( error ) => {
				console.error( error );
			} );
	};

	// Fetch the Gravity Form HTML
	const fetchGravityForm = ( formId ) => {
		axios.get( `/wp-json/easydam/v1/gforms/${ formId }` )
			.then( ( response ) => {
				setFormHTML( response.data );
			} )
			.catch( ( error ) => {
				console.error( error );
			} );
	};

	useEffect( () => {
		if ( 'text' === cta?.type ) {
			const html = `<a href="${ cta.link }">${ cta.text }</a>`;
			setFormHTML( html );
		} else if ( 'html' === cta?.type ) {
			setFormHTML( cta.html );
		} else {
			setFormHTML( '' );
		}
	}, [ cta ] );

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
					<div id="sidebar-content" className="border-b">
						<TabPanel
							onSelect={ () => {} }
							className="sidebar-tabs"
							tabs={ [
								{
									name: 'layers',
									title: 'Layers',
									className: 'flex-1 justify-center items-center',
									component: <SidebarLayers currentTime={ currentTime } />,
								},
								{
									name: 'video-settings',
									title: 'Player Settings',
									component: <Appearance />,
								},
							] }
						>
							{ ( tab ) => tab.component }
						</TabPanel>
					</div>
				</aside>

				<main className="flex justify-center items-center p-4 relative">
					<Button
						className="absolute right-4 top-5"
						variant="primary"
						disabled={ ! isChanged }
						onClick={ saveAttachmentMeta }
					>{ __( 'Save', 'transcoder' ) }</Button>

					{
						// Display a success message when video changes are saved
						showSaveMessage &&
						<Snackbar className="absolute bottom-4 right-4 opacity-70">Video changes saved successfully</Snackbar>
					}

					{ video && (
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
									// onTimeupdate={ handleTimeUpdate }
									onTimeupdate={ handleCtaTimeUpdate }
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
											background: '#211F1F',
											padding: '20px',
											border: '2px solid black',
											display: 'flex',
											flexDirection: 'column',
											justifyContent: 'center',
											alignItems: 'center',
										} }
									>
										<div className="max-w-[400px]">
											<RenderDynamicContent
												content={ formHTML }
											/>
											<button
												className="absolute bottom-6 flex justify-center items-center gap-2 right-0 px-4 py-2 bg-blue-500 hover:bg-blue-700 text-white"
												onClick={ () => {
													setShowForm( false ); // Hide form overlay
													setLayers(
														layers.map( ( layer ) => {
															if ( layer.timestamp === 5 ) {
																return { ...layer, viewed: true };
															}
															return layer;
														} ),
													);
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

const RenderDynamicContent = ( { content } ) => {
	// useEffect( () => {
	// 	// Extract and execute scripts from the content.
	// 	const div = document.createElement( 'div' );
	// 	div.innerHTML = content;

	// 	// Extract all <script> tags.
	// 	const scripts = div.querySelectorAll( 'script' );
	// 	const styles = div.querySelectorAll( 'style' );

	// 	scripts.forEach( ( script ) => {
	// 		const newScript = document.createElement( 'script' );
	// 		newScript.type = 'text/javascript';
	// 		if ( script.src ) {
	// 			// For external scripts, copy the src.
	// 			newScript.src = script.src;
	// 		} else {
	// 			// For inline scripts, copy the content.
	// 			newScript.textContent = script.textContent;
	// 		}
	// 		// Append the script to the document head or body.
	// 		document.body.appendChild( newScript );

	// 		// Clean up after script is appended.
	// 		newScript.onload = () => {
	// 			newScript.remove();
	// 		};
	// 	} );

	// 	styles.forEach( ( style ) => {
	// 		console.log( style.textContent );

	// 		const newStyle = document.createElement( 'style' );
	// 		newStyle.textContent = style.textContent;
	// 		document.head.appendChild( newStyle );
	// 	} );
	// }, [ content ] ); // Run this effect whenever content changes

	return (
		<div
			dangerouslySetInnerHTML={ { __html: content } }
			style={ { overflow: 'hidden' } }
			className="overlay-content"
		></div>
	);
};

import Appearance from './components/appearance/Appearance';

const App = () => {
	return (
		<Provider store={ store }>
			<VideoEditor />
		</Provider>
	);
};

export default App;

ReactDOM.render( <App />, document.getElementById( 'root-video-editor' ) );
