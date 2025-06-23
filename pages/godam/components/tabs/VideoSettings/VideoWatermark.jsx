/**
 * WordPress dependencies
 */
import { ToggleControl, TextControl, Button, Panel, PanelBody } from '@wordpress/components';
import { unlock } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { hasValidAPIKey } from '../../../utils';

const VideoWatermark = ( { mediaSettings, handleSettingChange } ) => {
	const useImage = mediaSettings.use_watermark_image || false;
	const watermarkText = mediaSettings.watermark_text || '';
	const enableWatermark = mediaSettings.watermark || false;
	const selectedMedia = mediaSettings.watermark_url || '';

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
			if ( attachment.type === 'image' ) {
				handleSettingChange( 'watermark_url', attachment.url );
			}
		} );

		fileFrame.open();
	};

	return (
		<div className="relative">
			{ ! hasValidAPIKey && (
				<div className="premium-feature-overlay">
					<Button
						className="godam-button"
						icon={ unlock }
						href="https://app.godam.io/subscription/plans"
						target="_blank"
						variant="primary"
					>
						{ __( 'Upgrade to unlock', 'godam' ) }
					</Button>
				</div>
			) }
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
							checked={
								! hasValidAPIKey ? false : enableWatermark
							}
							onChange={ ( value ) => handleSettingChange( 'watermark', value ) }
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
										onChange={ ( value ) =>
											handleSettingChange( 'use_watermark_image', value )
										}
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
														onClick={ () =>
															handleSettingChange( 'watermark_url', '' )
														}
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
