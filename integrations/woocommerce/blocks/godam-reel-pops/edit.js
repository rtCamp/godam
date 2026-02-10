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
import { video as videoIcon } from '@wordpress/icons';

/**
 * Edit component for GoDAM Reel Pops block.
 *
 * @param {Object} props Block props.
 * @return {Element} Edit UI.
 */
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

	/**
	 * Add a new video item to the list.
	 */
	const addVideo = () => {
		setAttributes( {
			videos: [ ...videos, { videoId: 0, productIds: '' } ],
		} );
	};

	/**
	 * Update a specific video item.
	 *
	 * @param {number} index Index of video to update.
	 * @param {Object} changes Changes to apply.
	 */
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
		if ( index === 0 ) return;
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
		if ( index === videos.length - 1 ) return;
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

					{ videos.map( ( video, index ) => (
						<div
							key={ index }
							style={ {
								marginBottom: '16px',
								padding: '12px',
								border: '1px solid #ddd',
								borderRadius: '4px',
								backgroundColor: '#f9f9f9',
							} }
						>
							<div style={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } }>
								<strong>{ __( 'Video', 'godam' ) } #{ index + 1 }</strong>
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

							<MediaUploadCheck>
								<MediaUpload
									onSelect={ ( media ) => updateVideo( index, { videoId: media.id } ) }
									allowedTypes={ [ 'video' ] }
									value={ video.videoId }
									render={ ( { open } ) => (
										<Button
											onClick={ open }
											variant={ video.videoId ? 'secondary' : 'primary' }
											icon={ videoIcon }
											style={ { marginBottom: '8px', width: '100%' } }
										>
											{ video.videoId
												? __( 'Change Video', 'godam' )
												: __( 'Select Video', 'godam' ) }
										</Button>
									) }
								/>
							</MediaUploadCheck>

							{ video.videoId > 0 && (
								<div style={ { fontSize: '12px', color: '#666', marginBottom: '8px' } }>
									{ __( 'Video ID:', 'godam' ) } { video.videoId }
								</div>
							) }

							<TextControl
								label={ __( 'Product IDs (comma-separated)', 'godam' ) }
								help={ __( 'Enter WooCommerce product IDs to show in the modal sidebar when this video is clicked.', 'godam' ) }
								value={ video.productIds }
								onChange={ ( value ) => updateVideo( index, { productIds: value } ) }
								placeholder={ __( 'e.g., 123, 456, 789', 'godam' ) }
							/>
						</div>
					) ) }

					<Button variant="primary" onClick={ addVideo } icon="plus">
						{ __( 'Add Video', 'godam' ) }
					</Button>
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
				</PanelBody>

				<PanelBody title={ __( 'Close Behavior', 'godam' ) } initialOpen={ false }>
					<SelectControl
						label={ __( 'After Close', 'godam' ) }
						value={ closePersistence }
						options={ [
							{ label: __( 'Show again on page reload', 'godam' ), value: 'show_again' },
							{ label: __( 'Stay hidden until page reload', 'godam' ), value: 'hide_after_close' },
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
