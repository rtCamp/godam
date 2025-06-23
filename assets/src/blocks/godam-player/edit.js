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
} from '@wordpress/components';
import {
	BlockControls,
	InspectorControls,
	MediaUpload,
	MediaUploadCheck,
	MediaReplaceFlow,
	useBlockProps,
	InnerBlocks,
	BlockVerticalAlignmentControl,
} from '@wordpress/block-editor';
import { useRef, useEffect, useState, useMemo } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, _x, sprintf } from '@wordpress/i18n';
import { useInstanceId } from '@wordpress/compose';
import { useDispatch } from '@wordpress/data';
import { external, search, media as icon, layout as layoutIcon } from '@wordpress/icons';
import { store as noticesStore } from '@wordpress/notices';

/**
 * Internal dependencies
 */
import VideoCommonSettings from './edit-common-settings';
import Video from './VideoJS';
import TracksEditor from './track-uploader';
import { Caption } from './caption';
import VideoSEOModal from './components/VideoSEOModal.js';
import { secondsToISO8601 } from './utils';

const ALLOWED_MEDIA_TYPES = [ 'video' ];
const VIDEO_POSTER_ALLOWED_MEDIA_TYPES = [ 'image' ];

// Define allowed blocks for the overlay
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

// Define template for initial blocks
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

