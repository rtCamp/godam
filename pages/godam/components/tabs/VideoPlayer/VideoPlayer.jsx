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
	Spinner,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { scrollToTop } from '../../../utils/index.js';
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { updateMediaSetting, selectHasChanges, selectMediaSettings } from '../../../redux/slice/media-settings.js';
import CustomVideoPlayerCSS from './CustomVideoPlayerCSS.jsx';

const VideoPlayer = () => {
	const dispatch = useDispatch();
	const [ saveMediaSettings, { isLoading: saveMediaSettingsLoading } ] = useSaveMediaSettingsMutation();
	const mediaSettings = useSelector( selectMediaSettings( 'video_player' ) );
	const allMediaSettings = useSelector( ( state ) => state.mediaSettings.settings );
	const isChanged = useSelector( selectHasChanges( 'video_player' ) );
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	// Handle setting changes
	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'video_player', key, value } ) );
	};

	// Show notice function to display messages
	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		if ( window.scrollY > 0 ) {
			scrollToTop();
		}
	};

	// Handle saving settings
	const handleSaveSettings = async () => {
		try {
			const response = await saveMediaSettings( { settings: allMediaSettings } ).unwrap();

			if ( response?.status === 'success' ) {
				showNotice( __( 'Settings saved successfully.', 'godam' ) );
			} else {
				showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
			}
		} catch ( error ) {
			showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
		}
	};

	// Add unsaved changes warning
	useEffect( () => {
		const handleBeforeUnload = ( event ) => {
			if ( isChanged ) {
				event.preventDefault();
				event.returnValue = __( 'You have unsaved changes. Are you sure you want to leave?', 'godam' );
			}
		};
		window.addEventListener( 'beforeunload', handleBeforeUnload );
		return () => window.removeEventListener( 'beforeunload', handleBeforeUnload );
	}, [ isChanged ] );

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
				icon={ saveMediaSettingsLoading && <Spinner /> }
				onClick={ handleSaveSettings }
				isBusy={ saveMediaSettingsLoading }
				disabled={ ! isChanged }
			>
				{ saveMediaSettingsLoading ? __( 'Saving…', 'godam' ) : __( 'Save', 'godam' ) }
			</Button>

		</>
	);
};

export default VideoPlayer;
