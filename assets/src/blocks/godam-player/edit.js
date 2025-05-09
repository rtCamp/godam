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
} from '@wordpress/block-editor';
import { useRef, useEffect, useState, useMemo } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { useInstanceId } from '@wordpress/compose';
import { useDispatch } from '@wordpress/data';
import { external, media as icon } from '@wordpress/icons';
import { store as noticesStore } from '@wordpress/notices';

/**
 * Internal dependencies
 */
import VideoCommonSettings from './edit-common-settings';
import Video from './VideoJS';
import TracksEditor from './track-uploader';
import { Caption } from './caption';

const ALLOWED_MEDIA_TYPES = [ 'video' ];
const VIDEO_POSTER_ALLOWED_MEDIA_TYPES = [ 'image' ];

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
	const { id, controls, autoplay, poster, src, tracks, sources, muted, loop, preload } = attributes;
	const [ temporaryURL, setTemporaryURL ] = useState( attributes.blob );
	const [ defaultPoster, setDefaultPoster ] = useState( '' );

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
					console.error( 'Error fetching media meta:', error );
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
				console.error( 'Error fetching media meta:', error );
				// On error, use media url.
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

	console.log( 'caption from parent', attributes.caption );

	if ( ! src && ! temporaryURL ) {
		return (
			<div { ...blockProps }>
				<Placeholder
					className="block-editor-media-placeholder"
					withIllustration={ ! isSingleSelected }
					icon={ icon }
					label={ __( 'GoDAM video' ) }
					instructions={ __(
						'Drag and drop a video, upload, or choose from your library.',
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

	return (
		<>
			{ isSingleSelected && (
				<>
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
					<MediaUploadCheck>
						<div className="editor-video-poster-control">
							<BaseControl.VisualLabel>
								{ __( 'Poster image' ) }
							</BaseControl.VisualLabel>
							<MediaUpload
								title={ __( 'Select poster image', 'godam' ) }
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
										__( 'The current poster image url is %s' ),
										poster,
									)
									: __( 'There is no poster image currently selected' ) }
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
					<div className="editor-video-customisation-cta">
						<BaseControl.VisualLabel>
							{ __( 'Customise Video', 'godam' ) }
						</BaseControl.VisualLabel>
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
					</div>
				</PanelBody>
			</InspectorControls>

			<figure { ...blockProps }>
				{ videoComponent }
				{ !! temporaryURL && <Spinner /> }
				<Caption
					attributes={ attributes }
					setAttributes={ setAttributes }
					isSelected={ isSingleSelected }
					insertBlocksAfter={ insertBlocksAfter }
					label={ __( 'Video caption text' ) }
					showToolbarButton={ isSingleSelected }
				/>
			</figure>
		</>
	);
}

export default VideoEdit;
