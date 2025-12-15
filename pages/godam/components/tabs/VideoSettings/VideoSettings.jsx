/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import {
	Notice,
	Panel,
	PanelBody,
	Button,
	Spinner,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { updateMediaSetting, resetChangeFlag } from '../../../redux/slice/media-settings.js';
import { scrollToTop, hasValidAPIKey } from '../../../utils/index.js';
import APISettings from './APISettings.jsx';
import VideoCompressQuality from './VideoCompressQuality.jsx';
import VideoThumbnails from './VideoThumbnails.jsx';
import VideoWatermark from './VideoWatermark.jsx';
import VideoEngagement from './VideoEngagement.jsx';

/**
 * Styles
 */
import './video-settings.scss';

const VideoSettings = () => {
	const dispatch = useDispatch();

	// Selectors to get media settings and change flag
	const { mediaSettings, isChanged } = useSelector( ( state ) => ( {
		mediaSettings: state.mediaSettings,
		isChanged: state.mediaSettings.isChanged,
	} ) );

	const [ saveMediaSettings, { isLoading: saveMediaSettingsLoading } ] = useSaveMediaSettingsMutation();
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	// Function to show a notice message
	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		if ( window.scrollY > 0 ) {
			scrollToTop();
		}
	};

	// Function to handle setting change
	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'video', key, value } ) );
	};

	// Function to handle saving settings
	const handleSaveSettings = async () => {
		try {
			const response = await saveMediaSettings( { settings: mediaSettings } ).unwrap();

			if ( response?.status === 'success' ) {
				showNotice( __( 'Settings saved successfully.', 'godam' ) );
				dispatch( resetChangeFlag() );
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
								href={ `https://godam.io/pricing?utm_campaign=buy-plan&utm_source=${ window?.location?.host || '' }&utm_medium=plugin&utm_content=settings` }
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
					<VideoCompressQuality handleSettingChange={ handleSettingChange } />
					<VideoThumbnails handleSettingChange={ handleSettingChange } />
					<VideoWatermark handleSettingChange={ handleSettingChange } />
					<VideoEngagement handleSettingChange={ handleSettingChange } />
				</>
			) }

			{ hasValidAPIKey && (
				<Button
					variant="primary"
					className="godam-button"
					onClick={ handleSaveSettings }
					icon={ saveMediaSettingsLoading && <Spinner /> }
					isBusy={ saveMediaSettingsLoading }
					disabled={ saveMediaSettingsLoading || ! isChanged }
				>
					{ saveMediaSettingsLoading ? __( 'Saving…', 'godam' ) : __( 'Save', 'godam' ) }
				</Button>
			) }

		</div>
	);
};

export default VideoSettings;
