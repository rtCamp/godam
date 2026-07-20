/**
 * External dependencies
 */
import React, { useCallback, useEffect, useState, useRef } from 'react';
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
import AudioCardPreview from './components/audio/AudioCardPreview';
import ImagePreview from './components/image/ImagePreview';
import SidebarLayers from './components/SidebarLayers';
import Appearance from './components/appearance/Appearance';
import EditorTopBar from './components/editor-shell/EditorTopBar';
import EditorStatsRow from './components/editor-shell/EditorStatsRow';
import EditorTabRail from './components/editor-shell/EditorTabRail';
import ConfigurationPanel from './components/editor-shell/ConfigurationPanel';
import EditorSkeleton from './components/editor-shell/EditorSkeleton';
import { getCapabilityForMime } from './config/mediaCapabilities';
import {
	initializeStore,
	saveVideoMeta,
	setCurrentTab,
	setCurrentLayer,
	setMediaType,
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
import Transcription from './components/transcription/Transcription';
import { formatBytes } from './components/transcription/utils';
import Timeline from './components/timeline/Timeline';
import { copyGoDAMVideoBlock, prefetchMediaDataForCopy } from './utils/index';
import { openAttachmentDetailsModal } from './utils/openAttachmentDetails';
import { getFormIdFromLayer } from './utils/formUtils';
import { canManageAttachment } from '../../assets/src/js/media-library/utility.js';
import { ensureAddonLayersRegistered } from './utils/loadAddonLayers';

/**
 * Decode HTML entities in a string (e.g. `&amp;` → `&`).
 *
 * The REST API returns the attachment title as `title.rendered`, which is
 * entity-encoded. We decode it so the editable input shows the human-readable
 * title rather than raw entities.
 *
 * @param {string} str Possibly entity-encoded string.
 * @return {string} Decoded string.
 */
const decodeHtmlEntities = ( str ) => {
	if ( ! str ) {
		return '';
	}
	const textarea = document.createElement( 'textarea' );
	textarea.innerHTML = str;
	return textarea.value;
};

const VideoEditor = ( { attachmentID, onBackToAttachmentPicker } ) => {
	const [ currentTime, setCurrentTime ] = useState( 0 );
	const [ showSaveMessage, setShowSaveMessage ] = useState( false );
	const [ sources, setSources ] = useState( [] );
	const [ duration, setDuration ] = useState( 0 );
	const [ snackbarMessage, setSnackbarMessage ] = useState( '' );
	const [ showSnackbar, setShowSnackbar ] = useState( false );
	const [ aspectRatio, setAspectRatio ] = useState( '16:9' );
	const [ videoTitle, setVideoTitle ] = useState( '' );

	useEffect( () => {
		// Verify add-on layer components are registered via PHP filters.
		ensureAddonLayersRegistered();
	}, [] );

	const playerRef = useRef( null );
	// For audio, playback is owned by AudioCardPreview; it assigns a seek fn here
	// so the Chapters tab can scrub the preview (video uses `playerRef`).
	const audioSeekRef = useRef( null );
	// Wraps the video preview; its width drives the player's computed width.
	const canvasWrapperRef = useRef( null );
	// The stage area that holds the preview; its width AND height bound the
	// preview (the layers/chapters tabs dock a timeline that eats vertical room).
	const stageCanvasRef = useRef( null );
	// Teardown for the "Edit metadata" popup's title-sync listener; called on unmount.
	const detachTitleSyncRef = useRef( null );

	const dispatch = useDispatch();

	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const chapters = useSelector( ( state ) => state.videoReducer.chapters );
	const isChanged = useSelector( ( state ) => state.videoReducer.isChanged );
	const currentTab = useSelector( ( state ) => state.videoReducer.currentTab );
	const currentLayer = useSelector( ( state ) => state.videoReducer.currentLayer );

	const { data: attachmentConfig, isLoading: isAttachmentConfigLoading } = useGetAttachmentMetaQuery( attachmentID );
	const [ saveAttachmentMeta, { isLoading: isSavingMeta } ] = useSaveAttachmentMetaMutation();
	// A separate mutation instance so saving the title doesn't flip the
	// "Save Video" button into its busy state.
	const [ saveTitle ] = useSaveAttachmentMetaMutation();

	// Resolve the media-type capability from the attachment MIME. Before the
	// attachment loads this falls back to the video descriptor (a no-op).
	const capability = getCapabilityForMime( attachmentConfig?.mime_type );

	// Pre-fetch data so copy always works. Re-runs once the capability is known
	// (after the attachment loads) so the correct block markup is cached.
	useEffect( () => {
		prefetchMediaDataForCopy( attachmentID, {
			blockName: capability.copyBlockName,
			mediaType: capability.mediaType,
		} );
	}, [ attachmentID, capability.copyBlockName, capability.mediaType ] );

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

		// Apply the media-type capability (allowed tabs / layer types, default
		// tab) before seeding the store so the correct tab is active on open.
		const mediaCapability = getCapabilityForMime( mimeType );
		dispatch( setMediaType( {
			mediaType: mediaCapability.mediaType,
			tabs: mediaCapability.tabs,
			defaultTab: mediaCapability.defaultTab,
			allowedLayerTypes: mediaCapability.allowedLayerTypes,
		} ) );

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

	// Seed the editable title from the fetched attachment. `title.raw` is only
	// present in edit context; otherwise decode the entity-encoded rendered
	// title so the input shows plain text.
	useEffect( () => {
		if ( ! attachmentConfig ) {
			return;
		}
		const rawTitle = attachmentConfig?.title?.raw;
		const renderedTitle = attachmentConfig?.title?.rendered ?? attachmentConfig?.title;
		setVideoTitle( rawTitle ?? decodeHtmlEntities( renderedTitle ) );
	}, [ attachmentConfig ] );

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

	// Deep-link to a specific editor section: a URL with `?tab=<name>` lands
	// here with the matching tab pre-selected (e.g. the block editor's
	// "Click here to upload subtitles" notice links to `&tab=transcription`).
	// `setCurrentTab` ignores unknown names, so invalid values are harmless.
	// Applied once per mount so manual tab switches aren't overridden.
	const tabFocusAppliedRef = useRef( false );
	useEffect( () => {
		if ( tabFocusAppliedRef.current ) {
			return;
		}
		const requestedTab = new URLSearchParams( window.location.search ).get( 'tab' );
		if ( requestedTab ) {
			dispatch( setCurrentTab( requestedTab ) );
		}
		tabFocusAppliedRef.current = true;
	}, [ dispatch ] );

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

	// Size the video preview so it fits the stage in BOTH dimensions.
	//
	// The preview is height-driven: it aims for a 500px-tall preview, but never
	// taller than the vertical room the stage actually has — the layers/chapters
	// tabs dock a timeline at the bottom, so on shorter viewports there is less
	// height to work with. The width follows from the winning height and is then
	// clamped to the container width.
	//
	// A minimum width keeps short viewports from shrinking the preview to
	// nothing: once the width hits `MIN_PREVIEW_WIDTH` it stops shrinking and the
	// stage scrolls instead. The floor never exceeds the video's natural
	// (500px-tall) width, so portrait clips are never stretched wider than their
	// own aspect ratio. A ResizeObserver on the stage drives re-runs.
	const resizeVideoPlayer = useCallback( () => {
		const player = playerRef.current;
		const video = player?.el_?.querySelector( 'video' );

		// Prefer metadata dimensions; fall back to the aspect-ratio state
		// (virtual media can be missing intrinsic video dimensions).
		const [ fallbackW, fallbackH ] = String( aspectRatio || '16:9' )
			.split( ':' )
			.map( ( value ) => Number( value ) );
		const widthForCalc = video?.videoWidth || ( Number.isFinite( fallbackW ) && fallbackW > 0 ? fallbackW : 16 );
		const heightForCalc = video?.videoHeight || ( Number.isFinite( fallbackH ) && fallbackH > 0 ? fallbackH : 9 );
		const ratio = widthForCalc / heightForCalc;

		const MAX_PREVIEW_HEIGHT = 500;
		const MIN_PREVIEW_WIDTH = 400;
		// Breathing room so the preview never butts against the timeline dock.
		const VERTICAL_BUFFER = 16;

		// Vertical room: the stage-canvas height, minus buffer. Fall back to the
		// full target height when the element isn't measurable yet.
		const stageHeight = stageCanvasRef.current?.clientHeight;
		const availableHeight = stageHeight ? stageHeight - VERTICAL_BUFFER : MAX_PREVIEW_HEIGHT;
		const targetHeight = Math.max( 1, Math.min( MAX_PREVIEW_HEIGHT, availableHeight ) );

		// Horizontal room: the preview wrapper (already capped at a fraction of
		// the stage via CSS `max-width`).
		const containerWidth = canvasWrapperRef.current?.getBoundingClientRect().width;
		const maxWidth = containerWidth ? Math.floor( containerWidth ) : window.innerWidth;

		const naturalWidth = MAX_PREVIEW_HEIGHT * ratio; // width at the full 500px height
		const heightFitWidth = targetHeight * ratio; // width that fits the available height

		// Never floor above the natural width (portrait clips) or the container.
		const floor = Math.min( MIN_PREVIEW_WIDTH, Math.floor( naturalWidth ), maxWidth );
		const constrainedWidth = Math.round(
			Math.max( floor, Math.min( heightFitWidth, maxWidth ) ),
		);

		const videoPlayerElement = document.querySelector( '#easydam-video-player' );
		if ( videoPlayerElement ) {
			videoPlayerElement.style.width = `${ constrainedWidth }px`;
		}
	}, [ aspectRatio ] );

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

					resizeVideoPlayer();
				};

				if ( video.readyState >= 1 ) {
					video.onloadedmetadata();
				}
			}
		}
	};

	// Keep the preview sized to the stage whenever the stage changes size. We
	// observe the stage-canvas (not the preview wrapper) because it reflects
	// BOTH axes: its width changes on tab switches (the Configuration Panel
	// appears only on the "layers" tab) and the admin-sidebar collapse, and its
	// height changes when the timeline dock mounts/unmounts or the window is
	// resized. The stage-canvas is flex-sized by its parent and scrolls its
	// overflow, so re-sizing the preview inside it never changes its own size —
	// the observer can't feed back into itself.
	useEffect( () => {
		const stageCanvas = stageCanvasRef.current;
		if ( ! stageCanvas || typeof ResizeObserver === 'undefined' ) {
			return;
		}

		let rafId = null;
		const observer = new ResizeObserver( () => {
			// Defer to the next frame so the resize runs after layout settles,
			// avoiding ResizeObserver loop warnings.
			if ( rafId ) {
				cancelAnimationFrame( rafId );
			}
			rafId = requestAnimationFrame( resizeVideoPlayer );
		} );
		observer.observe( stageCanvas );

		return () => {
			if ( rafId ) {
				cancelAnimationFrame( rafId );
			}
			observer.disconnect();
		};
	}, [ resizeVideoPlayer, sources ] );

	// Seek the active preview: the VideoJS player for video, or the audio
	// preview's element (via `audioSeekRef`) for audio.
	const seekToTime = ( time ) => {
		if ( playerRef.current ) {
			playerRef.current.currentTime( time );
		} else if ( audioSeekRef.current ) {
			audioSeekRef.current( time );
		}
	};
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
		const result = await copyGoDAMVideoBlock( attachmentID, {
			blockName: capability.copyBlockName,
			mediaType: capability.mediaType,
		} );

		if ( result ) {
			setSnackbarMessage( __( 'GoDAM block copied to clipboard', 'godam' ) );
			setShowSnackbar( true );
		} else {
			setSnackbarMessage( __( 'Failed to copy GoDAM block', 'godam' ) );
			setShowSnackbar( true );
		}
	};

	const handleOnSnackbarRemove = () => {
		setShowSnackbar( false );
	};

	// Opens the same attachment-details popup used in the media library, so
	// core metadata (title, alt text, caption, description) can be edited
	// without leaving the editor. Title edits made in the popup are mirrored
	// back to the editor's top bar so the two stay in sync.
	const handleEditMetadata = () => {
		const teardown = openAttachmentDetailsModal( attachmentID, {
			onChange: ( attributes ) => {
				const nextTitle = attributes?.title;
				if ( typeof nextTitle === 'string' ) {
					setVideoTitle( decodeHtmlEntities( nextTitle ) );
				}
			},
		} );
		detachTitleSyncRef.current = typeof teardown === 'function' ? teardown : null;
	};

	// The wp.media attachment model is cached globally and outlives this
	// component, so unbind the popup's title-sync listener on unmount to avoid
	// retaining a stale reference to this instance's setVideoTitle.
	useEffect( () => {
		return () => {
			detachTitleSyncRef.current?.();
			detachTitleSyncRef.current = null;
		};
	}, [] );

	// Label the "Edit metadata" action by the attachment's media type. In the
	// video editor this is always a video, but derive it generically so the
	// wording stays correct if other media types are ever edited here.
	const getEditMetadataLabel = () => {
		const mimeGroup = ( attachmentConfig?.mime_type || '' ).split( '/' )[ 0 ];

		switch ( mimeGroup ) {
			case 'video':
				return __( 'Edit video metadata', 'godam' );
			case 'image':
				return __( 'Edit image metadata', 'godam' );
			case 'audio':
				return __( 'Edit audio metadata', 'godam' );
			default:
				return __( 'Edit metadata', 'godam' );
		}
	};

	// Persist an edited video title to the attachment. Updates the display
	// optimistically and reverts if the request fails.
	const handleSaveTitle = async ( newTitle ) => {
		const previousTitle = videoTitle;
		setVideoTitle( newTitle );

		try {
			await saveTitle( { id: attachmentID, data: { title: newTitle } } ).unwrap();

			// Keep the wp.media Backbone model — the data layer the "Edit
			// metadata" popup reads — in sync so the two don't drift.
			//
			// We deliberately do NOT invalidate/refetch the getAttachmentMeta
			// RTK query: that same query seeds the layer store via the init
			// effect, so a refetch would re-run initializeStore() and discard
			// unsaved layer edits (and reload the video). The title display is
			// driven by local `videoTitle` state, which we already updated.
			const attachmentModel = window.wp?.media?.attachment?.( attachmentID );
			if ( attachmentModel && attachmentModel.get( 'title' ) !== newTitle ) {
				attachmentModel.set( 'title', newTitle );
			}

			setSnackbarMessage( __( 'Title updated', 'godam' ) );
			setShowSnackbar( true );
		} catch ( error ) {
			setVideoTitle( previousTitle );
			setSnackbarMessage( __( 'Failed to update title', 'godam' ) );
			setShowSnackbar( true );
		}
	};

	// Switch the active section and reflect it in the URL so a refresh or
	// bookmark preserves the user's place. `replaceState` is used so each tab
	// switch doesn't push a new browser-history entry.
	const handleSelectTab = ( tabName ) => {
		dispatch( setCurrentTab( tabName ) );
		const url = new URL( window.location.href );
		url.searchParams.set( 'tab', tabName );
		window.history.replaceState( {}, '', url );
	};

	if ( isAttachmentConfigLoading ) {
		return <EditorSkeleton />;
	}

	// Fallback title matches the attachment's media type (video/audio/image).
	const untitledLabel = {
		audio: __( 'Untitled audio', 'godam' ),
		image: __( 'Untitled image', 'godam' ),
	}[ capability.mediaType ] || __( 'Untitled video', 'godam' );
	const displayTitle = videoTitle || untitledLabel;

	return (
		<div className="godam-video-editor">
			<EditorTopBar
				title={ displayTitle }
				layerCount={ layers.length }
				attachmentID={ attachmentID }
				isChanged={ isChanged }
				isSaving={ isSavingMeta }
				capability={ capability }
				onBack={ onBackToAttachmentPicker }
				onSave={ handleSaveAttachmentMeta }
				onCopy={ handleCopyGoDAMVideoBlock }
				onEditMetadata={ handleEditMetadata }
				editMetadataLabel={ getEditMetadataLabel() }
				onSaveTitle={ handleSaveTitle }
			/>

			{ capability.showStats && <EditorStatsRow attachmentID={ attachmentID } /> }

			<div className="godam-video-editor__body">
				<EditorTabRail
					currentTab={ currentTab }
					tabs={ capability.tabs }
					onSelect={ handleSelectTab }
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
					{ currentTab === 'transcription' && (
						<Transcription
							attachmentID={ attachmentID }
							duration={ duration }
							fileSize={ formatBytes( attachmentConfig?.media_details?.filesize ) }
						/>
					) }
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
								{ __( 'Changes saved successfully', 'godam' ) }
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

					<div className="godam-video-editor__stage-canvas" ref={ stageCanvasRef }>
						{ attachmentConfig && sources.length > 0 && capability.preview === 'audio' && (
							<AudioCardPreview
								attachmentID={ attachmentID }
								attachmentConfig={ attachmentConfig }
								sources={ sources }
								seekRef={ audioSeekRef }
								onDuration={ setDuration }
							/>
						) }
						{ attachmentConfig && sources.length > 0 && capability.preview === 'image' && (
							<ImagePreview
								attachmentConfig={ attachmentConfig }
								sources={ sources }
							/>
						) }
						{ attachmentConfig && sources.length > 0 && capability.preview === 'videojs' && (
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

					{ capability.showTimeline && attachmentConfig && sources.length > 0 &&
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