function VideoEdit( {
	isSelected: isSingleSelected,
	attributes,
	className,
	setAttributes,
	insertBlocksAfter,
} ) {
	const instanceId = useInstanceId( VideoEdit );
	const videoPlayer = useRef();
	const posterImageButton = useRef();
	const {
		id,
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
	} = attributes;
	const [ temporaryURL, setTemporaryURL ] = useState( attributes.blob );
	const [ defaultPoster, setDefaultPoster ] = useState( '' );
	const [ showOverlay, setShowOverlay ] = useState( false );
	const [ isSEOModalOpen, setIsSEOModelOpen ] = useState( false );
	const [ videoResponse, setVideoResponse ] = useState( {} );
	const [ duration, setDuration ] = useState( 0 );

	const dispatch = useDispatch();

	// Memoize video options to prevent unnecessary rerenders
	const videoOptions = useMemo( () => ( {
		controls,
		autoplay,
		preload,
		fluid: true,
		playsinline: true,
		loop,
		muted,
		poster: poster || defaultPoster,
		sources,
	} ), [ controls, autoplay, preload, loop, muted, poster, defaultPoster, sources ] );

	// Memoize the video component to prevent rerenders
	const videoComponent = useMemo( () => (
		<Disabled isDisabled={ ! isSingleSelected }>
			<Video
				options={ videoOptions }
				onPlayerReady={ ( player ) => {
					if ( player ) {
						const playerEl = player.el_;
						const video = playerEl.querySelector( 'video' );

						video.addEventListener( 'loadedmetadata', () => {
							setAttributes( { aspectRatio: `${ video.videoWidth } / ${ video.videoHeight }` } );
							let _duration = player.duration();
							setDuration( _duration );
							if ( _duration ) {
								_duration = secondsToISO8601( Math.round( _duration ) );
								setAttributes( { seo: { ...attributes.seo, duration: _duration } } );
							}
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
		if ( id ) {
			( async () => {
				try {
					const response = await apiFetch( { path: `/wp/v2/media/${ id }` } );

					setVideoResponse( response );

					if ( response.meta.rtgodam_media_video_thumbnail !== '' ) {
						setDefaultPoster( response.meta.rtgodam_media_video_thumbnail );
					}

					if ( response && response.meta && response.meta.rtgodam_transcoded_url ) {
						const transcodedUrl = response.meta.rtgodam_transcoded_url;

						setAttributes( {
							sources: [
								{
									src: transcodedUrl,
									type: transcodedUrl.endsWith( '.mpd' ) ? 'application/dash+xml' : response.mime_type,
								},
								{
									src: response.source_url,
									type: response.source_url.endsWith( '.mov' ) ? 'video/mp4' : response.mime_type,
								},
							],
						} );
					} else {
						// If meta not present, use media url.
						setAttributes( {
							sources: [
								{
									src: response.source_url,
									type: response.source_url.endsWith( '.mov' ) ? 'video/mp4' : response.mime_type,
								},
							],
						} );
					}
				} catch ( error ) {
					// Show error notice if fetching media fails.
					const message = sprintf(
						/* translators: %s: Label of the video text track e.g: "French subtitles". */
						_x( 'Failed to load video data with id: %d', 'text tracks' ),
						id,
					);
					const { createErrorNotice } = dispatch( noticesStore );
					createErrorNotice( message, { type: 'snackbar' } );
				}
			} )();
		}
	}, [] );

	function onSelectVideo( media ) {
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
			} );
			setTemporaryURL();
			return;
		}

		if ( isBlobURL( media.url ) ) {
			setTemporaryURL( media.url );
			return;
		}

		// Sets the block's attribute and updates the edit component from the
		// selected media.
		setAttributes( {
			blob: undefined,
			src: media.url,
			id: media.id,
			poster: undefined,
			caption: media.caption,
		} );

		if ( media.image?.src !== media.icon ) {
			setDefaultPoster( media.image?.src );
		}

		// Fetch transcoded URL from media meta.
		( async () => {
			try {
				const response = await apiFetch( { path: `/wp/v2/media/${ media.id }` } );

				setVideoResponse( response );

				if ( response && response.meta && response.meta.rtgodam_transcoded_url ) {
					const transcodedUrl = response.meta.rtgodam_transcoded_url;

					if ( response.meta.rtgodam_media_video_thumbnail !== '' ) {
						setDefaultPoster( response.meta.rtgodam_media_video_thumbnail );
					}

					setAttributes( {
						sources: [
							{
								src: transcodedUrl,
								type: transcodedUrl.endsWith( '.mpd' ) ? 'application/dash+xml' : media.mime,
							},
							{
								src: media.url,
								type: media.url.endsWith( '.mov' ) ? 'video/mp4' : media.mime,
							},
						],
					} );
				} else {
					// If meta not present, use media url.
					setAttributes( {
						sources: [
							{
								src: media.url,
								type: media.url.endsWith( '.mov' ) ? 'video/mp4' : media.mime,
							},
						],
					} );
				}
			} catch ( error ) {
				setAttributes( {
					sources: [
						{
							src: media.url,
							type: media.mime,
						},
					],
				} );
			}
		} )();

		setTemporaryURL();
	}

	function onSelectURL( newSrc ) {
		if ( newSrc !== src ) {
			setAttributes( {
				blob: undefined,
				src: newSrc,
				id: undefined,
				poster: undefined,
			} );
			setTemporaryURL();
		}
	}

	const { createErrorNotice } = useDispatch( noticesStore );
	function onUploadError( message ) {
		createErrorNotice( message, { type: 'snackbar' } );
	}

	const classes = clsx( className, {
		'easydam-video-block': true,
		'is-transient': !! temporaryURL,
	} );

	const blockProps = useBlockProps( {
		className: classes,
	} );

	if ( ! src && ! temporaryURL ) {
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
								Select Video
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

	// Add function to handle vertical alignment change
	const onChangeVerticalAlignment = ( alignment ) => {
		setAttributes( { verticalAlignment: alignment } );
	};

	// Add function to get alignment styles
	const getAlignmentStyles = () => {
		const alignmentMap = {
			top: 'flex-start',
			center: 'center',
			bottom: 'flex-end',
		};

		return {
			display: 'flex',
			flexDirection: 'column',
			justifyContent: alignmentMap[ verticalAlignment ] || 'center',
			alignItems: 'stretch',
			height: '100%',
			overflow: 'hidden',
		};
	};

	return (
		<>
			{ isSingleSelected && (
				<>
					<BlockControls group="block">
						<Button
							icon={ layoutIcon }
							label={ __( 'Thumbnail Overlay', 'godam' ) }
							onClick={ () => setShowOverlay( ! showOverlay ) }
							isPressed={ showOverlay }
							className="wp-block-godam-video-overlay-button"
						>
							{ __( 'Overlay', 'godam' ) }
						</Button>
						{ showOverlay && (
							<BlockVerticalAlignmentControl
								label={ __( 'Vertical alignment of overlay blocks', 'godam' ) }
								value={ verticalAlignment }
								onChange={ onChangeVerticalAlignment }
							/>
						) }
					</BlockControls>
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
						<TracksEditor
							tracks={ tracks }
							onChange={ ( newTracks ) => {
								setAttributes( { tracks: newTracks } );
							} }
						/>
					</BlockControls>
				</>
			) }
			<InspectorControls>
				<PanelBody title={ __( 'Settings', 'godam' ) }>
					<VideoCommonSettings
						setAttributes={ setAttributes }
						attributes={ attributes }
					/>
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

					<BaseControl
						id={ `video-block__video-editor-${ instanceId }` }
						label={ __( 'Customise Video', 'godam' ) }
						__nextHasNoMarginBottom
					>
						<Button
							__next40pxDefaultSize
							href={ `${ window?.pluginInfo?.adminUrl }admin.php?page=rtgodam_video_editor&id=${ id }` }
							target="_blank"
							variant="primary"
							className=""
							icon={ external }
							iconPosition="right"
						>
							{ __( 'Customise', 'godam' ) }
						</Button>
					</BaseControl>

					<BaseControl
						id={ `video-block__video-seo-${ instanceId }` }
						label={ __( 'SEO Settings', 'godam' ) }
						__nextHasNoMarginBottom
					>
						<Button
							__next40pxDefaultSize
							onClick={ () => setIsSEOModelOpen( true ) }
							variant="primary"
							className="editor-video-customisation-cta"
							icon={ search }
							iconPosition="right"
						>
							{ __( 'SEO Settings', 'godam' ) }
						</Button>
					</BaseControl>

				</PanelBody>
			</InspectorControls>

			<VideoSEOModal
				isOpen={ isSEOModalOpen }
				setIsOpen={ setIsSEOModelOpen }
				attachmentData={ videoResponse }
				attributes={ attributes }
				setAttributes={ setAttributes }
				duration={ attributes?.seo?.duration || '' }
			/>

			<figure { ...blockProps }>
				<div className="godam-video-wrapper" style={ { position: 'relative' } }>
					{ showOverlay && (
						<div
							className="godam-video-overlay-container"
							style={ {
								position: 'absolute',
								top: 0,
								left: 0,
								right: 0,
								bottom: 0,
								zIndex: 5,
								pointerEvents: isSingleSelected ? 'auto' : 'none',
								...getAlignmentStyles(),
							} }
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
	);
}

export default VideoEdit;
