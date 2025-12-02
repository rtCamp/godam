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
								'If disabled, Engagement will be disabled globally for all GODAM Video and GODAM Gallery blocks. Users will not be able to like, comment, or share videos. By enabling this option, Engagement will be enabled globally for all GODAM Video and GODAM Gallery blocks. But you can still disable Engagement on individual blocks from the block settings panel.',
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
								'If disabled, sharing options (such as social sharing buttons) will not be available for GODAM videos GODAM Gallery block globally. By enabling this option, sharing options will be available globally for all GODAM Video and GODAM Gallery blocks. But you can still disable sharing on individual blocks from the block settings panel.',
							) }
						/>
					</div>
				</PanelBody>
			</Panel>
		</div>
	);
};

export default VideoEngagement;
