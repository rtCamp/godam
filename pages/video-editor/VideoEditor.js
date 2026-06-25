/**
 * External dependencies
 */
import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Snackbar } from '@wordpress/components';
import { __, _n } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import VideoJSPlayer from './VideoJSPlayer';
import SidebarLayers from './components/SidebarLayers';
import Appearance from './components/appearance/Appearance';
import EditorTopBar from './components/editor-shell/EditorTopBar';
import EditorStatsRow from './components/editor-shell/EditorStatsRow';
import EditorTabRail from './components/editor-shell/EditorTabRail';
import ConfigurationPanel from './components/editor-shell/ConfigurationPanel';
import EditorSkeleton from './components/editor-shell/EditorSkeleton';
import {
	initializeStore,
	saveVideoMeta,
	setCurrentTab,
	setCurrentLayer,
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
import Timeline from './components/timeline/Timeline';
import { copyGoDAMVideoBlock, prefetchMediaDataForCopy } from './utils/index';
import { getFormIdFromLayer } from './utils/formUtils';
import { canManageAttachment } from '../../assets/src/js/media-library/utility.js';
import { ensureAddonLayersRegistered } from './utils/loadAddonLayers';

const VideoEditor = ( { attachmentID, onBackToAttachmentPicker } ) => {
	const [ currentTime, setCurrentTime ] = useState( 0 );
	const [ showSaveMessage, setShowSaveMessage ] = useState( false );
	const [ sources, setSources ] = useState( [] );
	const [ duration, setDuration ] = useState( 0 );
	const [ snackbarMessage, setSnackbarMessage ] = useState( '' );
	const [ showSnackbar, setShowSnackbar ] = useState( false );
	const [ aspectRatio, setAspectRatio ] = useState( '16:9' );

	// Pre-fetch data on mount to ensure copy always works
	useEffect( () => {
		prefetchMediaDataForCopy( attachmentID );
	}, [ attachmentID ] );

	useEffect( () => {
		// Verify add-on layer components are registered via PHP filters.
		ensureAddonLayersRegistered();
	}, [] );

	const playerRef = useRef( null );

	const dispatch = useDispatch();

	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const chapters = useSelector( ( state ) => state.videoReducer.chapters );
	const isChanged = useSelector( ( state ) => state.videoReducer.isChanged );
	const currentTab = useSelector( ( state ) => state.videoReducer.currentTab );
	const currentLayer = useSelector( ( state ) => state.videoReducer.currentLayer );

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

	// Backspace returns from a selected layer to the layer list (ignoring text fields).
	useEffect( () => {
		const handleKeyDown = ( event ) => {
			if (
				event.target.tagName === 'INPUT' ||
				event.target.tagName === 'TEXTAREA' ||
				event.target.isContentEditable
			) {
				return;
			}

			if ( event.key === 'Backspace' && currentLayer ) {
				event.preventDefault();
				dispatch( setCurrentLayer( null ) );
			}
		};

		document.addEventListener( 'keydown', handleKeyDown );
		return () => document.removeEventListener( 'keydown', handleKeyDown );
	}, [ currentLayer, dispatch ] );

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

		const { rtgodam_meta: rtGodamMeta, source_url: sourceURL, mime_type: mimeType, meta, media_details: mediaDetails } = attachmentConfig;

		// Calculate aspect ratio from video dimensions if available
		// WordPress stores video dimensions in media_details object
		const videoWidth = mediaDetails?.width || meta?.width;
		const videoHeight = mediaDetails?.height || meta?.height;

		if ( videoWidth && videoHeight ) {
			const calculatedAspectRatio = `${ videoWidth }:${ videoHeight }`;
			setAspectRatio( calculatedAspectRatio );
		}

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
	// Deep-link from the Video Layer Timeline on the analytics page: a URL
	// with `#layer=<uuid>` should land here with the matching layer focused.
	// Runs once per layers-state-change; the `hashFocusAppliedRef` guards
	// against re-firing if the user navigates within the editor and the
	// layers array re-references.
	const hashFocusAppliedRef = useRef( false );
	useEffect( () => {
		if ( hashFocusAppliedRef.current ) {
			return;
		}
		if ( ! Array.isArray( layers ) || layers.length === 0 ) {
			return;
		}
		// Match exactly `#layer=<uuid>`; accept hex/uuid-ish chars only so
		// stray hashes don't trigger.
		const hash = window.location.hash || '';
		const match = hash.match( /^#layer=([A-Za-z0-9_-]{1,64})$/ );
		if ( ! match ) {
			return;
		}
		const targetLayerId = match[ 1 ];
		const layer = layers.find( ( l ) => l.id === targetLayerId );
		if ( layer ) {
			dispatch( setCurrentLayer( layer ) );
			hashFocusAppliedRef.current = true;
		}
	}, [ layers, dispatch ] );

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
				video.onloadedmetadata = () => {
					setDuration( player.duration() );

					// Prefer metadata dimensions; virtual media can be missing attachment dimensions.
					const videoWidth = video.videoWidth;
					const videoHeight = video.videoHeight;

					if ( videoWidth && videoHeight ) {
						const metadataAspectRatio = `${ videoWidth }:${ videoHeight }`;
						setAspectRatio( metadataAspectRatio );
						player.aspectRatio( metadataAspectRatio );
					}

					const [ fallbackW, fallbackH ] = String( aspectRatio || '16:9' )
						.split( ':' )
						.map( ( value ) => Number( value ) );
					const widthForCalc = videoWidth || ( Number.isFinite( fallbackW ) && fallbackW > 0 ? fallbackW : 16 );
					const heightForCalc = videoHeight || ( Number.isFinite( fallbackH ) && fallbackH > 0 ? fallbackH : 9 );

					// Set width based on aspect ratio for 500px height
					const targetHeight = 500;
					const calculatedWidth = Math.round( targetHeight * ( widthForCalc / heightForCalc ) );
					const canvasWrapper = document.querySelector( '.video-canvas-wrapper' );
					const containerWidth = canvasWrapper?.getBoundingClientRect().width;
					const maxWidth = containerWidth ? Math.floor( containerWidth ) : window.innerWidth;
					const constrainedWidth = Math.min( calculatedWidth, maxWidth );

					// Find the easydam-video-player wrapper and set its width
					const videoPlayerElement = document.querySelector( '#easydam-video-player' );
					if ( videoPlayerElement ) {
						videoPlayerElement.style.width = `${ constrainedWidth }px`;
					}
				};

				if ( video.readyState >= 1 ) {
					video.onloadedmetadata();
				}
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
			setSnackbarMessage( _n( 'Please select a form for the layer at timestamp:', 'Please select a form for the layers at timestamps:', invalidLayers.length, 'godam' ) + layerTimes );
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

	if ( isAttachmentConfigLoading ) {
		return <EditorSkeleton />;
	}

	const videoTitle =
		attachmentConfig?.title?.rendered ||
		attachmentConfig?.title ||
		__( 'Untitled video', 'godam' );

	return (
		<div className="godam-video-editor">
			<EditorTopBar
				title={ videoTitle }
				layerCount={ layers.length }
				attachmentID={ attachmentID }
				isChanged={ isChanged }
				isSaving={ isSavingMeta }
				onBack={ onBackToAttachmentPicker }
				onSave={ handleSaveAttachmentMeta }
				onCopy={ handleCopyGoDAMVideoBlock }
			/>

			<EditorStatsRow attachmentID={ attachmentID } />

			<div className="godam-video-editor__body">
				<EditorTabRail
					currentTab={ currentTab }
					onSelect={ ( tabName ) => dispatch( setCurrentTab( tabName ) ) }
				/>

				<aside className="godam-video-editor__panel">
					{ currentTab === 'layers' && (
						<SidebarLayers
							currentTime={ currentTime }
							onSelectLayer={ seekToTime }
							onPauseVideo={ pauseVideo }
							duration={ duration }
						/>
					) }
					{ currentTab === 'player-settings' && <Appearance attachmentID={ attachmentID } /> }
					{ currentTab === 'chapters' && (
						<Chapters
							duration={ duration }
							formatTimeForInput={ formatTimeForInput }
							onSelectChapter={ seekToTime }
						/>
					) }
				</aside>

				<main className="godam-video-editor__stage">
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

					<div className="godam-video-editor__stage-canvas">
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
											aspectRatio,
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
												fullscreenToggle: false,
												subsCapsButton: true,
												skipButtons: false,
												pictureInPictureToggle: false,
											},
										} }
										onTimeupdate={ handleTimeUpdate }
										onReady={ handlePlayerReady }
										playbackTime={ currentTime }
									/>
								</div>
							</div>
						) }
					</div>

					{ attachmentConfig && sources.length > 0 &&
						( currentTab === 'layers' || currentTab === 'chapters' ) && (
						<div className="godam-video-editor__timeline-dock">
							<Timeline
								currentTime={ currentTime }
								duration={ duration }
								onSeek={ seekToTime }
								formatTimeForInput={ formatTimeForInput }
							/>
						</div>
					) }
				</main>

				{ currentTab === 'layers' && (
					<aside className="godam-video-editor__config">
						<ConfigurationPanel duration={ duration } />
					</aside>
				) }
			</div>
		</div>
	);
};

export default VideoEditor;
