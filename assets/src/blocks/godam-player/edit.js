/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { isBlobURL } from '@wordpress/blob';
import {
	BaseControl,
	Button,
	Disabled,
	PanelBody,
	Spinner,
	Placeholder,
	ToggleControl,
	RangeControl,
	SelectControl,
} from '@wordpress/components';
import {
	BlockControls,
	InspectorControls,
	MediaUpload,
	MediaUploadCheck,
	MediaReplaceFlow,
	useBlockProps,
	InnerBlocks,
} from '@wordpress/block-editor';
import { useRef, useEffect, useState, useMemo, useCallback } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, _x, sprintf } from '@wordpress/i18n';
import { useInstanceId } from '@wordpress/compose';
import { useDispatch } from '@wordpress/data';
import { search } from '@wordpress/icons';
import { store as noticesStore } from '@wordpress/notices';

/**
 * Internal dependencies
 */
import VideoCommonSettings from './edit-common-settings';
import Video from './VideoJS';
import TracksEditor from './track-uploader';
import { Caption } from './caption';
import VideoSEOModal from './components/VideoSEOModal.js';
import AITranscription from './components/AITranscription';
import { appendTimezoneOffsetToUTC, isSEODataEmpty, secondsToISO8601 } from './utils/index.js';
import './editor.scss';
import { ReactComponent as icon } from '../../images/godam-video-filled.svg';
import { canManageAttachment } from '../../js/media-library/utility';

const ALLOWED_MEDIA_TYPES = [ 'video' ];
const VIDEO_POSTER_ALLOWED_MEDIA_TYPES = [ 'image' ];

// Define allowed blocks for the overlay.
const ALLOWED_BLOCKS = [
	'core/paragraph',
	'core/heading',
	'core/button',
	'core/image',
	'core/group',
	'core/columns',
	'core/column',
	'core/spacer',
	'core/html',
	'core/shortcode',
];

// Define template for initial blocks.
const TEMPLATE = [
	[ 'core/group', {
		className: 'godam-video-overlay',
		layout: {
			type: 'default',
			inherit: true,
		},
	}, [
		[ 'core/heading', {
			level: 2,
			placeholder: __( 'Add a heading…', 'godam' ),
		} ],
	] ],
];

/**
 * Edit component for the GoDAM Player block.
 *
 * @param {Object}   props                   - The properties passed to the component.
 * @param {boolean}  props.isSelected        - Whether the block is currently selected.
 * @param {Object}   props.attributes        - The block attributes.
 * @param {string}   props.className         - The class name for the component for styling.
 * @param {Function} props.setAttributes     - Function to update the block's attributes.
 * @param {Function} props.insertBlocksAfter - Function to insert blocks after the current block.
 * @param {Object}   props.context           - The block context.
 *
 * @return {JSX.Element} The rendered video block component with optional overlays and controls.
 */
