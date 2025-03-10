/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Notice } from '@wordpress/components';
import { useState, useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import AdaptiveBitrateStreaming from './components/AdaptiveBitrateStreaming.jsx';
import VideoThumbnails from './components/VideoThumbnails.jsx';
import VideoWatermark from './components/VideoWatermark.jsx';

import { useSaveMediaSettingsMutation } from '../redux/api/media-settings.js';

const VideoSettings = () => {
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );
	const isFirstRender = useRef( true );
	const [ saveMediaSettings, { isLoading: isSaving } ] = useSaveMediaSettingsMutation();
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );
	const [ isDirty, setIsDirty ] = useState( false );

	useEffect( () => {
		if ( isFirstRender.current ) {
			isFirstRender.current = false;
			return;
		}

		setIsDirty( true );
	}, [ mediaSettings ] );

	// Warn users before leaving the page if changes are unsaved
	useEffect( () => {
		const handleBeforeUnload = ( event ) => {
			if ( isDirty ) {
				event.preventDefault();
				event.returnValue = 'Changes that you made may not be saved.';
			}
		};

		window.addEventListener( 'beforeunload', handleBeforeUnload );
		return () => {
			window.removeEventListener( 'beforeunload', handleBeforeUnload );
		};
	}, [ isDirty ] );

	const handleSaveSettings = async () => {
		if ( mediaSettings.video.video_quality.length === 0 ) {
			setNotice( { message: 'Please select at least one video quality', status: 'warning', isVisible: true } );
			window.scrollTo( { top: 0, behavior: 'smooth' } );
			setTimeout( () => {
				setNotice( { message: '', status: '', isVisible: false } );
			}, 5000 );
			return;
		}

		try {
			const isSaved = await saveMediaSettings( { settings: mediaSettings } ).unwrap();

			if ( isSaved ) {
				// Success notice
				setNotice( { message: 'Settings saved successfully!', status: 'success', isVisible: true } );
			} else {
				// Error notice
				setNotice( { message: 'Failed to save settings. Please try again', status: 'error', isVisible: true } );
			}
		} catch ( error ) {
			// Error notice
			setNotice( { message: 'Failed to save settings. Please try again', status: 'error', isVisible: true } );
		}

		window.scrollTo( { top: 0, behavior: 'smooth' } );
		// Hide the notice after 5 seconds
		setTimeout( () => {
			setNotice( { ...notice, isVisible: false } );
		}, 5000 );
	};

	return (
		<>
			{ notice?.isVisible && (
				<Notice
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
					className="mb-2"
				>
					{ notice.message }
				</Notice>
			) }

			<AdaptiveBitrateStreaming />
			<VideoThumbnails />
			<VideoWatermark />

			<Button
				variant="primary"
				className="godam-button"
				isBusy={ isSaving }
				onClick={ handleSaveSettings }
			>
				{ __( 'Save Settings', 'godam' ) }
			</Button>

		</>
	);
};

export default VideoSettings;
