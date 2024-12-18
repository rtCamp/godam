/**
 * External dependencies
 */
import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import { FastForwardFill } from 'react-bootstrap-icons';
import { useSelector, useDispatch, Provider } from 'react-redux';
import axios from 'axios';
/**
 * Internal dependencies
 */
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
	const [ showSaveMessage, setShowSaveMessage ] = useState( false );

	const dispatch = useDispatch();
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const isChanged = useSelector( ( state ) => state.videoReducer.isChanged );

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
					>
						{ __( 'Save', 'transcoder' ) }
					</Button>

					{
						// Display a success message when video changes are saved
						showSaveMessage && (
							<Snackbar className="absolute bottom-4 right-4 opacity-70">
								{ __( 'Video changes saved successfully', 'transcoder' ) }
							</Snackbar>
						)
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
									onTimeupdate={ handleTimeUpdate }
									// onTimeupdate={ handleCtaTimeUpdate }
								/>
							</div>
							<div className="mt-2">Timestamp: { currentTime }</div>
						</div>
					) }
				</main>
			</div>
		</>
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
