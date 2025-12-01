/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { ToggleControl, Button, Panel, PanelBody } from '@wordpress/components';
import { unlock } from '@wordpress/icons';
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
				heading={ __( 'Video Engagements', 'godam' ) }
				className="godam-panel godam-margin-bottom"
			>
				<PanelBody>
					<div className="flex flex-col gap-2 opacity-90 relative">
						<ToggleControl
							__nextHasNoMarginBottom
							className="godam-toggle"
							label={ __( 'Enable video engagement globally', 'godam' ) }
							checked={
								! hasValidAPIKey ? false : enableGlobalEngagement
							}
							onChange={ ( value ) => {
								handleSettingChange( 'enable_global_video_engagement', value );
							} }
							disabled={ ! hasValidAPIKey }
							help={ __(
								'If enabled, Engagement will be added to the transcoded video',
								'godam',
							) }
						/>
						<ToggleControl
							__nextHasNoMarginBottom
							className="godam-toggle"
							label={ __( 'Enable video share globally', 'godam' ) }
							checked={
								! hasValidAPIKey ? false : enableGlobalShare
							}
							onChange={ ( value ) => {
								handleSettingChange( 'enable_global_video_share', value );
							} }
							disabled={ ! hasValidAPIKey }
							help={ __(
								'If enabled, sharing options (such as social sharing buttons) will be available for videos globally.',
							) }
						/>
					</div>
				</PanelBody>
			</Panel>
		</div>
	);
};

export default VideoEngagement;
