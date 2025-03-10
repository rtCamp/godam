/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { ToggleControl, CheckboxControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateMediaSetting } from '../../redux/slice/media-settings';
import GodamPanel from '../../common/GodamPanel.jsx';

const videoQualityOptions = [
	{ label: 'Auto', value: 'auto' },
	{ label: '240p (352 x 240)', value: '240' },
	{ label: '360p (640 x 360)', value: '360' },
	{ label: '480p (842 x 480)', value: '480' },
	{ label: '720p (1280 x 720)', value: '720' },
	{ label: '1080p (1920 x 1080) (HD)', value: '1080' },
	{ label: '1440p (2560 x 1440) (HD)', value: '1440' },
	{ label: '2160p (3840 x 2160) (4K)', value: '2160' },
];

const AdaptiveBitrateStreaming = () => {
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );
	const dispatch = useDispatch();

	const videoQuality = useSelector( ( state ) => state.mediaSettings.video.video_quality ) || [];

	// Function to handle video quality selection
	const handleVideoQualityChange = ( optionValue, isChecked ) => {
		let updatedQuality;

		if ( optionValue === 'auto' ) {
			updatedQuality = isChecked
				? videoQualityOptions.map( ( opt ) => opt.value ) // Select all if "Auto" is checked
				: videoQuality.filter( ( val ) => val !== 'auto' );
		} else {
			updatedQuality = isChecked
				? [ ...videoQuality, optionValue ]
				: videoQuality.filter( ( val ) => val !== optionValue );

			// Check if all non-auto options are selected
			const allOthersSelected = videoQualityOptions
				.filter( ( opt ) => opt.value !== 'auto' ) // Exclude "auto"
				.every( ( opt ) => updatedQuality.includes( opt.value ) );

			// Add "Auto" if all are selected, otherwise remove it
			updatedQuality = allOthersSelected
				? [ 'auto', ...updatedQuality.filter( ( v ) => v !== 'auto' ) ]
				: updatedQuality.filter( ( v ) => v !== 'auto' );
		}

		dispatch( updateMediaSetting( { category: 'video', key: 'video_quality', value: updatedQuality } ) );
	};

	return (
		<GodamPanel
			heading={ __( 'Adaptive Bitrate Streaming', 'godam' ) }
			isPremiumFeature={ true }
		>
			<form id="easydam-video-settings" className="flex flex-col" onSubmit={ ( e ) => e.preventDefault() }>
				<div>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Enable Adaptive Bitrate Streaming', 'godam' ) }
						help={ __( 'If enabled, GoDAM will generate multiple video files with different bitrates for adaptive streaming', 'godam' ) }
						checked={ mediaSettings?.video?.adaptive_bitrate || false }
						className="godam-toggle"
						onChange={ ( value ) => dispatch(
							updateMediaSetting( {
								category: 'video',
								key: 'adaptive_bitrate',
								value,
							} ) ) }
					/>
				</div>

				<div>
					<div className="mt-4">
						<label className="easydam-settings-label" htmlFor="video_quality">{ __( 'Video quality', 'godam' ) }</label>
						<div className="grid grid-rows-4 grid-flow-col gap-2 border rounded p-5">
							{ videoQualityOptions.map( ( option ) => (
								<div key={ option.value } className="py-1 w-fit">
									<CheckboxControl
										className="godam-checkbox"
										label={ option.label }
										checked={ videoQuality.includes( option.value ) || videoQuality.includes( 'auto' ) }
										onChange={ ( isChecked ) => handleVideoQualityChange( option.value, isChecked ) }
									/>
								</div>
							) ) }

						</div>
						<div className="text-sm mt-2">
							{ __( 'Select one or more video qualities for delivery. GoDAM will generate videos with selected resolutions. Transcoding will be done to the appropriate resolution supported by the video, up to the max resolution of each video.', 'godam' ) }
							<br className="mb-1" />
							<strong>{ __( 'Note: ', 'godam' ) }</strong>
							{ __( 'Selecting Auto will automatically include all available resolutions for delivery.', 'godam' ) }
						</div>
					</div>
				</div>

			</form>
		</GodamPanel>
	);
};

export default AdaptiveBitrateStreaming;
