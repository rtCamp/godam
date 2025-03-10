/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { ToggleControl, TextControl, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateMediaSetting } from '../../redux/slice/media-settings';
import GodamPanel from '../../common/GodamPanel.jsx';

const isValidLicense = window.userData.valid_license;
const isStarterPlan = window.userData.user_data?.active_plan === 'Starter';

const VideoWatermark = () => {
	const dispatch = useDispatch();

	const useImage = useSelector( ( state ) => state.mediaSettings.video.use_watermark_image );
	const watermarkText = useSelector( ( state ) => state.mediaSettings.video.watermark_text );
	const disableWatermark = useSelector( ( state ) => ! state.mediaSettings.video.watermark );
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
				dispatch( updateMediaSetting( {
					category: 'video',
					key: 'watermark_url',
					value: attachment.url,
				} ) );
			}
		} );

		fileFrame.open();
	};

	return (
		<GodamPanel
			heading={ __( 'Video Watermark', 'godam' ) }
			isPremiumFeature={ true }
			upgradeFromStarterPlan={ true }
		>
			<div className="flex flex-col gap-2 opacity-90 relative">
				<ToggleControl
					__nextHasNoMarginBottom
					className="godam-toggle"
					label="Disable video watermark"
					checked={ ( ! isValidLicense || isStarterPlan ) ? false : disableWatermark }
					onChange={ ( value ) => dispatch( updateMediaSetting( {
						category: 'video',
						key: 'watermark',
						value: ! value,
					} ) ) }
					disabled={ isStarterPlan || ! isValidLicense }
					help={ __( 'If enabled, GoDAM will add a watermark to the transcoded video', 'godam' ) }
				/>
				{ ! isStarterPlan && ! disableWatermark && (
					<>
						<div>
							<ToggleControl
								label={ __( 'Use image watermark', 'godam' ) }
								className="godam-toggle"
								checked={ useImage }
								onChange={ ( value ) => {
									dispatch( updateMediaSetting( {
										category: 'video',
										key: 'use_watermark_image',
										value,
									} ) );
								} }
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
												onClick={ () => dispatch( updateMediaSetting(
													{
														category: 'video',
														key: 'watermark_url',
														value: null,
													},
												) ) }
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
							<div>
								<label className="easydam-settings-label" htmlFor="watermark_text">{ __( 'Watermark Text', 'godam' ) }</label>
								<TextControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									value={ watermarkText }
									onChange={ ( value ) => dispatch( updateMediaSetting(
										{
											category: 'video',
											key: 'watermark_text',
											value,
										},
									) ) }
									placeholder="Enter watermark text"
									className="godam-input"
									help={ __( 'Specify the watermark text that will be added to transcoded videos', 'godam' ) }
								/>
							</div>
						) }
					</>
				) }
			</div>

		</GodamPanel>
	);
};

export default VideoWatermark;
