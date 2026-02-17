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
	TextControl,
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
		bottomSpacing,
		sideSpacing,
	} = attributes;

	// Initialize blockId once
	useEffect( () => {
		if ( ! blockId ) {
			setAttributes( { blockId: `godam-reel-pops-${ clientId }` } );
		}
	}, [] );

	const mediaById = useSelect(
		( select ) => {
			const core = select( 'core' );
			const result = {};
			videos.forEach( ( video ) => {
				if ( video.videoId > 0 ) {
					result[ video.videoId ] = core.getMedia( video.videoId );
				}
			} );
			return result;
		},
		[ videos ],
	);

	/**
	 * Append selected videos from media library.
	 *
	 * @param {Object|Object[]} media Selected media or list.
	 */
	const appendSelectedVideos = ( media ) => {
		const selectedMedia = Array.isArray( media ) ? media : [ media ];
		const existingIds = new Set( videos.map( ( item ) => item.videoId ) );
		const appendedVideos = selectedMedia
			.filter( ( item ) => item && item.id && ! existingIds.has( item.id ) )
			.map( ( item ) => ( {
				videoId: item.id,
				productIds: '',
			} ) );

		if ( appendedVideos.length === 0 ) {
			return;
		}

		setAttributes( {
			videos: [ ...videos, ...appendedVideos ],
		} );
	};

	// Update a specific video item.
	const updateVideo = ( index, changes ) => {
		const updatedVideos = [ ...videos ];
		updatedVideos[ index ] = { ...updatedVideos[ index ], ...changes };
		setAttributes( { videos: updatedVideos } );
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
							render={ ( { open } ) => (
								<Button onClick={ open } variant="primary" icon={ videoIcon } style={ { marginBottom: '12px' } }>
									{ __( 'Select Videos', 'godam' ) }
								</Button>
							) }
						/>
					</MediaUploadCheck>

					<div
						style={ {
							display: 'grid',
							gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
							gap: '12px',
						} }
					>
						{ videos.map( ( video, index ) => (
							<div
								key={ index }
								style={ {
									padding: '12px',
									border: '1px solid #ddd',
									borderRadius: '4px',
									backgroundColor: '#f9f9f9',
								} }
							>
								<div style={ { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' } }>
									<div style={ { display: 'flex', gap: '10px', alignItems: 'center' } }>
										<div style={ { width: '64px', height: '64px', borderRadius: '4px', overflow: 'hidden', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
											{ mediaById[ video.videoId ]?.source_url ? (
												<img
													src={ mediaById[ video.videoId ]?.media_details?.sizes?.thumbnail?.source_url || mediaById[ video.videoId ]?.source_url }
													alt=""
													style={ { width: '100%', height: '100%', objectFit: 'cover' } }
												/>
											) : (
												<span style={ { color: '#fff', fontSize: '11px' } }>{ __( 'Video', 'godam' ) }</span>
											) }
										</div>
										<div>
											<strong>{ mediaById[ video.videoId ]?.title?.rendered || __( 'Untitled video', 'godam' ) }</strong>
											<div style={ { fontSize: '12px', color: '#666' } }>{ __( 'ID:', 'godam' ) } { video.videoId }</div>
										</div>
									</div>
									<div style={ { display: 'flex', gap: '4px' } }>
										{ index > 0 && (
											<Button
												isSmall
												onClick={ () => moveVideoUp( index ) }
												icon="arrow-up-alt2"
												label={ __( 'Move up', 'godam' ) }
											/>
										) }
										{ index < videos.length - 1 && (
											<Button
												isSmall
												onClick={ () => moveVideoDown( index ) }
												icon="arrow-down-alt2"
												label={ __( 'Move down', 'godam' ) }
											/>
										) }
										<Button
											isSmall
											isDestructive
											onClick={ () => removeVideo( index ) }
											icon="trash"
											label={ __( 'Remove', 'godam' ) }
										/>
									</div>
								</div>

								<TextControl
									label={ __( 'Product IDs (comma-separated)', 'godam' ) }
									help={ __( 'Enter WooCommerce product IDs to show in the modal sidebar when this video is clicked.', 'godam' ) }
									value={ video.productIds }
									onChange={ ( value ) => updateVideo( index, { productIds: value } ) }
									placeholder={ __( 'e.g., 123, 456, 789', 'godam' ) }
								/>
							</div>
						) ) }
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
						<p style={ { fontSize: '12px', color: '#666', marginTop: '4px' } }>
							{ __( 'Position:', 'godam' ) } { position } | { __( 'Aspect:', 'godam' ) } { aspectRatio } | { __( 'Animation:', 'godam' ) } { animation }
						</p>
					</div>
				</div>
			</div>
		</>
	);
}
