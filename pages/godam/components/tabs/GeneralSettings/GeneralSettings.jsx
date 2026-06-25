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
import ConfirmModal from '../../ConfirmModal.jsx';

const GeneralSettings = () => {
	const dispatch = useDispatch();

	// Selectors to get media settings and change flag
	const { mediaSettings, isChanged } = useSelector( ( state ) => ( {
		mediaSettings: state.mediaSettings,
		isChanged: state.mediaSettings.isChanged,
	} ) );

	const [ saveMediaSettings, { isLoading: saveMediaSettingsLoading } ] = useSaveMediaSettingsMutation();
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );
	const [ isResetOnboardingOpen, setIsResetOnboardingOpen ] = useState( false );

	// The "folder organization" toggle is GoDAM's media-library integration kill-switch.
	// When set from code (constant/filter) the toggle is locked and the effective value
	// comes from the server; otherwise it reflects the saved setting.
	const mediaLibraryUICodeManaged = window?.godamSettings?.mediaLibraryUICodeManaged || false;
	const mediaLibraryUIEffective = window?.godamSettings?.mediaLibraryUIEffective ?? true;
	const folderOrgEnabled = mediaLibraryUICodeManaged
		? mediaLibraryUIEffective
		: mediaSettings?.general?.enable_folder_organization;

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

	// Reset onboarding.
	//
	// The guided-tour system is not wired up yet, so for now this clears any
	// client-side onboarding progress flags so the welcome flow can show again.
	// Once the tour ships, replace this with the appropriate reset call.
	const handleResetOnboarding = () => {
		try {
			Object.keys( window.localStorage )
				.filter( ( key ) => /onboarding|godam.*tour|welcome/i.test( key ) )
				.forEach( ( key ) => window.localStorage.removeItem( key ) );

			setIsResetOnboardingOpen( false );
			showNotice( __( 'Onboarding has been reset. The guided tour will start again the next time you open your dashboard.', 'godam' ) );
		} catch ( error ) {
			setIsResetOnboardingOpen( false );
			showNotice( __( 'Failed to reset onboarding.', 'godam' ), 'error' );
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

			<Panel header={ __( 'General Settings', 'godam' ) } className="godam-panel godam-margin-bottom">
				<PanelBody opened>
					<ToggleControl
						__nextHasNoMarginBottom
						className="godam-margin-bottom"
						label={ __( 'Enable folder organization in media library.', 'godam' ) }
						help={
							mediaLibraryUICodeManaged
								? __( 'This setting is managed by your site administrator and can’t be changed here.', 'godam' )
								: __( 'Keep this option enabled to organize media into folders within the media library. Disabling it will remove folder organization.', 'godam' )
						}
						checked={ folderOrgEnabled }
						disabled={ mediaLibraryUICodeManaged }
						onChange={ ( value ) => handleSettingChange( 'enable_folder_organization', value ) }
						data-test-id="godam-settings-general-control-folder-org"
					/>

					<ToggleControl
						__nextHasNoMarginBottom
						className="godam-margin-bottom"
						label={ __( 'Enable GTM Tracking', 'godam' ) }
						help={ __( 'Enable Google Tag Manager video tracking for analytics and conversion tracking.', 'godam' ) }
						checked={ mediaSettings?.general?.enable_gtm_tracking }
						onChange={ ( value ) => handleSettingChange( 'enable_gtm_tracking', value ) }
						data-test-id="godam-settings-general-control-gtm"
					/>

				</PanelBody>
			</Panel>

			<Panel header={ __( 'Onboarding', 'godam' ) } className="godam-panel godam-margin-bottom">
				<PanelBody opened>
					<h3 className="godam-settings-section-title">{ __( 'Reset Onboarding', 'godam' ) }</h3>
					<p className="godam-settings-help">
						{ __( 'Start the guided tour again from the beginning. The next time you open your dashboard, you’ll see the welcome screen where you can pick a guide and we’ll walk you through it. This won’t sign you out or affect any of your media, settings, or content.', 'godam' ) }
					</p>
					<Button
						variant="primary"
						className="mt-3"
						onClick={ () => setIsResetOnboardingOpen( true ) }
						data-test-id="godam-settings-reset-onboarding"
					>
						{ __( 'Reset onboarding', 'godam' ) }
					</Button>
				</PanelBody>
			</Panel>

			<div className="godam-settings__save-row">
				<Button
					variant="primary"
					onClick={ handleSaveSettings }
					icon={ saveMediaSettingsLoading && <Spinner /> }
					isBusy={ saveMediaSettingsLoading }
					disabled={ saveMediaSettingsLoading || ! isChanged }
					data-test-id="godam-settings-general-button-save"
				>
					{ saveMediaSettingsLoading ? __( 'Saving…', 'godam' ) : __( 'Save', 'godam' ) }
				</Button>
			</div>

			<ConfirmModal
				isOpen={ isResetOnboardingOpen }
				title={ __( 'Reset onboarding?', 'godam' ) }
				confirmLabel={ __( 'Yes, Restart', 'godam' ) }
				cancelLabel={ __( 'Cancel', 'godam' ) }
				onCancel={ () => setIsResetOnboardingOpen( false ) }
				onConfirm={ handleResetOnboarding }
				data-test-id="godam-settings-general-button-confirm-reset"
			>
				{ __( 'We’ll restart the guided tour. The next time you open your dashboard, you’ll see the welcome screen where you can pick a guide and step through it again. This won’t sign you out or affect your media, settings, or content.', 'godam' ) }
			</ConfirmModal>
		</>
	);
};

export default GeneralSettings;
