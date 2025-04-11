/**
 * External dependencies
 */
import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';

/**
 * WordPress dependencies
 */
import { Button, TabPanel, Snackbar } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import VideoJSPlayer from './VideoJSPlayer';
import SidebarLayers from './components/SidebarLayers';
import Appearance from './components/appearance/Appearance';
import { initializeStore, saveVideoMeta, setCurrentTab, setLoading, setGravityForms, setGravityFormsPluginActive, SetCF7PluginActive, setCF7Forms, setNinjaForms, setNinjaFormPluginActive } from './redux/slice/videoSlice';

import './video-editor.scss';
import { useGetAttachmentMetaQuery, useSaveAttachmentMetaMutation } from './redux/api/attachment';
import { useGetFormsQuery } from './redux/api/gravity-forms';

const VideoEditor = ( { attachmentID } ) => {
	const [ currentTime, setCurrentTime ] = useState( 0 );
	const [ showSaveMessage, setShowSaveMessage ] = useState( false );
	const [ sources, setSources ] = useState( [] );

	const playerRef = useRef( null );

	const dispatch = useDispatch();

	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const isChanged = useSelector( ( state ) => state.videoReducer.isChanged );

	const { data: attachmentConfig, isLoading: isAttachmentConfigLoading } = useGetAttachmentMetaQuery( attachmentID );
	const [ saveAttachmentMeta, { isLoading: isSavingMeta } ] = useSaveAttachmentMetaMutation();
	const { data: gravityForms, isError: isGravityFormError } = useGetFormsQuery();

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
		// Collapse the admin sidebar
		const body = document.querySelector( 'body' );
		if ( body ) {
			body.classList.add( 'folded' );
		}

		dispatch( setLoading( true ) );

		// Get the post data
		fetch( window.pathJoin( [ restURL, `/wp/v2/media/${ attachmentID }` ] ), {
			headers: {
				'X-WP-Nonce': window.videoData.nonce,
			},
		} )
			.then( ( response ) => response.json() )
			.then( ( data ) => {
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
			.catch( ( ) => {
				// Todo: Show proper error message to the user
			} )
			.finally( () => {
				dispatch( setLoading( false ) );
			} );

		// Fetch Contact Form 7 Forms
		fetchCF7Forms();
		// Fetch Ninja Forms
		fetchNinjaForms();
	}, [] );

	useEffect( () => {
		if ( ! attachmentConfig ) {
			return;
		}

		const { rtgodam_meta: rtGodamMeta, source_url: sourceURL, mime_type: mimeType, meta } = attachmentConfig;

		// Initialize the store if meta exists
		if ( rtGodamMeta ) {
			dispatch( initializeStore( rtGodamMeta ) );
		}

		// Initialize video sources with the original source
		const videoSources = [];

		if ( sourceURL && mimeType ) {
			videoSources.push( { src: sourceURL, type: mimeType } );
		}

		// Add transcoded video source if valid
		const transcodedUrl = meta?.rtgodam_transcoded_url;
		if ( transcodedUrl && typeof transcodedUrl === 'string' && transcodedUrl.trim() !== '' ) {
			const transcodedType = transcodedUrl.endsWith( '.mpd' )
				? 'application/dash+xml'
				: undefined;

			videoSources.push( { src: transcodedUrl, type: transcodedType } );
		}

		setSources( videoSources );
	}, [ attachmentConfig, dispatch ] );

	/**
	 * This gravity form plugin logic should be moved to the appropriate layer component, instead of globally here.
	 */
	useEffect( () => {
		if ( gravityForms ) {
			dispatch( setGravityForms( gravityForms ) );
		}

		if ( isGravityFormError ) {
			dispatch( setGravityFormsPluginActive( false ) );
		}
	}, [ gravityForms, isGravityFormError, dispatch ] );

	const handleTimeUpdate = ( _, time ) => setCurrentTime( time.toFixed( 2 ) );
	const handlePlayerReady = ( player ) => ( playerRef.current = player );
	const seekToTime = ( time ) => playerRef.current?.currentTime( time );

	const handleSaveAttachmentMeta = async () => {
		const data = {
			rtgodam_meta: { videoConfig, layers },
		};

		const response = await saveAttachmentMeta( { id: attachmentID, data } ).unwrap();

		if ( response ) {
			// Dispatch the action to update the store
			dispatch( saveVideoMeta() );
			setShowSaveMessage( true );
			setTimeout( () => {
				setShowSaveMessage( false );
			}, 3000 );
		}
	};

	const tabConfig = [
		{
			name: 'layers',
			title: __( 'Layers', 'godam' ),
			className: 'flex-1 justify-center items-center',
			component: (
				<SidebarLayers
					currentTime={ currentTime }
					onSelectLayer={ seekToTime }
				/>
			),
		},
		{
			name: 'player-settings',
			title: __( 'Player Settings', 'godam' ),
			className: 'flex-1 justify-center items-center',
			component: <Appearance />,
		},
	];

	if ( isAttachmentConfigLoading ) {
		return (
			<div className="max-w-[740px] w-full loading-skeleton">
				<div className="skeleton-video-container"></div>
				<div className="skeleton-line"></div>
			</div>
		);
	}

	function fetchCF7Forms() {
		axios.get( window.pathJoin( [ restURL, '/contact-form-7/v1/contact-forms' ] ), {
			headers: {
				'X-WP-Nonce': window.videoData.nonce,
			},
		} )
			.then( ( response ) => {
				const data = response.data;
				dispatch( setCF7Forms( data ) );
			} )
			.catch( ( error ) => {
				if ( error.status === 404 && error.response.data.code === 'rest_no_route' ) {
					// CF7 Forms is not active.
					dispatch( SetCF7PluginActive( false ) );
				}
			} );
	}

	function fetchNinjaForms() {
		axios.get( window.pathJoin( [ restURL, '/godam/v1/ninja-forms' ] ) )
			.then( ( response ) => {
				const data = response.data;
				dispatch( setNinjaForms( data ) );
			} )
			.catch( ( error ) => {
				if ( error.status === 404 && error.response.data.code === 'gravity_forms_not_active' ) {
					// Gravity Forms is not active.
					dispatch( setNinjaFormPluginActive( false ) );
				}
			} );
	}

	return (
		<>
			<div className="video-editor-container">
				<div className="py-3 aside relative">
					<div id="sidebar-content" className="godam-video-editor">
						<TabPanel
							className="godam-video-editor-tabs"
							tabs={ tabConfig }
							onSelect={ ( tabName ) => dispatch( setCurrentTab( tabName ) ) }
						>
							{ ( tab ) => tab.component }
						</TabPanel>
					</div>

					<Button
						className="godam-button absolute right-4 bottom-8"
						variant="primary"
						disabled={ ! isChanged }
						onClick={ handleSaveAttachmentMeta }
						isBusy={ isSavingMeta }
					>
						{ __( 'Save', 'godam' ) }
					</Button>
				</div>

				<main className="flex justify-center items-center p-4 relative overflow-y-auto">

					{
						// Display a success message when video changes are saved
						showSaveMessage && (
							<Snackbar className="absolute bottom-4 right-4 opacity-70">
								{ __( 'Video changes saved successfully', 'godam' ) }
							</Snackbar>
						)
					}

					{ attachmentConfig && sources.length > 0 && (
						<div className="w-full">
							<div className="relative">
								<VideoJSPlayer
									options={ {
										controls: true,
										fluid: true,
										preload: 'auto',
										width: '100%',
										sources,
										controlBar: {
											playToggle: true,
											volumePanel: true,
											currentTimeDisplay: true,
											timeDivider: true,
											durationDisplay: true,
											fullscreenToggle: true,
											subsCapsButton: true,
											skipButtons: {
												forward: 10,
												backward: 10,
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
				</main>
			</div>
		</>
	);
};

export default VideoEditor;
