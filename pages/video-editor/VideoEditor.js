/**
 * External dependencies
 */
import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, TabPanel, Snackbar, Tooltip, Spinner } from '@wordpress/components';
import { __, _n } from '@wordpress/i18n';
import { copy, seen } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import VideoJSPlayer from './VideoJSPlayer';
import SidebarLayers from './components/SidebarLayers';
import Appearance from './components/appearance/Appearance';
import {
	initializeStore,
	saveVideoMeta,
	setCurrentTab,
	setGravityForms,
	setCF7Forms,
	setWPForms,
	setSureforms,
	setForminatorForms,
	setFluentForms,
	setEverestForms,
	setNinjaForms,
	setMetforms,
} from './redux/slice/videoSlice';

import './video-editor.scss';
import { useGetAttachmentMetaQuery, useSaveAttachmentMetaMutation } from './redux/api/attachment';
import { useFetchForms } from './components/forms/fetchForms';
import Chapters from './components/chapters/Chapters';
import { copyGoDAMVideoBlock, prefetchMediaDataForCopy } from './utils/index';
import { getFormIdFromLayer } from './utils/formUtils';
import { canManageAttachment } from '../../assets/src/js/media-library/utility.js';

const VideoEditor = ( { attachmentID, onBackToAttachmentPicker } ) => {
	const [ currentTime, setCurrentTime ] = useState( 0 );
	const [ showSaveMessage, setShowSaveMessage ] = useState( false );
	const [ sources, setSources ] = useState( [] );
	const [ duration, setDuration ] = useState( 0 );
	const [ snackbarMessage, setSnackbarMessage ] = useState( '' );
	const [ showSnackbar, setShowSnackbar ] = useState( false );

	// Pre-fetch data on mount to ensure copy always works
	useEffect( () => {
		prefetchMediaDataForCopy( attachmentID );
	}, [ attachmentID ] );

	const playerRef = useRef( null );

	const dispatch = useDispatch();

	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const chapters = useSelector( ( state ) => state.videoReducer.chapters );
	const isChanged = useSelector( ( state ) => state.videoReducer.isChanged );

	const { data: attachmentConfig, isLoading: isAttachmentConfigLoading } = useGetAttachmentMetaQuery( attachmentID );
	const [ saveAttachmentMeta, { isLoading: isSavingMeta } ] = useSaveAttachmentMetaMutation();

	const { gravityForms, wpForms, cf7Forms, sureforms, forminatorForms, fluentForms, everestForms, ninjaForms, metforms, isFetching } = useFetchForms();

	useEffect( () => {
		const handleBeforeUnload = ( event ) => {
			if ( isChanged ) {
				event.preventDefault();
				event.returnValue = __( 'You have unsaved changes. Are you sure you want to leave?', 'godam' );
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
	}, [] );

	useEffect( () => {
		if ( ! attachmentConfig ) {
			return;
		}

		if ( ! canManageAttachment( attachmentConfig.author ) ) {
			onBackToAttachmentPicker();
		}

		const { rtgodam_meta: rtGodamMeta, source_url: sourceURL, mime_type: mimeType, meta } = attachmentConfig;

		// Initialize the store if meta exists
		if ( rtGodamMeta ) {
			dispatch( initializeStore( rtGodamMeta ) );
		}

		// Initialize video sources with the original source
		const videoSources = [];

		if ( sourceURL && mimeType ) {
			/**
			 * Fix for `mov` files, for able to play in VideoJS.
			 * This is a workaround for QuickTime files that are not natively supported by VideoJS.
			 * Since mov files are often encoded in h.264, we can treat them as mp4.
			 */
			const adjustedMimeType = mimeType === 'video/quicktime' ? 'video/mp4' : mimeType;
			videoSources.push( { src: sourceURL, type: adjustedMimeType } );
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
	}, [ attachmentConfig, dispatch, onBackToAttachmentPicker ] );

	/**
	 * Update the store with the fetched forms.
	 */
	useEffect( () => {
		if ( ! isFetching ) {
			if ( cf7Forms && cf7Forms.length > 0 ) {
				const _cf7Forms = cf7Forms.map( ( form ) => {
					return {
						id: form.id,
						title: form.title,
					};
				} );
				dispatch( setCF7Forms( _cf7Forms ) );
			}

			if ( wpForms && wpForms.length > 0 ) {
				dispatch( setWPForms( wpForms ) );
			}

			if ( everestForms && everestForms.length > 0 ) {
				dispatch( setEverestForms( everestForms ) );
			}

			if ( gravityForms && gravityForms.length > 0 ) {
				dispatch( setGravityForms( gravityForms ) );
			}

			if ( sureforms && sureforms.length > 0 ) {
				dispatch( setSureforms( sureforms ) );
			}

			if ( forminatorForms && forminatorForms.length > 0 ) {
				dispatch( setForminatorForms( forminatorForms ) );
			}

			if ( fluentForms && fluentForms.length > 0 ) {
				dispatch( setFluentForms( fluentForms ) );
			}

			if ( ninjaForms && ninjaForms.length > 0 ) {
				dispatch( setNinjaForms( ninjaForms ) );
			}

			if ( metforms && metforms.length > 0 ) {
				dispatch( setMetforms( metforms ) );
			}
		}
	}, [ gravityForms, cf7Forms, wpForms, everestForms, isFetching, dispatch, sureforms, forminatorForms, fluentForms, ninjaForms, metforms ] );

	const handleTimeUpdate = ( _, time ) => setCurrentTime( time.toFixed( 2 ) );
	const handlePlayerReady = ( player ) => {
		if ( player ) {
			playerRef.current = player;

			const playerEl = player.el_;
			const video = playerEl.querySelector( 'video' );

			if ( video ) {
				video.addEventListener( 'loadedmetadata', () => {
					setDuration( player.duration() );
				} );
			}
		}
	};
	const seekToTime = ( time ) => playerRef.current?.currentTime( time );
	const pauseVideo = () => playerRef.current?.pause();

	const validateLayers = ( videoLayers ) => {
		const invalidFormLayers = [];
		for ( const layer of videoLayers ) {
			if ( layer.type === 'form' ) {
				const formType = layer.form_type;
				const formId = getFormIdFromLayer( layer, formType );
				if ( ! formId ) {
					invalidFormLayers.push( layer.displayTime );
				}
			}
		}
		return invalidFormLayers;
	};

	const handleSaveAttachmentMeta = async () => {
		const invalidLayers = validateLayers( layers );
		// Validate form layers before saving.
		if ( invalidLayers.length > 0 ) {
			const layerTimes = invalidLayers.join( ', ' );
			setSnackbarMessage( _n( 'Please select a form for the layer at timestamp: ', 'Please select a form for the layers at timestamps: ', invalidLayers.length, 'godam' ) + layerTimes );
			setShowSnackbar( true );
			setTimeout( () => {
				setShowSnackbar( false );
			}, 3000 );
			return;
		}

		const data = {
			rtgodam_meta: { videoConfig, layers, chapters },
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

	const formatTimeForInput = ( seconds ) => {
		if ( seconds === null || isNaN( seconds ) ) {
			return '';
		}

		const hrs = Math.floor( seconds / 3600 );
		const mins = Math.floor( ( seconds % 3600 ) / 60 );
		const secsRaw = seconds % 60;

		const hrsStr = String( hrs ).padStart( 2, '0' );
		const minsStr = String( mins ).padStart( 2, '0' );
		const secsStr = secsRaw.toFixed( 2 ).padStart( 5, '0' ); // includes decimal, eg: 04.90

		if ( hrs > 0 ) {
			return `${ hrsStr }:${ minsStr }:${ secsStr }`;
		}
		return `${ minsStr }:${ secsStr }`;
	};

	const handleCopyGoDAMVideoBlock = async () => {
		const result = await copyGoDAMVideoBlock( attachmentID );

		if ( result ) {
			setSnackbarMessage( __( 'GoDAM Video Block copied to clipboard', 'godam' ) );
			setShowSnackbar( true );
		} else {
			setSnackbarMessage( __( 'Failed to copy GoDAM Video Block', 'godam' ) );
			setShowSnackbar( true );
		}
	};

	const handleOnSnackbarRemove = () => {
		setShowSnackbar( false );
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
					onPauseVideo={ pauseVideo }
					duration={ duration }
				/>
			),
		},
		{
			name: 'player-settings',
			title: __( 'Player Settings', 'godam' ),
			className: 'flex-1 justify-center items-center',
			component: <Appearance />,
		},
		{
			name: 'chapters',
			title: __( 'Chapters', 'godam' ),
			className: 'flex-1 justify-center items-center',
			component: (
				<Chapters
					currentTime={ currentTime }
					duration={ duration }
					formatTimeForInput={ formatTimeForInput }
				/>
			),
		},
	];

	if ( isAttachmentConfigLoading ) {
		return (
			<div className="flex gap-5 p-5">
				<div className="max-w-[360px] w-full loading-skeleton">
					<div className="skeleton-title"></div>
					<div className="skeleton-line"></div>
					<div className="skeleton-line"></div>
					<div className="skeleton-line"></div>
					<div className="skeleton-line"></div>
					<div className="skeleton-line"></div>
				</div>
				<div className="w-full loading-skeleton">
					<div className="skeleton-video-container"></div>
					<div className="max-w-[740px] mx-auto skeleton-line"></div>
				</div>
			</div>
		);
	}

	document.addEventListener( 'keydown', ( event ) => {
		if (
			event.target.tagName === 'INPUT' ||
			event.target.tagName === 'TEXTAREA' ||
			event.target.isContentEditable
		) {
			return;
		}

		if ( event.key === 'Backspace' ) {
			event.preventDefault();

			const backButton = document.querySelector( '.components-button.has-icon' );
			if ( backButton ) {
				backButton.click();
			}
		}
	} );

	return (
		<>
			<div className="video-editor-container">
				<div className="py-3 aside relative pl-4">
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
						className="godam-button absolute right-4 bottom-8 video-editor-save-button"
						variant="primary"
						icon={ isSavingMeta && <Spinner /> }
						onClick={ handleSaveAttachmentMeta }
						isBusy={ isSavingMeta }
						disabled={ ! isChanged }
					>
						{ isSavingMeta ? __( 'Saving…', 'godam' ) : __( 'Save', 'godam' ) }
					</Button>
				</div>

				<main className="flex flex-col items-center p-4 overflow-y-auto">

					{
						// Display a success message when video changes are saved.
						showSaveMessage && (
							<Snackbar className="absolute bottom-4 right-4 opacity-70 z-50">
								{ __( 'Video changes saved successfully', 'godam' ) }
							</Snackbar>
						)
					}

					{ showSnackbar && (
						<Snackbar className="absolute bottom-4 right-4 opacity-70 z-50"
							onRemove={ handleOnSnackbarRemove }
						>
							{ snackbarMessage }
						</Snackbar>
					) }

					<div className="flex space-x-2 justify-end items-center w-full mb-4">
						<Tooltip
							text={
								<p>
									{ __( 'You can copy the block into one of the two options:', 'godam' ) }
									<br />
									{ __( '1. Insert as a block in the Block editor.', 'godam' ) }
									<br />
									{ __( '2. Insert as HTML content in the Block editor.', 'godam' ) }
								</p>
							}
						>
							<Button
								variant="primary"
								icon={ copy }
								iconPosition="left"
								onClick={ handleCopyGoDAMVideoBlock }
								className="godam-button"
							>
								{ __( 'Copy Block', 'godam' ) }
							</Button>
						</Tooltip>
						<Button
							variant="primary"
							href={ `${ window?.godamRestRoute?.homeUrl }?godam_page=video-preview&id=${ attachmentID }` }
							target="_blank"
							className="godam-button"
							icon={ seen }
						>
							{ __( 'Preview', 'godam' ) }
						</Button>
					</div>

					{ attachmentConfig && sources.length > 0 && (
						<div className="w-full video-canvas-wrapper">
							<div className="relative">
								<VideoJSPlayer
									options={ {
										controls: true,
										fluid: true,
										preload: 'auto',
										flvjs: {
											mediaDataSource: {
												isLive: true,
												cors: false,
												withCredentials: false,
											},
										},
										aspectRatio: '16:9',
										sources,
										// VHS (HLS/DASH) initial configuration to prefer a ~14 Mbps start.
										// This only affects the initial bandwidth guess; VHS will continue to measure actual throughput and adapt.
										html5: {
											vhs: {
												bandwidth: 14_000_000, // Pretend network can do ~14 Mbps at startup
												bandwidthVariance: 1.0, // allow renditions close to estimate
												limitRenditionByPlayerDimensions: false, // don't cap by video element size
											},
										},
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
									formatTimeForInput={ formatTimeForInput }
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