function VideoEdit( {
	isSelected: isSingleSelected,
	attributes,
	className,
	setAttributes,
	insertBlocksAfter,
	context,
} ) {
	const instanceId = useInstanceId( VideoEdit );
	const videoPlayer = useRef();
	const posterImageButton = useRef();

	const {
		id,
		cmmId,
		controls,
		autoplay,
		poster,
		src,
		tracks,
		sources,
		muted,
		loop,
		preload,
		verticalAlignment,
		overlayTimeRange,
		showOverlay,
	} = attributes;
	const [ temporaryURL, setTemporaryURL ] = useState( attributes.blob );
	const [ defaultPoster, setDefaultPoster ] = useState( '' );
	const [ isSEOModalOpen, setIsSEOModelOpen ] = useState( false );
	const [ duration, setDuration ] = useState( 0 );
	const [ isVideoSelecting, setIsVideoSelecting ] = useState( false );
	const [ attachmentAuthorId, setattachmentAuthorId ] = useState( null );
	const isInsideQueryLoop = context?.hasOwnProperty( 'queryId' );

	const dispatch = useDispatch();

	/**
	 * Check if transcription already exists for this video.
	 */
	const checkExistingTranscription = useCallback( async () => {
		try {
			const response = await apiFetch( {
				path: `/godam/v1/ai-transcription/get?attachment_id=${ id }`,
				method: 'GET',
			} );

			if ( response.success && response.transcription_status === 'Transcribed' ) {
				const transcriptPath = response?.transcript_path || '';

				// Build tracks array with AI transcription.
				const existingTracks = Array.isArray( tracks ) ? tracks : [];

				// Check if this transcription path already exists in tracks.
				const transcriptAlreadyExists = existingTracks.some(
					( track ) => track.src === transcriptPath,
				);

				// Only add if not already present.
				if ( ! transcriptAlreadyExists ) {
					const newTrack = {
						src: transcriptPath,
						kind: 'subtitles',
						label: __( 'English', 'godam' ),
						srclang: 'en',
					};

					setAttributes( { tracks: [ ...existingTracks, newTrack ] } );
				}

				return true; // Return true if transcription exists
			}

			return false; // Return false if no transcription
		} catch ( error ) {
			// Transcription doesn't exist yet, which is fine.
			return false; // Return false on error
		}
	}, [ id, setAttributes, tracks ] );

	// Memoize video options to prevent unnecessary rerenders.
	const videoOptions = useMemo( () => ( {
		controls,
		autoplay,
		preload,
		fluid: true,
		playsinline: true,
		flvjs: {
			mediaDataSource: {
				isLive: true,
				cors: false,
				withCredentials: false,
			},
		},
		loop,
		muted,
		poster: poster || defaultPoster,
		sources,
		tracks: tracks || [],
		aspectRatio: '16:9',
		controlBar: {
			playToggle: true,
			volumePanel: true,
			currentTimeDisplay: true,
			timeDivider: true,
			durationDisplay: true,
			fullscreenToggle: true,
			subsCapsButton: true, // Enable captions button
		},
		// VHS (HLS/DASH) initial configuration to prefer a ~14 Mbps start.
		// This only affects the initial bandwidth guess; VHS will continue to measure actual throughput and adapt.
		html5: {
			vhs: {
				bandwidth: 14_000_000, // Pretend network can do ~14 Mbps at startup
				bandwidthVariance: 1.0, // allow renditions close to estimate
				limitRenditionByPlayerDimensions: false, // don't cap by video element size
			},
		},
	} ), [ controls, autoplay, preload, loop, muted, poster, defaultPoster, sources, tracks ] );

	// Memoize the video component to prevent rerenders.
	const videoComponent = useMemo( () => (
		<Disabled isDisabled={ ! isSingleSelected }>
			<Video
				options={ videoOptions }
				onPlayerReady={ ( player ) => {
					if ( player ) {
						const playerEl = player.el_;
						const video = playerEl.querySelector( 'video' );

						video.addEventListener( 'loadedmetadata', () => {
							setAttributes( { videoWidth: `${ video.videoWidth }` } );
							setAttributes( { videoHeight: `${ video.videoHeight }` } );
							const _duration = player.duration();
							setDuration( _duration );
						} );
					}
				} }
			/>
		</Disabled>
	), [ isSingleSelected, videoOptions, setAttributes ] );

	useEffect( () => {
		// Placeholder may be rendered.
		if ( videoPlayer.current ) {
			videoPlayer.current.load();
		}
	}, [ poster ] );

	useEffect( () => {
		/**
		 * Handle virtual attachment created event
		 * Updates the block's id attribute when a virtual attachment is created
		 *
		 * @param {CustomEvent} event - The custom event containing attachment details
		 */
		const handleVirtualAttachmentCreated = ( event ) => {
			const { attachment, virtualMediaId } = event.detail || {};

			// Update id attribute only if it's undefined or matches the virtualMediaId
			if ( attachment && ( id === undefined || id === virtualMediaId ) ) {
				setAttributes( { id: attachment.id } );
			}
		};

		// Attach event listener
		document.addEventListener( 'godam-virtual-attachment-created', handleVirtualAttachmentCreated );

		// Cleanup function to remove event listener
		return () => {
			document.removeEventListener( 'godam-virtual-attachment-created', handleVirtualAttachmentCreated );
		};
	}, [ id, setAttributes ] );

	useEffect( () => {
		if ( id && ! isNaN( Number( id ) ) ) {
			( async () => {
				try {
					const response = await apiFetch( { path: `/wp/v2/media/${ id }` } );

					if ( response.author ) {
						setattachmentAuthorId( response.author );
					}

					if ( response.meta.rtgodam_media_video_thumbnail !== '' ) {
						setDefaultPoster( response.meta.rtgodam_media_video_thumbnail );
					}

					if ( response ) {
						// Build sources list safely, declare newSources first.
						const newSources = [];

						// Prefer HLS if present.
						if ( response?.meta && response?.meta?.rtgodam_hls_transcoded_url ) {
							const hlsTranscodedUrl = response.meta.rtgodam_hls_transcoded_url;

							newSources.push( {
								src: hlsTranscodedUrl,
								type: hlsTranscodedUrl.endsWith( '.m3u8' ) ? 'application/x-mpegURL' : response.mime_type,
							} );
						}

						// Add DASH or other transcoded source if present.
						if ( response?.meta && response?.meta?.rtgodam_transcoded_url ) {
							const transcodedUrl = response.meta.rtgodam_transcoded_url;

							newSources.push( {
								src: transcodedUrl,
								type: transcodedUrl.endsWith( '.mpd' ) ? 'application/dash+xml' : response.mime_type,
							} );
						}

						// Always include original file as fallback.
						newSources.push( {
							src: response.source_url,
							type: response.source_url.endsWith( '.mov' ) ? 'video/mp4' : response.mime_type,
						} );

						setAttributes( { sources: newSources } );
					}
				} catch ( error ) {
					// Show error notice if fetching media fails.
					const message = sprintf(
						/* translators: %d: Label of the video text track e.g: "French subtitles". */
						_x( 'Failed to load video data with id: %d', 'video caption', 'godam' ),
						id,
					);
					const { createErrorNotice } = dispatch( noticesStore );
					createErrorNotice( message, { type: 'snackbar' } );
				}
			} )();
		}
	}, [ id, setAttributes, dispatch ] );

	// Backward compatibility: Initialize SEO data for existing blocks
	useEffect( () => {
		// Don't run during video selection process
		if ( isVideoSelecting ) {
			return;
		}

		// Only run if we have a video source but no SEO data
		if ( ( id || src ) && isSEODataEmpty( attributes.seo ) ) {
			const defaultSEOData = {
				contentUrl: src || '',
				headline: '',
				description: '',
				uploadDate: '',
				duration: '',
				thumbnailUrl: '',
				isFamilyFriendly: true,
			};

			// If we have an attachment ID, try to fetch more data
			if ( id && ! isNaN( Number( id ) ) ) {
				( async () => {
					try {
						const response = await apiFetch( { path: `/wp/v2/media/${ id }` } );

						const enhancedSEOData = {
							contentUrl: response.meta?.rtgodam_transcoded_url || response.source_url || src || '',
							headline: response.title?.rendered || '',
							description: response.description?.rendered || '',
							uploadDate: appendTimezoneOffsetToUTC( response.date_gmt || '' ),
							duration: response.video_duration_iso8601 || '',
							thumbnailUrl: response.meta?.rtgodam_media_video_thumbnail || '',
							isFamilyFriendly: true,
						};

						setAttributes( {
							seo: enhancedSEOData,
						} );
					} catch ( error ) {
						// Fallback to basic SEO data if API call fails
						setAttributes( {
							seo: defaultSEOData,
						} );
					}
				} )();
			} else {
				// For custom URLs or when ID is not available
				setAttributes( {
					seo: defaultSEOData,
				} );
			}
		}
	}, [ id, src, attributes.seo, isVideoSelecting, setAttributes ] );

	// Check if transcription already exists on mount.
	useEffect( () => {
		if ( ! id || isInsideQueryLoop ) {
			return;
		}

		checkExistingTranscription();
	}, [ id, isInsideQueryLoop, checkExistingTranscription ] );

	function onSelectVideo( media ) {
		// Set flag to prevent backward compatibility logic during video selection
		setIsVideoSelecting( true );

		if ( ! media || ! media.url ) {
			// In this case there was an error
			// previous attributes should be removed
			// because they may be temporary blob urls.
			setAttributes( {
				src: undefined,
				id: undefined,
				poster: undefined,
				caption: undefined,
				blob: undefined,
				seo: undefined, // Clear SEO data when no media selected
			} );
			setTemporaryURL();
			setIsVideoSelecting( false );
			return;
		}

		if ( isBlobURL( media.url ) ) {
			setTemporaryURL( media.url );
			setIsVideoSelecting( false );
			return;
		}

		if ( media.image?.src !== media.icon ) {
			setDefaultPoster( media.image?.src );
		}

		if ( media?.origin === 'godam' ) {
			// Create new SEO data from GoDAM media
			const newSEOData = {
				contentUrl: media?.url,
				headline: media?.title || '',
				description: media?.description || '',
				uploadDate: appendTimezoneOffsetToUTC( media?.date || '' ),
				duration: secondsToISO8601( media?.duration || '' ),
				thumbnailUrl: media?.thumbnail_url || '',
				isFamilyFriendly: true, // Default value
			};

			const mediaSources = [];

			if ( media.hls_url ) {
				mediaSources.push( {
					src: media.hls_url,
					type: media.hls_url.endsWith( '.m3u8' ) ? 'application/x-mpegURL' : media.mime,
				} );
			}

			if ( media.url ) {
				mediaSources.push( {
					src: media.url,
					type: media.url.endsWith( '.mov' ) ? 'video/mp4' : media.mime,
				} );
			}

			// Set all attributes updates into single setAttributes call
			setAttributes( {
				blob: undefined,
				src: media.url,
				id: media.id,
				cmmId: media.id,
				poster: undefined,
				caption: media.caption,
				seo: newSEOData,
				sources: mediaSources,
			} );

			setTemporaryURL();
			setIsVideoSelecting( false );
		} else {
			// Handle WordPress media - batch initial attributes and fetch additional data
			const baseAttributes = {
				blob: undefined,
				src: media.url,
				id: media.id,
				cmmId: media.id,
				poster: undefined,
				caption: media.caption,
				seo: undefined, // Will be set after API call
			};

			// Fetch transcoded URL from media meta.
			( async () => {
				try {
					const response = await apiFetch( { path: `/wp/v2/media/${ media.id }` } );

					// Create new SEO data from WordPress media
					const newSEOData = {
						contentUrl: response.meta?.rtgodam_transcoded_url || response.source_url,
						headline: response.title?.rendered || '',
						description: response.description?.rendered || '',
						uploadDate: appendTimezoneOffsetToUTC( response.date_gmt ),
						duration: response.video_duration_iso8601 || '',
						thumbnailUrl: response.meta?.rtgodam_media_video_thumbnail || '',
						isFamilyFriendly: true, // Default value
					};

					if ( response && response.meta ) {
						if ( response.meta.rtgodam_media_video_thumbnail !== '' ) {
							setDefaultPoster( response.meta.rtgodam_media_video_thumbnail );
						}

						const mediaSources = [];

						const hlsTranscodedUrl = response.meta.rtgodam_hls_transcoded_url;
						if ( hlsTranscodedUrl ) {
							mediaSources.push( {
								src: hlsTranscodedUrl,
								type: hlsTranscodedUrl.endsWith( '.m3u8' ) ? 'application/x-mpegURL' : media.mime,
							} );
						}

						const transcodedUrl = response.meta.rtgodam_transcoded_url;
						if ( transcodedUrl ) {
							mediaSources.push( {
								src: transcodedUrl,
								type: transcodedUrl.endsWith( '.mpd' ) ? 'application/dash+xml' : media.mime,
							} );
						}

						mediaSources.push( {
							src: media.url,
							type: media.url.endsWith( '.mov' ) ? 'video/mp4' : media.mime,
						} );

						// Batch all final attributes into single setAttributes call
						setAttributes( {
							...baseAttributes,
							seo: newSEOData,
							sources: mediaSources,
						} );
					} else {
						// If meta not present, use media url.
						setAttributes( {
							...baseAttributes,
							seo: newSEOData,
							sources: [
								{
									src: media.url,
									type: media.url.endsWith( '.mov' ) ? 'video/mp4' : media.mime,
								},
							],
						} );
					}
				} catch ( error ) {
					// Create basic SEO data on error
					const fallbackSEOData = {
						contentUrl: media.url,
						headline: '',
						description: '',
						uploadDate: '',
						duration: '',
						thumbnailUrl: '',
						isFamilyFriendly: true,
					};

					setAttributes( {
						...baseAttributes,
						seo: fallbackSEOData,
						sources: [
							{
								src: media.url,
								type: media.mime,
							},
						],
					} );
				}

				setTemporaryURL();
				setIsVideoSelecting( false );
			} )();
		}
	}

	function onSelectURL( newSrc ) {
		if ( newSrc !== src ) {
			// Set flag to prevent backward compatibility logic during URL selection
			setIsVideoSelecting( true );

			setAttributes( {
				blob: undefined,
				src: newSrc,
				id: undefined,
				poster: undefined,
				seo: undefined, // Clear SEO data when new URL is selected
			} );
			setTemporaryURL();

			// Reset flag after a brief delay to allow attribute changes to settle
			setTimeout( () => {
				setIsVideoSelecting( false );
			}, 100 );
		}
	}

	const { createErrorNotice } = useDispatch( noticesStore );
	function onUploadError( message ) {
		createErrorNotice( message, { type: 'snackbar' } );
	}

	const classes = clsx( className, {
		'easydam-video-block': true,
		'is-transient': !! temporaryURL,
		'godam-editor-video-item': isInsideQueryLoop,
	} );

	const blockProps = useBlockProps( {
		className: classes,
	} );

	if ( ! src && ! temporaryURL && ! isInsideQueryLoop ) {
		return (
			<div { ...blockProps }>
				<Placeholder
					className="block-editor-media-placeholder"
					withIllustration={ ! isSingleSelected }
					icon={ icon }
					label={ __( 'GoDAM video', 'godam' ) }
					instructions={ __(
						'Drag and drop a video, upload, or choose from your library.',
						'godam',
					) }
				>
					<MediaUpload
						onSelect={ onSelectVideo }
						allowedTypes={ ALLOWED_MEDIA_TYPES }
						render={ ( { open } ) => (
							<Button onClick={ open } variant="primary">
								{ __( 'Select Video', 'godam' ) }
							</Button>
						) }
					/>
				</Placeholder>
			</div>
		);
	}

	function onSelectPoster( image ) {
		setAttributes( { poster: image.url } );
	}

	function onRemovePoster() {
		setAttributes( { poster: undefined } );

		// Move focus back to the Media Upload button.
		posterImageButton.current.focus();
	}

	const videoPosterDescription = `video-block__poster-image-description-${ instanceId }`;

	// Add function to handle vertical alignment change.
	const onChangeVerticalAlignment = ( alignment ) => {
		setAttributes( { verticalAlignment: alignment } );
	};

	// Format time for display.
	const formatTime = ( seconds ) => {
		const hours = Math.floor( seconds / 3600 );
		const minutes = Math.floor( ( seconds % 3600 ) / 60 );
		const remainingSeconds = Math.floor( seconds % 60 );

		let timeString = '';

		if ( hours > 0 ) {
			timeString += `${ hours } hour${ hours !== 1 ? 's' : '' }`;
		}

		if ( minutes > 0 ) {
			if ( timeString ) {
				timeString += ', ';
			}
			timeString += `${ minutes } minute${ minutes !== 1 ? 's' : '' }`;
		}

		if ( remainingSeconds > 0 || timeString === '' ) {
			if ( timeString ) {
				timeString += ', ';
			}
			timeString += `${ remainingSeconds } second${ remainingSeconds !== 1 ? 's' : '' }`;
		}

		return timeString;
	};

	return (
		<>
			{ ( isSingleSelected && ! isInsideQueryLoop ) && (
				<BlockControls group="other">
					<MediaReplaceFlow
						mediaId={ id }
						mediaURL={ src }
						allowedTypes={ ALLOWED_MEDIA_TYPES }
						accept="video/*"
						onSelect={ onSelectVideo }
						onSelectURL={ onSelectURL }
						onError={ onUploadError }
						onReset={ () => onSelectVideo( undefined ) }
					/>
				</BlockControls>
			) }
			<InspectorControls>
				<PanelBody title={ __( 'Settings', 'godam' ) }>
					<VideoCommonSettings
						setAttributes={ setAttributes }
						attributes={ attributes }
						isInsideQueryLoop={ isInsideQueryLoop }
					/>
					{
						! isInsideQueryLoop && (
							<>
								<BaseControl
									id={ `video-block__hover-${ instanceId }` }
									__nextHasNoMarginBottom
								>
									<SelectControl
										__nextHasNoMarginBottom
										label={ __( 'Hover Option', 'godam' ) }
										help={ __( 'Choose the action to perform on video hover.', 'godam' ) }
										value={ attributes.hoverSelect || 'none' }
										onChange={ ( value ) => setAttributes( { hoverSelect: value } ) }
										options={
											[
												{ label: __( 'None', 'godam' ), value: 'none' },
												{ label: __( 'Show Player Controls', 'godam' ), value: 'show-player-controls' },
												{ label: __( 'Start Preview', 'godam' ), value: 'start-preview' },
												{ label: __( 'Shadow Overlay', 'godam' ), value: 'shadow-overlay' },
											]
										}
									/>
								</BaseControl>

								<BaseControl
									id={ `video-block__poster-image-${ instanceId }` }
									label={ __( 'Video Thumbnail', 'godam' ) }
									__nextHasNoMarginBottom
								>
									<MediaUploadCheck>
										<div className="editor-video-poster-control">
											<MediaUpload
												title={ __( 'Select Video Thumbnail', 'godam' ) }
												onSelect={ onSelectPoster }
												allowedTypes={ VIDEO_POSTER_ALLOWED_MEDIA_TYPES }
												render={ ( { open } ) => (
													<Button
														__next40pxDefaultSize
														variant="primary"
														onClick={ open }
														ref={ posterImageButton }
														aria-describedby={ videoPosterDescription }
													>
														{ ! poster ? __( 'Select', 'godam' ) : __( 'Replace', 'godam' ) }
													</Button>
												) }
											/>
											<p id={ videoPosterDescription } hidden>
												{ poster
													? sprintf(
														/* translators: %s: poster image URL. */
														__( 'The current poster image url is %s', 'godam' ),
														poster,
													)
													: __( 'There is no poster image currently selected', 'godam' ) }
											</p>
											{ !! poster && (
												<Button
													__next40pxDefaultSize
													onClick={ onRemovePoster }
													variant="tertiary"
												>
													{ __( 'Remove', 'godam' ) }
												</Button>
											) }
										</div>
									</MediaUploadCheck>
								</BaseControl>

								<ToggleControl
									__nextHasNoMarginBottom
									label={ __( 'Preload Video Thumbnail', 'godam' ) }
									help={ __( 'Enable to show the video thumbnail faster when the page loads. Recommended for videos placed near the top of your page.', 'godam' ) }
									onChange={ ( value ) => setAttributes( { preloadPoster: value } ) }
									checked={ attributes?.preloadPoster }
								/>

								{ canManageAttachment( attachmentAuthorId ) && (
									<BaseControl
										id={ `video-block__video-editor-${ instanceId }` }
										label={ __( 'Customise Video', 'godam' ) }
										__nextHasNoMarginBottom
									>
										<Button
											__next40pxDefaultSize
											href={ `${ window?.pluginInfo?.adminUrl }admin.php?page=rtgodam_video_editor&id=${ undefined !== id ? id : cmmId }` }
											target="_blank"
											variant="primary"
										>
											{ __( 'Customise', 'godam' ) }
										</Button>
									</BaseControl>
								) }

								<AITranscription
									attachmentId={ id }
									instanceId={ instanceId }
									hasTranscription={ tracks && tracks.length > 0 }
									onTranscriptionComplete={ checkExistingTranscription }
								/>

								<BaseControl
									id={ `video-block__video-seo-${ instanceId }` }
									label={ __( 'SEO Settings', 'godam' ) }
									help={ __( 'Configure SEO metadata for this video. Note: SEO data will be cleared when replacing the video.', 'godam' ) }
									__nextHasNoMarginBottom
								>
									<Button
										__next40pxDefaultSize
										onClick={ () => setIsSEOModelOpen( true ) }
										variant="primary"
										icon={ search }
										iconPosition="right"
									>
										{ __( 'SEO Settings', 'godam' ) }
									</Button>
								</BaseControl>

								<BaseControl
									id={ `video-block__video--selected-aspect-ratio-${ instanceId }` }
									label={ __( 'Aspect Ratio', 'godam' ) }
									__nextHasNoMarginBottom
								>
									<SelectControl
										value={ attributes.aspectRatio || '16:9' }
										options={ [
											{ label: __( '16:9 (Standard)', 'godam' ), value: '16:9' },
											{ label: __( 'Responsive', 'godam' ), value: 'responsive' },
										] }
										onChange={ ( value ) => setAttributes( { aspectRatio: value } ) }
										help={ __( 'Choose the aspect ratio for the video player.', 'godam' ) }
									/>
								</BaseControl>

								<BaseControl
									id={ `video-block__tracks-editor-${ instanceId }` }
									label={ __( 'Subtitles & Captions', 'godam' ) }
									__nextHasNoMarginBottom
								>
									<TracksEditor
										tracks={ tracks }
										onChange={ ( newTracks ) => {
											setAttributes( { tracks: newTracks } );
										} }
									/>
								</BaseControl>
							</>
						)
					}
				</PanelBody>

				{ /* Only show additional settings when not inside a Query Loop */ }
				{ ! isInsideQueryLoop && (
					<PanelBody title={ __( 'Overlay Blocks', 'godam' ) }>
						<ToggleControl
							label={ __( 'Show overlay blocks', 'godam' ) }
							checked={ showOverlay }
							onChange={ ( value ) => setAttributes( { showOverlay: value } ) }
							help={ __( 'Display blocks on top of the video player.', 'godam' ) }
						/>

						{ showOverlay && (
							<>
								<SelectControl
									label={ __( 'Vertical alignment', 'godam' ) }
									value={ verticalAlignment }
									options={ [
										{ label: __( 'Top', 'godam' ), value: 'top' },
										{ label: __( 'Center', 'godam' ), value: 'center' },
										{ label: __( 'Bottom', 'godam' ), value: 'bottom' },
									] }
									onChange={ onChangeVerticalAlignment }
									help={ __( 'Choose where to position the overlay blocks vertically.', 'godam' ) }
								/>

								<RangeControl
									label={ __( 'Time range', 'godam' ) }
									value={ overlayTimeRange }
									onChange={ ( value ) => setAttributes( { overlayTimeRange: value } ) }
									min={ 0 }
									max={ duration || 100 }
									step={ 0.1 }
									help={ sprintf(
										/* translators: %s: formatted time */
										__( 'Overlay will be visible for %s from the start of the video.', 'godam' ),
										formatTime( overlayTimeRange || 0 ),
									) }
								/>

								{ duration > 0 && (
									<p style={ { fontSize: '12px', color: '#757575', marginTop: '8px' } }>
										{ sprintf(
											/* translators: %s: formatted time */
											__( 'Video duration: %s', 'godam' ),
											formatTime( duration ),
										) }
									</p>
								) }
							</>
						) }
					</PanelBody>
				) }
			</InspectorControls>
			{
				isInsideQueryLoop ? (
					<div { ...blockProps }>
						<div className="godam-editor-video-placeholder">
							<span className="godam-editor-video-label">
								{ __( 'GoDAM Video', 'godam' ) }
							</span>
						</div>
					</div>
				) : (
					<>
						<VideoSEOModal
							isOpen={ isSEOModalOpen }
							setIsOpen={ setIsSEOModelOpen }
							attributes={ attributes }
							setAttributes={ setAttributes }
						/>

						<figure { ...blockProps }>
							<div className="godam-video-wrapper">
								{ showOverlay && (
									<div
										className={ `godam-video-overlay-container godam-overlay-alignment-${ verticalAlignment }` }
									>
										<InnerBlocks
											allowedBlocks={ ALLOWED_BLOCKS }
											template={ TEMPLATE }
											templateLock={ false }
											renderAppender={ isSingleSelected ? InnerBlocks.ButtonBlockAppender : false }
											__experimentalLayout={ {
												type: 'default',
												inherit: true,
											} }
										/>
									</div>
								) }
								{ videoComponent }
								{ !! temporaryURL && <Spinner /> }
							</div>
							<Caption
								attributes={ attributes }
								setAttributes={ setAttributes }
								isSelected={ isSingleSelected }
								insertBlocksAfter={ insertBlocksAfter }
								label={ __( 'Video caption text', 'godam' ) }
								showToolbarButton={ isSingleSelected }
							/>
						</figure>
					</>
				)
			}
		</>
	);
}

export default VideoEdit;
