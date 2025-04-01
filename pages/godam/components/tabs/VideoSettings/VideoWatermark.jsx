/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { ToggleControl, TextControl, Button, Panel, PanelBody } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { hasValidAPIKey } from '../../../utils';

const isOnStarterPlan = false;

const VideoWatermark = ( { handleSettingChange } ) => {
	const useImage = useSelector( ( state ) => state.mediaSettings.video.use_watermark_image );
	const watermarkText = useSelector( ( state ) => state.mediaSettings.video.watermark_text );
	const enableWatermark = useSelector( ( state ) => state.mediaSettings.video.watermark );
	const selectedMedia = useSelector( ( state ) => state.mediaSettings.video.watermark_url );

	const openMediaPicker = () => {
		const fileFrame = wp.media( {
			title: 'Select a Watermark',
			button: {
				text: 'Use this watermark',
			},
			library: {
				type: 'image', // Restrict to images only
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();
			if ( attachment.type === 'image' ) {
				handleSettingChange( 'watermark_url', attachment.url );
			}
		} );

		fileFrame.open();
	};

	return (
		<Panel
			heading={ __( 'Video Watermark', 'godam' ) }
			className="godam-panel godam-margin-bottom"
		>
			<PanelBody>
				<div className="flex flex-col gap-2 opacity-90 relative">
					<ToggleControl
						__nextHasNoMarginBottom
						className="godam-toggle"
						label="Enable video watermark"
						checked={ ( ! hasValidAPIKey || isOnStarterPlan ) ? false : enableWatermark }
						onChange={ ( value ) => handleSettingChange( 'watermark', value ) }
						disabled={ isOnStarterPlan || ! hasValidAPIKey }
						help={ __( 'If enabled, GoDAM will add a watermark to the transcoded video', 'godam' ) }
					/>
					{ ! isOnStarterPlan && enableWatermark && (
						<>
							<div>
								<ToggleControl
									label={ __( 'Use image watermark', 'godam' ) }
									className="godam-toggle"
									checked={ useImage }
									onChange={ ( value ) => handleSettingChange( 'use_watermark_image', value ) }
									help={
										<>
											{ __( 'If enabled, Transcoder will use an image instead of text as the watermark for the transcoded video', 'godam' ) }
											<strong className="font-semibold">{ __( '(Recommended dimensions: 200 px width × 70 px height)', 'godam' ) }</strong>
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
												{ selectedMedia ? 'Change Watermark' : 'Select Watermark' }
											</Button>
											{ selectedMedia && (
												<Button
													isDestructive
													className="godam-button"
													onClick={ () => handleSettingChange( 'watermark_url', '' ) }
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
													alt="Selected watermark"
													className="max-w-[200px]"
												/>
											</div>
										) }
									</div>
								) }
							</div>
							{ ! useImage && (
								<div className="godam-form-group">
									<label className="label-text" htmlFor="watermark_text">{ __( 'Watermark Text', 'godam' ) }</label>
									<TextControl
										__next40pxDefaultSize
										__nextHasNoMarginBottom
										value={ watermarkText }
										onChange={ ( value ) => handleSettingChange( 'watermark_text', value ) }
										placeholder="Enter watermark text"
										className="godam-input"
										help={ __( 'Specify the watermark text that will be added to transcoded videos', 'godam' ) }
									/>
								</div>
							) }
						</>
					) }
				</div>
			</PanelBody>

		</Panel>
	);
};

export default VideoWatermark;
