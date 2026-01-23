/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { ToggleControl, Panel, PanelBody } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { hasValidAPIKey } from '../../../utils';

const VideoEngagement = ( { handleSettingChange } ) => {
	const enableGlobalEngagement = useSelector( ( state ) => state.mediaSettings.video.enable_global_video_engagement );
	const enableGlobalShare = useSelector( ( state ) => state.mediaSettings.video.enable_global_video_share );

	return (
		<div className="relative">
			<Panel
				heading={ __( 'Video Engagements', 'godam' ) }
				className="godam-panel godam-margin-bottom"
			>
				<PanelBody>
					<div className="flex flex-col gap-2 opacity-90 relative">
						<ToggleControl
							__nextHasNoMarginBottom
							className="godam-toggle"
							label={ __( 'Enable video engagement globally', 'godam' ) }
							checked={ enableGlobalEngagement }
							onChange={ ( value ) => {
								handleSettingChange( 'enable_global_video_engagement', value );
							} }
							disabled={ ! hasValidAPIKey }
							help={ __(
								'If disabled, Likes and Comments will be disabled globally for all GoDAM Video and GoDAM Video Gallery blocks. If enabled, it can be overridden in the block settings panel.',
								'godam',
							) }
						/>
						<ToggleControl
							__nextHasNoMarginBottom
							className="godam-toggle"
							label={ __( 'Enable video share globally', 'godam' ) }
							checked={ enableGlobalShare }
							onChange={ ( value ) => {
								handleSettingChange( 'enable_global_video_share', value );
							} }
							disabled={ ! hasValidAPIKey }
							help={ __(
								'If disabled, sharing options (such as social sharing buttons) will not be available for GoDAM videos. If enabled, it can be overridden in the block settings panel.',
							) }
						/>
					</div>
				</PanelBody>
			</Panel>
		</div>
	);
};

export default VideoEngagement;
