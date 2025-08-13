/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import {
	ToggleControl,
	Panel,
	PanelBody,
	TextareaControl,
	SelectControl,
	RangeControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateMediaSetting } from '../../../../redux/slice/media-settings.js';

const VideoAdsLayer = () => {
	const dispatch = useDispatch();

	// Get media settings from Redux store
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );

	// Function to handle setting change
	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'global_layers', subcategory: 'video_ads', key, value } ) );
	};

	const placementOptions = [
		{ label: __( 'Start of video', 'godam' ), value: 'start' },
		{ label: __( 'Middle of video', 'godam' ), value: 'middle' },
		{ label: __( 'End of video', 'godam' ), value: 'end' },
	];

	return (
		<Panel header={ __( 'Video Ads Layer', 'godam' ) } className="godam-panel">
			<PanelBody opened>
				<ToggleControl
					className="godam-toggle mb-4"
					label={ __( 'Enable Global Video Ads', 'godam' ) }
					help={ __( 'Enable or disable video ads on all videos across the site', 'godam' ) }
					checked={ mediaSettings?.global_layers?.video_ads?.enabled || false }
					onChange={ ( value ) => handleSettingChange( 'enabled', value ) }
				/>

				{
					mediaSettings?.global_layers?.video_ads?.enabled && (
						<>
							<TextareaControl
								className="godam-input mb-4"
								label={ __( 'Ad Tag URL', 'godam' ) }
								help={
									<div>
										{ __( 'A VAST ad tag URL is used by a player to retrieve video and audio ads ', 'godam' ) }
										<a href="https://support.google.com/admanager/answer/177207?hl=en" target="_blank" rel="noreferrer noopener" className="text-blue-500 underline">{ __( 'Learn more.', 'godam' ) }</a>
									</div>
								}
								value={ mediaSettings?.global_layers?.video_ads?.adTagUrl || '' }
								onChange={ ( value ) => handleSettingChange( 'adTagUrl', value ) }
							/>

							<SelectControl
								className="godam-select mb-4"
								label={ __( 'Ad Placement', 'godam' ) }
								help={ __( 'Choose when the ad should appear in the video timeline', 'godam' ) }
								value={ mediaSettings?.global_layers?.video_ads?.placement || 'start' }
								options={ placementOptions }
								onChange={ ( value ) => handleSettingChange( 'placement', value ) }
							/>

							{ mediaSettings?.global_layers?.video_ads?.placement === 'middle' && (
								<RangeControl
									className="godam-range mb-4"
									label={ __( 'Ad Position (seconds)', 'godam' ) }
									help={ __( 'Specify when the ad should appear in the middle of the video', 'godam' ) }
									value={ mediaSettings?.global_layers?.video_ads?.position || 30 }
									onChange={ ( value ) => handleSettingChange( 'position', value ) }
									min={ 1 }
									max={ 300 }
								/>
							) }

							<RangeControl
								className="godam-range mb-4"
								label={ __( 'Ad Duration (seconds)', 'godam' ) }
								help={ __( 'Maximum duration for the ad', 'godam' ) }
								value={ mediaSettings?.global_layers?.video_ads?.duration || 30 }
								onChange={ ( value ) => handleSettingChange( 'duration', value ) }
								min={ 5 }
								max={ 120 }
							/>
						</>
					)
				}
			</PanelBody>
		</Panel>
	);
};

export default VideoAdsLayer;
