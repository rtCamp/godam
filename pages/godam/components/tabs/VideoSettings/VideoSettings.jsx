/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import {
	Notice,
	Panel,
	PanelBody,
	Button,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { updateMediaSetting, selectHasChanges, selectMediaSettings } from '../../../redux/slice/media-settings.js';
import { scrollToTop, hasValidAPIKey } from '../../../utils/index.js';

import './video-settings.scss';

import APISettings from './APISettings.jsx';
import VideoCompressQuality from './VideoCompressQuality.jsx';
import VideoThumbnails from './VideoThumbnails.jsx';
import VideoWatermark from './VideoWatermark.jsx';

const VideoSettings = () => {
	const dispatch = useDispatch();
	const mediaSettings = useSelector( selectMediaSettings( 'video' ) );
	const isChanged = useSelector( selectHasChanges( 'video' ) );
	const [ saveMediaSettings, { isLoading: saveMediaSettingsLoading } ] = useSaveMediaSettingsMutation();
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		if ( window.scrollY > 0 ) {
			scrollToTop();
		}
	};

	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'video', key, value } ) );
	};

	const handleSaveSettings = async () => {
		try {
			const response = await saveMediaSettings( { settings: { video: mediaSettings } } ).unwrap();

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
		<div>
			{ notice.isVisible && (
				<Notice
					className="mb-4"
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
				>
					{ notice.message }
				</Notice>
			) }

			{ ! hasValidAPIKey && (
				<Panel className="godam-panel godam-margin-bottom godam-api-key-banner">
					<PanelBody opened>
						<h2>{ __( 'Ensure Smooth Video Playback', 'godam' ) }</h2>

						<p>{ __( 'Set up your video transcoding settings to optimize playback across all devices and network conditions. 🚀', 'godam' ) }</p>

						<div className="button-group">
							<Button
								href="https://godam.io/pricing"
								target="_blank"
								variant="primary"
								className="godam-button"
							>
								{ __( 'Choose GoDAM plan', 'godam' ) }
							</Button>
						</div>
					</PanelBody>
				</Panel>
			) }

			<APISettings setNotice={ setNotice } />

			{ hasValidAPIKey && (
				<>
					<VideoCompressQuality mediaSettings={ mediaSettings } handleSettingChange={ handleSettingChange } />
					<VideoThumbnails mediaSettings={ mediaSettings } handleSettingChange={ handleSettingChange } />
					<VideoWatermark mediaSettings={ mediaSettings } handleSettingChange={ handleSettingChange } />
				</>
			) }

			{ hasValidAPIKey && (
				<Button
					variant="primary"
					className="godam-button"
					onClick={ handleSaveSettings }
					isBusy={ saveMediaSettingsLoading }
					disabled={ saveMediaSettingsLoading || ! isChanged }
				>
					{ __( 'Save Settings', 'godam' ) }
				</Button>
			) }

		</div>
	);
};

export default VideoSettings;
