/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Notice, ToggleControl, Button, Panel, PanelBody } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { unlock } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { hasValidAPIKey } from '../../../utils';

const VideoEngagement = ( { handleSettingChange } ) => {
	const enableGlobalEngagement = useSelector( ( state ) => state.mediaSettings.video.enable_global_video_engagement );
	const enableGlobalShare = useSelector( ( state ) => state.mediaSettings.video.enable_global_video_share );

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
								setNotice( { ...notice, isVisible: false } );
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
								setNotice( { ...notice, isVisible: false } );
							} }
							disabled={ ! hasValidAPIKey }
							help={ __(
								'If enabled, Shares will be added to the transcoded video',
								'godam',
							) }
						/>
					</div>
				</PanelBody>
			</Panel>
		</div>
	);
};

export default VideoEngagement;
