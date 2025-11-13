/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import {
	ToggleControl,
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
import { scrollToTop } from '../../../utils/index.js';
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { updateMediaSetting, resetChangeFlag } from '../../../redux/slice/media-settings.js';

const GeneralSettings = () => {
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
		dispatch( updateMediaSetting( { category: 'general', key, value } ) );
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

			<Panel header={ __( 'General Settings', 'godam' ) } className="godam-panel">
				<PanelBody opened>
					<ToggleControl
						__nextHasNoMarginBottom
						className="godam-toggle godam-margin-bottom"
						label={ __( 'Enable folder organization in media library.', 'godam' ) }
						help={ __( 'Keep this option enabled to organize media into folders within the media library. Disabling it will remove folder organization.', 'godam' ) }
						checked={ mediaSettings?.general?.enable_folder_organization }
						onChange={ ( value ) => handleSettingChange( 'enable_folder_organization', value ) }
					/>

					<ToggleControl
						__nextHasNoMarginBottom
						className="godam-toggle godam-margin-bottom"
						label={ __( 'Enable GTM Tracking', 'godam' ) }
						help={ __( 'Enable Google Tag Manager video tracking for analytics and conversion tracking.', 'godam' ) }
						checked={ mediaSettings?.general?.enable_gtm_tracking }
						onChange={ ( value ) => handleSettingChange( 'enable_gtm_tracking', value ) }
					/>

					<ToggleControl
						__nextHasNoMarginBottom
						className="godam-toggle godam-margin-bottom"
						label={ __( 'Enable PostHog Analytics', 'godam' ) }
						help={ __( 'Allows the GoDAM plugin to track events for analytics purposes. This helps us improve the product experience.', 'godam' ) }
						checked={ mediaSettings?.general?.enable_posthog_tracking }
						onChange={ ( value ) => handleSettingChange( 'enable_posthog_tracking', value ) }
					/>

				</PanelBody>
			</Panel>

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
		</>
	);
};

export default GeneralSettings;
