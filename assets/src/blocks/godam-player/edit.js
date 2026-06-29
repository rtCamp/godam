/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * Internal dependencies
 */
import { CustomizeVideoIcon, CrownIcon } from './icons';

/**
 * WordPress dependencies
 */
import { isBlobURL } from '@wordpress/blob';
import {
	Button,
	Disabled,
	PanelBody,
	Spinner,
	ToggleControl,
	RangeControl,
	SelectControl,
	ToolbarButton,
	ToolbarGroup,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalUnitControl as UnitControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControl as ToggleGroupControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import {
	BlockControls,
	InspectorControls,
	MediaUpload,
	MediaReplaceFlow,
	useBlockProps,
	InnerBlocks,
} from '@wordpress/block-editor';
import { useRef, useEffect, useState, useMemo } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, _x, sprintf } from '@wordpress/i18n';
import { useDispatch } from '@wordpress/data';
import { edit, trendingUp, trash, plus } from '@wordpress/icons';
import { store as noticesStore } from '@wordpress/notices';

/**
 * Internal dependencies
 */
import { PlaybackControls, PerformanceControl, LikesAndComments } from './edit-common-settings';
import Video from './VideoJS';
import { Caption } from './caption';
import VideoSEOModal from './components/VideoSEOModal.js';
import ThumbnailPanel from './components/ThumbnailPanel.js';
import { appendTimezoneOffsetToUTC, isSEODataEmpty, secondsToISO8601, stripHtmlTags } from './utils/index.js';
import './editor.scss';
import { canManageAttachment } from '../../js/media-library/utility';

