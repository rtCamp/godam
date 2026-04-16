/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-nested-ternary */
/* eslint-disable react-hooks/exhaustive-deps */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls, MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import {
	PanelBody,
	SelectControl,
	ToggleControl,
	RangeControl,
	Button,
	Notice,
} from '@wordpress/components';
import { useEffect } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { video as videoIcon } from '@wordpress/icons';

// Edit component for GoDAM Reel Pops block.
export default function Edit( { attributes, setAttributes, clientId } ) {
	const {
		blockId,
		videos,
		aspectRatio,
		position,
		animation,
		animationDuration,
		durationSeconds,
		initialDelay,
		closePersistence,
		enableAutoplay,
		showMuteButton,
		showPlayButton,
		enableModalNavigation,
		popupWidth,
		mobilePopupWidth,
		bottomSpacing,
		sideSpacing,
	} = attributes;

	// Initialize blockId once
	useEffect( () => {
		if ( ! blockId ) {
			setAttributes( { blockId: `godam-reel-pops-${ clientId }` } );
		}
	}, [] );

	// Handle GoDAM virtual attachment creation
	useEffect( () => {
		/**
		 * Listen for GoDAM virtual attachment creation.
		 *
		 * When a user selects videos from the GoDAM tab, the real WordPress
		 * attachments are created asynchronously. This handler adds the newly
		 * created attachments to the block's video list.
		 *
		 * Scoped to this specific block instance using clientId to prevent
		 * cross-block interference when multiple Reel Pops blocks exist.
		 *
		 * @param {CustomEvent} event - The custom event containing attachment details.
		 */
		const handleVirtualAttachmentCreated = ( event ) => {
			// Only process events intended for this specific block instance
			if ( window._godamActiveReelPopsBlockId !== clientId ) {
				return;
			}

			const { attachment } = event.detail || {};

			// Validate attachment data
			if ( ! attachment || ! attachment.id ) {
				return;
			}

			// Only process video attachments
			if ( ! attachment.mime || ! attachment.mime.startsWith( 'video/' ) ) {
				return;
			}

			// Skip if already exists
			if ( videos.includes( attachment.id ) ) {
				return;
			}

			// Add the new video to the list
			setAttributes( {
				videos: [ ...videos, attachment.id ],
			} );
		};

		// Attach event listener
		document.addEventListener( 'godam-virtual-attachment-created', handleVirtualAttachmentCreated );

		// Cleanup function to remove event listener
		return () => {
			document.removeEventListener( 'godam-virtual-attachment-created', handleVirtualAttachmentCreated );
		};
	}, [ videos, setAttributes, clientId ] );

	const mediaById = useSelect(
		( select ) => {
			const core = select( 'core' );
			const result = {};
			videos.forEach( ( videoId ) => {
				if ( videoId > 0 ) {
					result[ videoId ] = core.getMedia( videoId );
				}
			} );
			return result;
		},
		[ videos ],
	);

	const siteBaseUrl = window?.wpApiSettings?.root
		? window.wpApiSettings.root.replace( /wp-json\/?$/, '/' )
		: `${ window?.location?.origin || '' }/`;

	const defaultThumbnail = window?.RTGodamVideoGallery?.defaultThumbnail || `${ siteBaseUrl }wp-content/plugins/godam/assets/src/images/video-thumbnail-default.png`;

	const getVideoThumbnail = ( media ) => {
		return (
			media?.meta?.rtgodam_media_video_thumbnail ||
			media?.media_details?.sizes?.thumbnail?.source_url ||
			media?.media_details?.sizes?.medium?.source_url ||
			media?.image?.src ||
			media?.icon ||
			defaultThumbnail
		);
	};

	/**
	 * Append selected videos from media library.
	 *
	 * Filters out virtual GoDAM media (non-numeric IDs) to prevent duplicates.
	 * Virtual media is handled by the godam-virtual-attachment-created event listener.
	 *
	 * @param {Object|Object[]} media Selected media or list.
	 */
	const appendSelectedVideos = ( media ) => {
		const selectedMedia = Array.isArray( media ) ? media : [ media ];
		const existingIds = new Set( videos );
		const appendedVideos = selectedMedia
			.filter( ( item ) => {
				// Skip if no ID or already exists
				if ( ! item || ! item.id || existingIds.has( item.id ) ) {
					return false;
				}

				// Skip virtual GoDAM media (non-numeric IDs).
				// These will be handled by the godam-virtual-attachment-created event.
				if ( typeof item.id === 'string' && ! /^\d+$/.test( item.id ) ) {
					return false;
				}

				return true;
			} )
			.map( ( item ) => item.id );

		if ( appendedVideos.length === 0 ) {
			return;
		}

		setAttributes( {
			videos: [ ...videos, ...appendedVideos ],
		} );
	};

	/**
	 * Remove a video item.
	 *
	 * @param {number} index Index of video to remove.
	 */
	const removeVideo = ( index ) => {
		const updatedVideos = [ ...videos ];
		updatedVideos.splice( index, 1 );
		setAttributes( { videos: updatedVideos } );
	};

	/**
	 * Move video up in the list.
	 *
	 * @param {number} index Index of video to move.
	 */
	const moveVideoUp = ( index ) => {
		if ( index === 0 ) {
			return;
		}
		const updatedVideos = [ ...videos ];
		const temp = updatedVideos[ index - 1 ];
		updatedVideos[ index - 1 ] = updatedVideos[ index ];
		updatedVideos[ index ] = temp;
		setAttributes( { videos: updatedVideos } );
	};

	/**
	 * Move video down in the list.
	 *
	 * @param {number} index Index of video to move.
	 */
	const moveVideoDown = ( index ) => {
		if ( index === videos.length - 1 ) {
			return;
		}
		const updatedVideos = [ ...videos ];
		const temp = updatedVideos[ index + 1 ];
		updatedVideos[ index + 1 ] = updatedVideos[ index ];
		updatedVideos[ index ] = temp;
		setAttributes( { videos: updatedVideos } );
	};

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Video Selection', 'godam' ) } initialOpen={ true }>
					{ videos.length === 0 && (
						<Notice status="warning" isDismissible={ false }>
							{ __( 'No videos selected. Add at least one video to display the reel popup.', 'godam' ) }
						</Notice>
					) }

					<MediaUploadCheck>
						<MediaUpload
							onSelect={ appendSelectedVideos }
							allowedTypes={ [ 'video' ] }
							multiple
							render={ ( { open } ) => {
								const handleOpen = () => {
								// Set the active block ID before opening media modal
									window._godamActiveReelPopsBlockId = clientId;
									open();
								};
								return (
									<Button onClick={ handleOpen } variant="primary" icon={ videoIcon } className="godam-reel-pops-select-videos-button">
										{ __( 'Select Videos', 'godam' ) }
									</Button>
								);
							} }
						/>
					</MediaUploadCheck>

					<div className="godam-reel-pops-video-grid">
						{ videos.map( ( videoId, index ) => {
							const thumbnailUrl = getVideoThumbnail( mediaById[ videoId ] );
							return (
								<div key={ index } className="godam-reel-pops-video-card">
									<div className="godam-reel-pops-video-card-row">
										<div className="godam-reel-pops-video-meta-wrap">
											<div className="godam-reel-pops-video-thumb-wrap">
												{ thumbnailUrl ? (
													<img
														src={ thumbnailUrl }
														alt=""
														className="godam-reel-pops-video-thumb"
													/>
												) : (
													<span className="godam-reel-pops-video-thumb-fallback">{ __( 'Video', 'godam' ) }</span>
												) }
											</div>
											<div className="godam-reel-pops-video-info-wrap">
												<strong className="godam-reel-pops-video-title" title={ mediaById[ videoId ]?.title?.rendered || __( 'Untitled video', 'godam' ) }>{ mediaById[ videoId ]?.title?.rendered || __( 'Untitled video', 'godam' ) }</strong>
												<div className="godam-reel-pops-video-id">{ __( 'ID:', 'godam' ) } { videoId }</div>
											</div>
										</div>
										<div className="godam-reel-pops-video-actions">
											{ index > 0 && (
												<Button
													size="small"
													onClick={ () => moveVideoUp( index ) }
													icon="arrow-up-alt2"
													label={ __( 'Move up', 'godam' ) }
												/>
											) }
											{ index < videos.length - 1 && (
												<Button
													size="small"
													onClick={ () => moveVideoDown( index ) }
													icon="arrow-down-alt2"
													label={ __( 'Move down', 'godam' ) }
												/>
											) }
											<Button
												size="small"
												isDestructive
												onClick={ () => removeVideo( index ) }
												icon="trash"
												label={ __( 'Remove', 'godam' ) }
											/>
										</div>
									</div>
								</div>
							);
						} ) }
					</div>
				</PanelBody>

				<PanelBody title={ __( 'Popup Settings', 'godam' ) } initialOpen={ false }>
					<SelectControl
						label={ __( 'Aspect Ratio', 'godam' ) }
						value={ aspectRatio }
						options={ [
							{ label: __( '9:16 (Reels/Stories)', 'godam' ), value: '9-16' },
							{ label: __( '16:9 (Landscape)', 'godam' ), value: '16-9' },
							{ label: __( '4:3 (Standard)', 'godam' ), value: '4-3' },
						] }
						onChange={ ( value ) => setAttributes( { aspectRatio: value } ) }
					/>

					<SelectControl
						label={ __( 'Position', 'godam' ) }
						value={ position }
						options={ [
							{ label: __( 'Bottom Right', 'godam' ), value: 'bottom-right' },
							{ label: __( 'Bottom Left', 'godam' ), value: 'bottom-left' },
						] }
						onChange={ ( value ) => setAttributes( { position: value } ) }
					/>

					<RangeControl
						label={ __( 'Popup Width (px)', 'godam' ) }
						value={ popupWidth }
						onChange={ ( value ) => setAttributes( { popupWidth: value } ) }
						min={ 80 }
						max={ 300 }
						step={ 10 }
					/>

					<RangeControl
						label={ __( 'Mobile Popup Width (px)', 'godam' ) }
						value={ mobilePopupWidth }
						onChange={ ( value ) => setAttributes( { mobilePopupWidth: value } ) }
						min={ 80 }
						max={ 300 }
						step={ 10 }
					/>

					<RangeControl
						label={ __( 'Bottom Spacing (px)', 'godam' ) }
						value={ bottomSpacing }
						onChange={ ( value ) => setAttributes( { bottomSpacing: value } ) }
						min={ 0 }
						max={ 100 }
						step={ 5 }
					/>

					<RangeControl
						label={ __( 'Side Spacing (px)', 'godam' ) }
						value={ sideSpacing }
						onChange={ ( value ) => setAttributes( { sideSpacing: value } ) }
						min={ 0 }
						max={ 100 }
						step={ 5 }
					/>
				</PanelBody>

				<PanelBody title={ __( 'Animation Settings', 'godam' ) } initialOpen={ false }>
					<SelectControl
						label={ __( 'Animation Type', 'godam' ) }
						value={ animation }
						options={ [
							{ label: __( 'Slide Up', 'godam' ), value: 'slide-up' },
							{ label: __( 'Slide Left', 'godam' ), value: 'slide-left' },
							{ label: __( 'Slide Right', 'godam' ), value: 'slide-right' },
							{ label: __( 'Fade', 'godam' ), value: 'fade' },
							{ label: __( 'Bounce', 'godam' ), value: 'bounce' },
							{ label: __( 'Scale', 'godam' ), value: 'scale' },
						] }
						onChange={ ( value ) => setAttributes( { animation: value } ) }
					/>

					<RangeControl
						label={ __( 'Animation Duration (ms)', 'godam' ) }
						value={ animationDuration }
						onChange={ ( value ) => setAttributes( { animationDuration: value } ) }
						min={ 200 }
						max={ 2000 }
						step={ 100 }
					/>
				</PanelBody>

				<PanelBody title={ __( 'Playback Settings', 'godam' ) } initialOpen={ false }>
					<RangeControl
						label={ __( 'Initial Delay (seconds)', 'godam' ) }
						help={ __( 'How long to wait before showing the popup on page load.', 'godam' ) }
						value={ initialDelay }
						onChange={ ( value ) => setAttributes( { initialDelay: value } ) }
						min={ 0 }
						max={ 30 }
						step={ 1 }
					/>

					<RangeControl
						label={ __( 'Duration per Video (seconds)', 'godam' ) }
						help={ __( 'How long each video plays before rotating to the next.', 'godam' ) }
						value={ durationSeconds }
						onChange={ ( value ) => setAttributes( { durationSeconds: value } ) }
						min={ 1 }
						max={ 30 }
						step={ 1 }
					/>

					<ToggleControl
						label={ __( 'Enable Autoplay', 'godam' ) }
						help={ __( 'Videos will autoplay muted (browser-safe). Disable to show play button overlay.', 'godam' ) }
						checked={ enableAutoplay }
						onChange={ ( value ) => setAttributes( { enableAutoplay: value } ) }
					/>

					<ToggleControl
						label={ __( 'Show Mute Button', 'godam' ) }
						help={ __( 'Displays a mute/unmute toggle on the reel popup.', 'godam' ) }
						checked={ showMuteButton }
						onChange={ ( value ) => setAttributes( { showMuteButton: value } ) }
					/>

					<ToggleControl
						label={ __( 'Show Play Button Overlay', 'godam' ) }
						help={ __( 'Displays a play/pause button over the active video.', 'godam' ) }
						checked={ showPlayButton }
						onChange={ ( value ) => setAttributes( { showPlayButton: value } ) }
					/>

					<ToggleControl
						label={ __( 'Enable video navigations on modal', 'godam' ) }
						help={ __( 'Shows previous/next navigation controls in the opened modal.', 'godam' ) }
						checked={ enableModalNavigation }
						onChange={ ( value ) => setAttributes( { enableModalNavigation: value } ) }
					/>
				</PanelBody>

				<PanelBody title={ __( 'Close Behavior', 'godam' ) } initialOpen={ false }>
					<SelectControl
						label={ __( 'After Close', 'godam' ) }
						value={ closePersistence }
						options={ [
							{ label: __( 'Show again on page reload', 'godam' ), value: 'show_again' },
							{ label: __( 'Stay hidden after close (this browser)', 'godam' ), value: 'hide_after_close' },
						] }
						onChange={ ( value ) => setAttributes( { closePersistence: value } ) }
					/>
				</PanelBody>
			</InspectorControls>

			<div { ...useBlockProps() }>
				<div className="godam-reel-pops-editor-preview">
					<div className="godam-reel-pops-icon">
						<span className="dashicons dashicons-video-alt3"></span>
					</div>
					<div className="godam-reel-pops-info">
						<strong>{ __( 'GoDAM Reel Pops', 'godam' ) }</strong>
						<p>
							{ videos.length === 0
								? __( 'No videos selected. Configure in the sidebar →', 'godam' )
								: videos.length === 1
									? __( '1 video configured', 'godam' )
									: `${ videos.length } ${ __( 'videos configured', 'godam' ) }` }
						</p>
						<p className="godam-reel-pops-meta-text">
							{ __( 'Position:', 'godam' ) } { position } | { __( 'Aspect:', 'godam' ) } { aspectRatio } | { __( 'Animation:', 'godam' ) } { animation }
						</p>
					</div>
				</div>
			</div>
		</>
	);
}
