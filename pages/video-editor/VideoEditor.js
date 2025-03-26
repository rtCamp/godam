/**
 * External dependencies
 */
import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';

/**
 * Internal dependencies
 */
import VideoJSPlayer from './VideoJSPlayer';
import SidebarLayers from './components/SidebarLayers';
import Appearance from './components/appearance/Appearance';
import { initializeStore, saveVideoMeta, setCurrentTab, setLoading, setGravityForms, setGravityFormsPluginActive } from './redux/slice/videoSlice';

/**
 * WordPress dependencies
 */
import { Button, TabPanel, Snackbar } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const VideoEditor = ( { attachmentID } ) => {
	const videoData = window.videoData;

	const [ video, setVideo ] = useState( null );
	const [ currentTime, setCurrentTime ] = useState( 0 );
	const [ showSaveMessage, setShowSaveMessage ] = useState( false );
	const [ isSaving, setIsSaving ] = useState( false );
	const playerInstance = useRef( null );
	const [ sources, setSources ] = useState( [] );

	const dispatch = useDispatch();
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const isChanged = useSelector( ( state ) => state.videoReducer.isChanged );
	const loading = useSelector( ( state ) => state.videoReducer.loading );

	const restURL = window.godamRestRoute.url || '';

	useEffect( () => {
		const handleBeforeUnload = ( event ) => {
			if ( isChanged ) {
				event.preventDefault();
				event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
			}
		};

		window.addEventListener( 'beforeunload', handleBeforeUnload );
		return () => {
			window.removeEventListener( 'beforeunload', handleBeforeUnload );
		};
	}, [ isChanged ] );

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

		dispatch( setLoading( true ) );

		// Get the post data
		fetch( window.pathJoin( [ restURL, `/wp/v2/media/${ attachmentID }` ] ), {
			headers: {
				'X-WP-Nonce': videoData.nonce,
			},
		} )
			.then( ( response ) => response.json() )
			.then( ( data ) => {
				setVideo( data );
				const rtGodamMeta = data.rtgodam_meta;
				if ( rtGodamMeta ) {
					dispatch( initializeStore( rtGodamMeta ) );
				}
				// Set video sources
				const videoSources = [ { src: data.source_url, type: data.mimeType } ];
				if ( data?.meta?.rtgodam_transcoded_url !== '' ) {
					videoSources.push( { src: data.meta.rtgodam_transcoded_url, type: data?.meta?.rtgodam_transcoded_url.endsWith( '.mpd' ) ? 'application/dash+xml' : '' } );
				}
				setSources( videoSources );
			} )
			.catch( ( error ) => {
				console.error( error );
			} )
			.finally( () => {
				dispatch( setLoading( false ) );
			} );

		// Fetch Gravity Forms
		fetchGravityForms();
	}, [] );

	const handleTimeUpdate = ( player, time ) => {
		// Round the current time to 2 decimal places
		setCurrentTime( time.toFixed( 2 ) );
	};

	const handlePlayerReady = ( player ) => {
		playerInstance.current = player;
	};

	const seekToLayerTime = ( time ) => {
		if ( playerInstance.current ) {
			playerInstance.current.currentTime( time );
		}
	};

	const saveAttachmentMeta = () => {
		setIsSaving( true );
		// Update the attchment meta
		const data = {
			rtgodam_meta: { videoConfig, layers },
		};
		// update media meta via REST API
		axios.post( window.pathJoin( [ restURL, `/wp/v2/media/${ attachmentID }` ] ), data, {
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
			} )
			.finally( () => {
				setIsSaving( false );
			} );
	};

	const fetchGravityForms = () => {
		axios.get( window.pathJoin( [ restURL, '/godam/v1/gforms?fields=id,title,description' ] ) )
			.then( ( response ) => {
				const data = response.data;
				dispatch( setGravityForms( data ) );
			} )
			.catch( ( error ) => {
				if ( error.status === 404 && error.response.data.code === 'gravity_forms_not_active' ) {
					// Gravity Forms is not active.
					dispatch( setGravityFormsPluginActive( false ) );
				}
			} );
	};

	return (
		<>
			<div className="video-editor-container">
				<aside className="py-3">
					<div id="sidebar-content" className="border-b">
						<TabPanel
							onSelect={ ( tabName ) => {
								dispatch( setCurrentTab( tabName ) );
							} }
							className="sidebar-tabs"
							tabs={ [
								{
									name: 'layers',
									title: 'Layers',
									className: 'flex-1 justify-center items-center',
									component: <SidebarLayers
										currentTime={ currentTime }
										onSelectLayer={ ( layerTime ) => seekToLayerTime( layerTime ) }
									/>,
								},
								{
									name: 'player-settings',
									title: 'Player Settings',
									className: 'flex-1 justify-center items-center',
									component: <Appearance />,
								},
							] }
						>
							{ ( tab ) => tab.component }
						</TabPanel>
					</div>
				</aside>

				<main className="flex justify-center items-center p-4 relative overflow-y-auto">
					{ loading
						? <div className="absolute right-4 top-5 loading-skeleton">
							<div className="skeleton-button"></div>
						</div>
						: (
							<Button
								className="absolute right-4 top-5"
								variant="primary"
								disabled={ ! isChanged }
								onClick={ saveAttachmentMeta }
								isBusy={ isSaving }
							>
								{ __( 'Save', 'godam' ) }
							</Button> )
					}

					{
						// Display a success message when video changes are saved
						showSaveMessage && (
							<Snackbar className="absolute bottom-4 right-4 opacity-70">
								{ __( 'Video changes saved successfully', 'godam' ) }
							</Snackbar>
						)
					}

					{ ! loading && video && (
						<div className="max-w-[740px] w-full">
							<h1 className="text-slate-700 text-base mb-1">{ video.title.rendered }</h1>

							<div className="relative">

								<VideoJSPlayer
									options={ {
										controls: true,
										fluid: true,
										preload: 'auto',
										width: '100%',
										sources,
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
									onReady={ handlePlayerReady }
									playbackTime={ currentTime }
								/>
							</div>
						</div>
					) }

					{
						loading && (
							<div className="max-w-[740px] w-full loading-skeleton">
								<div className="skeleton-video-container"></div>
								<div className="skeleton-line"></div>
							</div>
						)
					}
				</main>
			</div>
		</>
	);
};

export default VideoEditor;