const ALLOWED_MEDIA_TYPES = [ 'video' ];

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
	const videoPlayer = useRef();

	const {
		id,
		cmmId,
		controls,
		autoplay,
		poster,
		src,
		sources,
		muted,
		loop,
		preload,
		verticalAlignment,
		overlayTimeRange,
		showOverlay,
		aspectRatio,
		videoWidth,
		videoHeight,
		playerHeight,
	} = attributes;
	const [ temporaryURL, setTemporaryURL ] = useState( attributes.blob );
	const [ defaultPoster, setDefaultPoster ] = useState( '' );
	const [ isSEOModalOpen, setIsSEOModelOpen ] = useState( false );
	const [ duration, setDuration ] = useState( 0 );

	const [ isVideoSelecting, setIsVideoSelecting ] = useState( false );
	const [ attachmentAuthorId, setattachmentAuthorId ] = useState( null );
	const [ videoTitle, setVideoTitle ] = useState( '' );
	const isInsideQueryLoop = context?.hasOwnProperty( 'queryId' );

	const dispatch = useDispatch();

	// Calculate aspect ratio in x:y format, matching frontend logic.
	const calculatedAspectRatio = useMemo( () => {
		if ( aspectRatio === 'responsive' && videoWidth && videoHeight ) {
			return `${ videoWidth }:${ videoHeight }`;
		}
		// Return aspectRatio if it's in x:y format, otherwise return '' as default
		if ( aspectRatio && /^\d+:\d+$/.test( aspectRatio ) ) {
			return aspectRatio;
		}

		// Fallback to 16:9 while intrinsic dimensions are still loading, so the
		// player reserves vertical space instead of collapsing to the controls.
		if ( aspectRatio === 'responsive' ) {
			return '16:9';
		}

		return '';
	}, [ aspectRatio, videoWidth, videoHeight ] );

	// When a player height is set, derive a max-width from the height + aspect ratio.
	// This mirrors the video-editor pattern: width = height × (arW / arH).
	// Applying max-width lets Video.js fill that width with fluid: true, which naturally
	// produces the desired height via the aspect-ratio padding trick.
	const computedMaxWidth = useMemo( () => {
		if ( ! playerHeight || ! calculatedAspectRatio ) {
			return null;
		}
		const heightMatch = playerHeight.match( /^(\d+(?:\.\d+)?)([a-z%]*)$/ );
		if ( ! heightMatch ) {
			return null;
		}

		const unit = heightMatch[ 2 ] || 'px';

		// Skip width derivation for percentage units: % resolves against different
		// axes for width vs. height, so the computed max-width would be meaningless.
		if ( '%' === unit ) {
			return null;
		}

		const arMatch = calculatedAspectRatio.match( /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/ );
		if ( ! arMatch ) {
			return null;
		}
		const arH = parseFloat( arMatch[ 2 ] );
		if ( ! arH ) {
			return null;
		}

		const heightValue = parseFloat( heightMatch[ 1 ] );
		const arW = parseFloat( arMatch[ 1 ] );
		return `${ Math.round( heightValue * ( arW / arH ) ) }${ unit }`;
	}, [ playerHeight, calculatedAspectRatio ] );

	// Memoize video options to prevent unnecessary rerenders.
	const videoOptions = useMemo( () => {
		// In the editor, always preload at least metadata so `loadedmetadata`
		// fires and we can capture intrinsic videoWidth/videoHeight/duration.
		// The saved `preload` attribute still drives the frontend.
		const editorPreload = preload === 'none' ? 'metadata' : preload;

		const options = {
			controls,
			autoplay,
			preload: editorPreload,
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
			aspectRatio: calculatedAspectRatio,
			// VHS (HLS/DASH) initial configuration to prefer a ~14 Mbps start.
			// This only affects the initial bandwidth guess; VHS will continue to measure actual throughput and adapt.
			html5: {
				vhs: {
					bandwidth: 14_000_000, // Pretend network can do ~14 Mbps at startup
					bandwidthVariance: 1.0, // allow renditions close to estimate
					limitRenditionByPlayerDimensions: false, // don't cap by video element size
				},
			},
		};

		return options;
	}, [ controls, autoplay, preload, loop, muted, poster, defaultPoster, sources, calculatedAspectRatio ] );

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

					setVideoTitle( stripHtmlTags( response.title?.rendered || '' ) );

					if ( response.meta.rtgodam_media_video_thumbnail !== '' ) {
						setDefaultPoster( response.meta.rtgodam_media_video_thumbnail );
					}

					if ( response ) {
						// Set dimensions if available.
						if ( response.media_details?.width && response.media_details?.height ) {
							setAttributes( {
								videoWidth: `${ response.media_details.width }`,
								videoHeight: `${ response.media_details.height }`,
							} );
						}

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
							description: stripHtmlTags( response.description?.rendered || '' ),
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

	// When autoplay is enabled, hoverSelect is incompatible — reset it to 'none'.
	// Only apply this when autoplay is toggled on after mount so older content
	// is not rewritten as a side effect of opening the editor.
	const previousAutoplayRef = useRef( autoplay );

	useEffect( () => {
		const previousAutoplay = previousAutoplayRef.current;
		if ( previousAutoplay === autoplay ) {
			return;
		}
		previousAutoplayRef.current = autoplay;

		if ( autoplay && attributes.hoverSelect !== 'none' ) {
			setAttributes( { hoverSelect: 'none' } );
		}
	}, [ autoplay ] ); // eslint-disable-line react-hooks/exhaustive-deps

	// Keep overridden SEO thumbnail synced with block poster.
	useEffect( () => {
		if ( ! attributes?.seoOverride || ! poster ) {
			return;
		}

		if ( attributes?.seo?.thumbnailUrl === poster ) {
			return;
		}

		setAttributes( {
			seo: {
				...( attributes?.seo || {} ),
				thumbnailUrl: poster,
			},
		} );
	}, [ attributes?.seoOverride, attributes?.seo, poster, setAttributes ] );

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
			setVideoTitle( '' );
			setTemporaryURL();
			setIsVideoSelecting( false );
			return;
		}

		// Guard against non-video selections. The media library lets users pick
		// any attachment type even when allowedTypes is set, so re-check here.
		const mediaType = media.type || ( media.mime || media.mime_type || '' ).split( '/' )[ 0 ];
		if ( mediaType && mediaType !== 'video' ) {
			createErrorNotice(
				__( 'Only video files are allowed in the GoDAM Video block.', 'godam' ),
				{ type: 'snackbar' },
			);
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
				description: stripHtmlTags( media?.description || '' ),
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
				videoWidth: media.width ? `${ media.width }` : undefined,
				videoHeight: media.height ? `${ media.height }` : undefined,
			} );

			setVideoTitle( stripHtmlTags( media.title || '' ) );
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
						description: stripHtmlTags( response.description?.rendered || '' ),
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
							videoWidth: response.media_details?.width ? `${ response.media_details.width }` : undefined,
							videoHeight: response.media_details?.height ? `${ response.media_details.height }` : undefined,
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
					setVideoTitle( stripHtmlTags( response.title?.rendered || '' ) );
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
		...( computedMaxWidth ? { style: { maxWidth: computedMaxWidth } } : {} ),
	} );

	function onSelectPoster( image ) {
		const nextAttributes = {
			poster: image.url,
		};

		if ( attributes?.seoOverride ) {
			nextAttributes.seo = {
				...( attributes?.seo || {} ),
				thumbnailUrl: image.url,
			};
		}

		setAttributes( nextAttributes );
	}

	function onRemovePoster() {
		const nextAttributes = {
			poster: undefined,
		};

		if ( attributes?.seoOverride && defaultPoster ) {
			nextAttributes.seo = {
				...( attributes?.seo || {} ),
				thumbnailUrl: defaultPoster,
			};
		}

		setAttributes( nextAttributes );
	}

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

	const videoSelectionPanelContent = (
		<>
			<p className="godam-video-selection__description">
				{ __( 'Add subtitles, layers, and more to make your video stand out.', 'godam' ) }
			</p>
			{ ( ! src && ! temporaryURL ) ? (
				<MediaUpload
					onSelect={ onSelectVideo }
					allowedTypes={ ALLOWED_MEDIA_TYPES }
					render={ ( { open } ) => (
						<Button
							onClick={ open }
							icon={ plus }
							className="godam-video-selection__add-btn"
							data-test-id="godam-video-button-add-video"
						>
							{ __( 'Add Video', 'godam' ) }
						</Button>
					) }
				/>
			) : (
				<>
					<Button
						href={ `${ window?.pluginInfo?.adminUrl || '/wp-admin/' }admin.php?page=rtgodam_video_editor&id=${ undefined !== id ? id : cmmId }` }
						target="_blank"
						className="godam-video-selection__customize-btn"
						icon={ CustomizeVideoIcon }
						iconSize={ 14 }
						data-test-id="godam-video-button-customize"
					>
						{ __( 'Customize Video', 'godam' ) }
					</Button>
					<div className="godam-video-selection__item">
						{ ( poster || defaultPoster ) ? (
							<img
								src={ poster || defaultPoster }
								alt=""
								className="godam-video-selection__item-thumbnail"
							/>
						) : (
							<span className="godam-video-selection__item-thumbnail godam-video-selection__item-thumbnail--placeholder" />
						) }
						<span className="godam-video-selection__item-title">
							{ videoTitle || src }
						</span>
						<Button
							icon={ trash }
							iconSize={ 16 }
							label={ __( 'Remove video', 'godam' ) }
							onClick={ () => onSelectVideo( undefined ) }
							className="godam-video-selection__item-delete"
							data-test-id="godam-video-button-remove-video"
						/>
					</div>
				</>
			) }
		</>
	);

	const hoverOptionsPanelContent = (
		<ToggleGroupControl
			__nextHasNoMarginBottom
			isBlock
			isDeselectable
			data-test-id="godam-video-control-hover-select"
			value={ attributes.hoverSelect || 'none' }
			onChange={ ( value ) => setAttributes( { hoverSelect: value ?? 'none' } ) }
			help={ autoplay
				? __( 'Hover option is disabled when autoplay is on.', 'godam' )
				: __( 'Choose the action to perform on video hover.', 'godam' ) }
		>
			<ToggleGroupControlOption value="show-player-controls" label={ __( 'Show player', 'godam' ) } />
			<ToggleGroupControlOption value="start-preview" label={ __( 'Start Preview', 'godam' ) } />
		</ToggleGroupControl>
	);

	const layoutPanelContent = (
		<>
			<ToggleGroupControl
				__nextHasNoMarginBottom
				isBlock
				label={ __( 'Aspect Ratio', 'godam' ) }
				data-test-id="godam-video-control-aspect-ratio"
				value={ attributes.aspectRatio || 'responsive' }
				onChange={ ( value ) => setAttributes( { aspectRatio: value } ) }
				help={ __( 'Choose the aspect ratio for the video player.', 'godam' ) }
			>
				<ToggleGroupControlOption value="responsive" label={ __( 'Original', 'godam' ) } />
				<ToggleGroupControlOption value="16:9" label={ __( '16:9', 'godam' ) } />
			</ToggleGroupControl>
		</>
	);

	const advancedPanelContent = (
		<>
			{ ! isInsideQueryLoop && (
				<>
					<UnitControl
						__nextHasNoMarginBottom
						label={ __( 'Height', 'godam' ) }
						data-test-id="godam-video-control-player-height"
						value={ playerHeight || '' }
						onChange={ ( value ) => setAttributes( { playerHeight: value || '' } ) }
						help={ __( 'Set the video height. Width is auto-calculated from the aspect ratio.', 'godam' ) }
					/>
					<div data-test-id="godam-video-control-show-overlay" style={ { marginBottom: '16px' } }>
						<ToggleControl
							label={ __( 'Show overlay blocks', 'godam' ) }
							checked={ showOverlay }
							onChange={ ( value ) => setAttributes( { showOverlay: value } ) }
							help={ __( 'Display blocks on top of the video player.', 'godam' ) }
						/>
					</div>
					{ showOverlay && (
						<>
							<SelectControl
								label={ __( 'Vertical alignment', 'godam' ) }
								data-test-id="godam-video-control-vertical-alignment"
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
								data-test-id="godam-video-control-overlay-time-range"
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
				</>
			) }
		</>
	);

	return (
		<>
			{ isSingleSelected && (
				<BlockControls>
					{ canManageAttachment( attachmentAuthorId ) && (
						<ToolbarGroup>
							<ToolbarButton
								icon={ edit }
								label={ __( 'Edit Video', 'godam' ) }
								href={ `${ window?.pluginInfo?.adminUrl || '/wp-admin/' }admin.php?page=rtgodam_video_editor&id=${ undefined !== id ? id : cmmId }` }
								target="_blank"
								data-test-id="godam-video-toolbar-edit"
							/>
						</ToolbarGroup>
					) }
					<ToolbarGroup>
						<ToolbarButton
							icon={ trendingUp }
							label={ __( 'Video SEO', 'godam' ) }
							onClick={ () => setIsSEOModelOpen( true ) }
							data-test-id="godam-video-toolbar-seo"
						>
							{ __( 'SEO', 'godam' ) }
						</ToolbarButton>
					</ToolbarGroup>
				</BlockControls>
			) }
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
				{ ! window.pluginInfo?.validApiKey && (
					<div className="godam-upgrade-notice">
						<div className="godam-upgrade-notice__header">
							<span className="godam-upgrade-notice__icon" aria-hidden="true">
								{ CrownIcon }
							</span>
							<strong className="godam-upgrade-notice__title">
								{ __( 'Upgrade to Pro', 'godam' ) }
							</strong>
						</div>
						<p className="godam-upgrade-notice__description">
							{ __( "You don't have an active plan to use this feature. Upgrade now to use unlimited features as part of GoDAM suite.", 'godam' ) }
						</p>
						<Button
							variant="primary"
							href="https://godam.io/pricing/"
							target="_blank"
							rel="noopener noreferrer"
							className="godam-upgrade-notice__button"
							data-test-id="godam-video-button-upgrade"
						>
							{ __( 'Upgrade Now', 'godam' ) }
						</Button>
					</div>
				) }
				{ ! isInsideQueryLoop && (
					<PanelBody title={ __( 'Video Selection', 'godam' ) } data-test-id="godam-video-panel-video-selection">
						{ window.pluginInfo?.validApiKey
							? videoSelectionPanelContent
							: <div className="godam-components-disabled"><Disabled>{ videoSelectionPanelContent }</Disabled></div>
						}
					</PanelBody>
				) }
				{ ! isInsideQueryLoop && (
					<PanelBody title={ __( 'Layout', 'godam' ) } data-test-id="godam-video-panel-layout">
						{ window.pluginInfo?.validApiKey
							? layoutPanelContent
							: <div className="godam-components-disabled"><Disabled>{ layoutPanelContent }</Disabled></div>
						}
					</PanelBody>
				) }
				{ ! isInsideQueryLoop && (
					<PanelBody title={ __( 'Playback Controls', 'godam' ) } data-test-id="godam-video-panel-playback-controls">
						{ window.pluginInfo?.validApiKey
							? <PlaybackControls setAttributes={ setAttributes } attributes={ attributes } />
							: <div className="godam-components-disabled"><Disabled><PlaybackControls setAttributes={ setAttributes } attributes={ attributes } /></Disabled></div>
						}
					</PanelBody>
				) }
				{ ! isInsideQueryLoop && (
					<PanelBody title={ __( 'Performance', 'godam' ) } data-test-id="godam-video-panel-performance">
						{ window.pluginInfo?.validApiKey
							? <PerformanceControl setAttributes={ setAttributes } attributes={ attributes } />
							: <div className="godam-components-disabled"><Disabled><PerformanceControl setAttributes={ setAttributes } attributes={ attributes } /></Disabled></div>
						}
					</PanelBody>
				) }
				{ ! isInsideQueryLoop && (
					<PanelBody title={ __( 'Hover Options', 'godam' ) } data-test-id="godam-video-panel-hover-options">
						{ /* Hover Options are disabled when autoplay is enabled or API key is invalid */ }
						{ ( ! window.pluginInfo?.validApiKey || autoplay )
							? <div className="godam-components-disabled"><Disabled>{ hoverOptionsPanelContent }</Disabled></div>
							: hoverOptionsPanelContent
						}
					</PanelBody>
				) }
				{ ! isInsideQueryLoop && (
					<PanelBody title={ __( 'Thumbnail', 'godam' ) } data-test-id="godam-video-panel-thumbnail">
						{ window.pluginInfo?.validApiKey
							? (
								<ThumbnailPanel
									attachmentId={ id }
									poster={ poster }
									defaultPoster={ defaultPoster }
									onSelect={ onSelectPoster }
									onRemove={ onRemovePoster }
								/>
							)
							: (
								<div className="godam-components-disabled">
									<Disabled>
										<ThumbnailPanel
											attachmentId={ id }
											poster={ poster }
											defaultPoster={ defaultPoster }
											onSelect={ onSelectPoster }
											onRemove={ onRemovePoster }
										/>
									</Disabled>
								</div>
							)
						}
					</PanelBody>
				) }
				<LikesAndComments
					setAttributes={ setAttributes }
					attributes={ attributes }
					isInsideQueryLoop={ isInsideQueryLoop }
				/>

			</InspectorControls>
			<InspectorControls group="advanced">
				<div>
					{ window.pluginInfo?.validApiKey
						? advancedPanelContent
						: <div className="godam-components-disabled"><Disabled>{ advancedPanelContent }</Disabled></div>
					}
				</div>
			</InspectorControls>
			{ ( ! src && ! temporaryURL && ! isInsideQueryLoop ) && (
				<div { ...blockProps }>
					<div className="godam-video-add-placeholder">
						<div className="godam-video-add-placeholder__preview" />
						<h2 className="godam-video-add-placeholder__title">
							{ __( 'Add Video Here', 'godam' ) }
						</h2>
						<p className="godam-video-add-placeholder__description">
							{ __( 'Upload or select a video from your media library to get started.', 'godam' ) }
						</p>
						<MediaUpload
							onSelect={ onSelectVideo }
							allowedTypes={ ALLOWED_MEDIA_TYPES }
							render={ ( { open } ) => (
								<Button
									onClick={ open }
									icon={ plus }
									variant="primary"
									className="godam-video-add-placeholder__btn"
									data-test-id="godam-video-button-select-video"
								>
									{ __( 'Add Video', 'godam' ) }
								</Button>
							) }
						/>
					</div>
				</div>
			) }
			{ isInsideQueryLoop && (
				<div { ...blockProps }>
					<div className="godam-editor-video-placeholder">
						<span className="godam-editor-video-label" data-test-id="godam-video-element-query-label">
							{ __( 'Video', 'godam' ) }
						</span>
					</div>
				</div>
			) }
			{ ( ! isInsideQueryLoop && ( src || temporaryURL ) ) && (
				<>
					<VideoSEOModal
						isOpen={ isSEOModalOpen }
						setIsOpen={ setIsSEOModelOpen }
						attributes={ attributes }
						setAttributes={ setAttributes }
					/>

					<figure { ...blockProps } data-test-id="godam-video-canvas">
						<div className="godam-video-canvas-frame">
							<div className="godam-video-wrapper">
								{ showOverlay && (
									<div
										className={ `godam-video-overlay-container godam-overlay-alignment-${ verticalAlignment }` }
										data-test-id="godam-video-canvas-overlay"
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
			) }
		</>
	);
}

export default VideoEdit;
