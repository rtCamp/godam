/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import {
	Button,
	Notice,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { scrollToTop } from '../../../utils/index.js';
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { updateMediaSetting, selectHasChanges, selectMediaSettings } from '../../../redux/slice/media-settings.js';
import CustomVideoPlayerCSS from './CustomVideoPlayerCSS.jsx';

const VideoPlayer = () => {
	const dispatch = useDispatch();
	const [ saveMediaSettings, { isLoading: saveMediaSettingsLoading } ] =
    useSaveMediaSettingsMutation();
	const mediaSettings = useSelector( selectMediaSettings( 'video_player' ) );
	const isChanged = useSelector( selectHasChanges( 'video_player' ) );
	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'video_player', key, value } ) );
	};

	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		if ( window.scrollY > 0 ) {
			scrollToTop();
		}
	};

	const handleSaveSettings = async () => {
		try {
			const response = await saveMediaSettings( { settings: { video_player: mediaSettings } } ).unwrap();

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

			<CustomVideoPlayerCSS mediaSettings={ mediaSettings } handleSettingChange={ handleSettingChange } />

			<Button
				variant="primary"
				className="godam-button"
				onClick={ handleSaveSettings }
				isBusy={ saveMediaSettingsLoading }
				disabled={ saveMediaSettingsLoading || ! isChanged }
			>
				{ __( 'Save Settings', 'godam' ) }
			</Button>

		</>
	);
};

export default VideoPlayer;
