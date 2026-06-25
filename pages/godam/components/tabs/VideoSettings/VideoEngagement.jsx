/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { hasAPIKey } from '../../../utils';

const VideoEngagement = ( { handleSettingChange } ) => {
	const enableGlobalEngagement = useSelector( ( state ) => state.mediaSettings.video.enable_global_video_engagement );
	const enableGlobalShare = useSelector( ( state ) => state.mediaSettings.video.enable_global_video_share );
	const engagementFeatureEnabled = window?.godamSettings?.engagementFeatureEnabled ?? false;

	return (
		<div className="flex flex-col gap-2 relative">
			{ engagementFeatureEnabled && (
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Enable video engagement globally', 'godam' ) }
					checked={ enableGlobalEngagement }
					onChange={ ( value ) => handleSettingChange( 'enable_global_video_engagement', value ) }
					disabled={ ! hasAPIKey }
					help={ __( 'If disabled, Likes and Comments will be disabled globally for all GoDAM Video and GoDAM Video Gallery blocks. If enabled, it can be overridden in the block settings panel.', 'godam' ) }
				/>
			) }
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Enable video share globally', 'godam' ) }
				checked={ enableGlobalShare }
				onChange={ ( value ) => handleSettingChange( 'enable_global_video_share', value ) }
				disabled={ ! hasAPIKey }
				help={ __( 'If disabled, sharing options (such as social sharing buttons) will not be available for GoDAM videos. If enabled, it can be overridden in the block settings panel.', 'godam' ) }
			/>
		</div>
	);
};

export default VideoEngagement;
