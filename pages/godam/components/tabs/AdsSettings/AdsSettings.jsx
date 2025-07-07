/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import {
	Notice,
	ToggleControl,
	Panel,
	PanelBody,
	Button,
	TextareaControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { scrollToTop } from '../../../utils/index.js';
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { updateMediaSetting } from '../../../redux/slice/media-settings.js';

const AdsSettings = () => {
	const dispatch = useDispatch();
	const [ saveMediaSettings, { isLoading: saveMediaSettingsLoading } ] =
    useSaveMediaSettingsMutation();
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );

	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		scrollToTop();
	};

	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'ads_settings', key, value } ) );
	};

	const handleSaveSettings = async () => {
		try {
			const response = await saveMediaSettings( {
				settings: { ads_settings: mediaSettings?.ads_settings },
			} ).unwrap();

			if ( response?.status === 'success' ) {
				showNotice( __( 'Settings saved successfully.', 'godam' ) );
			} else {
				showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
			}
		} catch ( error ) {
			showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
		}
	};

	return (
		<>
			{ notice.isVisible && (
				<Notice
					className="mb-4"
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
				>
					{ notice.message }
				</Notice>
			) }

			<Panel header={ __( 'Video Ads Settings', 'godam' ) } className="godam-panel">
				<PanelBody opened>
					<ToggleControl
						className="godam-toggle mb-4"
						label={ __( 'Enable Global Video Ads', 'godam' ) }
						help={ __( 'Enable or disable video ads on all videos across the site', 'godam' ) }
						checked={ mediaSettings?.ads_settings?.enable_global_video_ads }
						onChange={ ( value ) => handleSettingChange( 'enable_global_video_ads', value ) }
					/>

					{
						mediaSettings?.ads_settings?.enable_global_video_ads &&
						<TextareaControl
							className="godam-input mb-4"
							label={ __( 'Ad Tag URL', 'godam' ) }
							help={
								<div>
									{ __( 'A VAST ad tag URL is used by a player to retrieve video and audio ads', 'godam' ) }
									<a href="https://support.google.com/admanager/answer/177207?hl=en" target="_blank" rel="noreferrer noopener" className="text-blue-500 underline">{ __( 'Learn more.', 'godam' ) }</a>
								</div>
							}
							value={ mediaSettings?.ads_settings?.adTagUrl || '' }
							onChange={ ( value ) => handleSettingChange( 'adTagUrl', value ) }
						/>
					}
				</PanelBody>
			</Panel>

			<Button
				variant="primary"
				className="godam-button"
				onClick={ handleSaveSettings }
				isBusy={ saveMediaSettingsLoading }
				disabled={ saveMediaSettingsLoading }
			>
				{ __( 'Save Settings', 'godam' ) }
			</Button>
		</>
	);
};

export default AdsSettings;
