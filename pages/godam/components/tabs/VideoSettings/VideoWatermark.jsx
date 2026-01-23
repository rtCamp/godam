/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Notice, ToggleControl, TextControl, Button, Panel, PanelBody } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { hasValidAPIKey } from '../../../utils';

const VideoWatermark = ( { handleSettingChange } ) => {
	const useImage = useSelector( ( state ) => state.mediaSettings.video.use_watermark_image );
	const watermarkText = useSelector( ( state ) => state.mediaSettings.video.watermark_text );
	const enableWatermark = useSelector( ( state ) => state.mediaSettings.video.watermark );
	const selectedMedia = useSelector( ( state ) => state.mediaSettings.video.watermark_url );
	const watermarkImageId = useSelector( ( state ) => state.mediaSettings.video.watermark_image_id );

	/**
	 * State to manage the notice message and visibility.
	 */
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	/**
	 * To show a notice message.
	 *
	 * @param {string} message Text to display in the notice.
	 * @param {string} status  Status of the notice, can be 'success', 'error', etc.
	 */
	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
	};

	/**
	 * Function to open the WordPress media picker for selecting a brand image.
	 * It restricts the selection to images only and handles the selection event.
	 *
	 * For the uploader tab of WordPress media library, it checks if the selected file is an image.
	 * If not, it shows an error notice.
	 */
	const openMediaPicker = () => {
		const fileFrame = wp.media( {
			title: __( 'Select a Watermark', 'godam' ),
			button: {
				text: __( 'Use this watermark', 'godam' ),
			},
			library: {
				type: 'image', // Restrict to images only
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();

			/**
			 * This handles the case for the uploader tab of WordPress media library.
			 */
			if ( attachment.type !== 'image' ) {
				showNotice( __( 'Only Image file is allowed', 'godam' ), 'error' );
				return;
			}

			handleSettingChange( 'watermark_url', attachment.url );
			handleSettingChange( 'watermark_image_id', attachment.id );
		} );

		if ( watermarkImageId ) {
			const attachment = wp.media.attachment( watermarkImageId );
			attachment.fetch();

			fileFrame.on( 'open', function() {
				const selection = fileFrame.state().get( 'selection' );
				selection.reset();
				selection.add( attachment );
			} );
		}

		fileFrame.open();
	};

	return (
		<div className="relative">
			<Panel
				heading={ __( 'Video Watermark', 'godam' ) }
				className="godam-panel godam-margin-bottom"
			>
				<PanelBody>
					<div className="flex flex-col gap-2 opacity-90 relative">
						<ToggleControl
							__nextHasNoMarginBottom
							className="godam-toggle"
							label={ __( 'Enable video watermark', 'godam' ) }
							checked={ enableWatermark }
							onChange={ ( value ) => {
								handleSettingChange( 'watermark', value );
								setNotice( { ...notice, isVisible: false } );
							} }
							disabled={ ! hasValidAPIKey }
							help={ __(
								'If enabled, GoDAM will add a watermark to the transcoded video',
								'godam',
							) }
						/>
						{ enableWatermark && (
							<>
								<div>
									<ToggleControl
										label={ __( 'Use image watermark', 'godam' ) }
										className="godam-toggle"
										checked={ useImage }
										onChange={ ( value ) => {
											handleSettingChange( 'use_watermark_image', value );
											setNotice( { ...notice, isVisible: false } );
										} }
										help={
											<>
												{ __(
													'If enabled, Transcoder will use an image instead of text as the watermark for the transcoded video',
													'godam',
												) }
												<strong className="font-semibold">
													{ __(
														'(Recommended dimensions: 200 px width × 70 px height)',
														'godam',
													) }
												</strong>
											</>
										}
									/>

									{ useImage && (
										<div className="mt-2">
											<div className="flex gap-2">
												<Button
													variant="primary"
													onClick={ openMediaPicker }
													className="godam-button"
												>
													{ selectedMedia
														? __( 'Change Watermark', 'godam' )
														: __( 'Select Watermark', 'godam' ) }
												</Button>
												{ selectedMedia && (
													<Button
														isDestructive
														className="godam-button"
														onClick={ () => {
															handleSettingChange( 'watermark_url', '' );
															handleSettingChange( 'watermark_image_id', null );
														} }
														variant="secondary"
													>
														{ __( 'Remove Watermark', 'godam' ) }
													</Button>
												) }
											</div>
											{ selectedMedia && (
												<div className="mt-2 border-2 border-blue-700 rounded-lg p-2 inline-block bg-gray-200">
													<img
														src={ selectedMedia }
														alt={ __( 'Selected watermark', 'godam' ) }
														className="max-w-[200px]"
													/>
												</div>
											) }
											{ notice.isVisible && (
												<Notice
													className="my-4"
													status={ notice.status }
													onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
												>
													{ notice.message }
												</Notice>
											) }
										</div>
									) }
								</div>
								{ ! useImage && (
									<div className="godam-form-group">
										<label className="label-text" htmlFor="watermark_text">
											{ __( 'Watermark Text', 'godam' ) }
										</label>
										<TextControl
											__next40pxDefaultSize
											__nextHasNoMarginBottom
											value={ watermarkText }
											onChange={ ( value ) =>
												handleSettingChange( 'watermark_text', value )
											}
											placeholder={ __( 'Enter watermark text', 'godam' ) }
											className="godam-input"
											help={ __(
												'Specify the watermark text that will be added to transcoded videos',
												'godam',
											) }
										/>
									</div>
								) }
							</>
						) }
					</div>
				</PanelBody>
			</Panel>
		</div>
	);
};

export default VideoWatermark;
