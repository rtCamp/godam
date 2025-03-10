/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import {
	TextControl,
	ToggleControl,
	Button,
	Notice,
	Panel,
	PanelBody,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import PricingPlan from './components/PricingPlan.jsx';
import UsageData from './components/UsageData.jsx';

import { useVerifyLicenseKeyMutation, useDeactiveLicenseKeyMutation, useSaveMediaSettingsMutation } from '../redux/api/media-settings.js';
import { updateMediaSetting } from '../redux/slice/media-settings.js';

const GeneralSettings = ( {
	licenseKey,
	setLicenseKey,
	verifyLicenseFromUrl,
} ) => {
	const [ notice, setNotice ] = useState( {
		message: '',
		status: 'success',
		isVisible: false,
	} );

	const mediaSettings = useSelector( ( state ) => state.mediaSettings );
	const dispatch = useDispatch();

	const [ saveMediaSettings ] = useSaveMediaSettingsMutation();

	const [ verifyLicense, { isLoading: isLicenseKeyLoading } ] = useVerifyLicenseKeyMutation();
	const [ deactiveLicense, { isLoading: isDeactivateLoading } ] = useDeactiveLicenseKeyMutation();

	const GODAM_API_BASE = 'https://app.godam.io';

	const handleMediaFolderOrganization = async ( value ) => {
		const updatedSettings = {
			...mediaSettings,
			general: {
				...mediaSettings.general,
				disable_folder_organization: value,
			},
		};

		try {
			await saveMediaSettings( { settings: updatedSettings } ).unwrap();

			setNotice( {
				message: 'Settings saved successfully!',
				status: 'success',
				isVisible: true,
			} );

			dispatch( updateMediaSetting(
				{
					category: 'general',
					key: 'disable_folder_organization',
					value,
				},
			) );
		} catch ( e ) {
			setNotice( {
				message: 'An error occurred while saving the settings',
				status: 'error',
				isVisible: true,
			} );
		}
	};

	const saveLicenseKey = async () => {
		if ( ! licenseKey.trim() ) {
			setNotice( {
				message: 'Please enter a valid license key',
				status: 'error',
				isVisible: true,
			} );
			return;
		}

		try {
			const result = await verifyLicense( licenseKey ).unwrap();

			setNotice( {
				message: result.message || 'License key verified successfully!',
				status: 'success',
				isVisible: true,
			} );

			const updatedSettings = {
				...mediaSettings,
				general: {
					...mediaSettings.general,
					is_verified: true,
				},
			};

			await saveMediaSettings( updatedSettings );

			// Reload the page to reflect the changes
			window.location.reload();
		} catch ( e ) {
			if ( e?.status === 400 ) {
				setNotice( {
					message: e.data.message || 'Failed to verify license key. Please try again',
					status: 'error',
					isVisible: true,
				} );
			} else {
				setNotice( {
					message: 'An error occurred while verifying the license key',
					status: 'error',
					isVisible: true,
				} );
			}
		}

		window.scrollTo( { top: 0, behavior: 'smooth' } );

		// Auto hide the notice after 5 seconds
		setTimeout( () => {
			setNotice( { ...notice, isVisible: false } );
		}, 5000 );
	};

	const deactivateLicenseKey = async () => {
		try {
			await deactiveLicense().unwrap();

			setLicenseKey( '' );
			setNotice( {
				message: 'License key deactivated successfully',
				status: 'success',
				isVisible: true,
			} );

			const updatedSettings = {
				...mediaSettings,
				general: {
					...mediaSettings.general,
					is_verified: false,
				},
			};

			saveMediaSettings( updatedSettings );
		} catch ( e ) {
			setNotice( {
				message: 'An error occurred while deactivating the license key',
				status: 'error',
				isVisible: true,
			} );
		}

		window.userData.valid_license = false; // Set the flag to true.
		window.userData.user_data = {}; // Set the flag to true.

		window.scrollTo( { top: 0, behavior: 'smooth' } );

		// Hide the notice after 5 seconds
		setTimeout( () => {
			setNotice( { ...notice, isVisible: false } );
		}, 5000 );
	};

	useEffect( () => {
		// Trigger verification if the flag is true
		if ( verifyLicenseFromUrl && licenseKey ) {
			saveLicenseKey(); // Use the existing saveLicenseKey function
		}
	}, [ verifyLicenseFromUrl, licenseKey ] );

	return (
		<div>
			{ notice?.isVisible && (
				<Notice
					className="mb-4"
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
				>
					{ notice.message }
				</Notice>
			) }

			<Panel header={ __( 'License Settings', 'godam' ) } className="godam-panel">
				<PanelBody opened={ true } className="flex gap-8">
					<div className="flex flex-col gap-2 b-4">
						<TextControl
							className="godam-input"
							label={ __( 'License Key', 'godam' ) }
							value={ licenseKey }
							onChange={ ( value ) => setLicenseKey( value ) }
							help={
								<>
									{ ! window?.userData?.valid_license && (
										<>
											{ __(
												'Your license key is required to access the features. You can get your active license key from your ',
												'godam',
											) }
											<a
												href={ GODAM_API_BASE + '/#licenses' }
												target="_blank"
												rel="noopener noreferrer"
												className="text-blue-500 underline"
											>
												{ __( 'Account', 'godam' ) }
											</a>
											.
										</>
									) }
								</>
							}
							placeholder="Enter your license key here"
							disabled={ window?.userData?.valid_license }
						/>
						<div className="flex gap-2">
							<Button
								className="godam-button"
								onClick={ saveLicenseKey }
								disabled={
									isLicenseKeyLoading || window?.userData?.valid_license
								}
								variant="primary"
								isBusy={ isLicenseKeyLoading }
							>
								{ __( 'Save License Key', 'godam' ) }
							</Button>
							<Button
								className="godam-button"
								onClick={ deactivateLicenseKey }
								disabled={
									isLicenseKeyLoading || ! window?.userData?.valid_license
								}
								variant="secondary"
								isDestructive
								isBusy={ isDeactivateLoading }
							>
								{ __( 'Remove License Key', 'godam' ) }
							</Button>
						</div>
					</div>

					<UsageData />
				</PanelBody>
			</Panel>

			{ ! window?.userData?.valid_license && <PricingPlan /> }

			<Panel header={ __( 'General Settings', 'godam' ) } className="godam-panel">
				<PanelBody opened={ true }>
					<div className="flex flex-col gap-4">
						<ToggleControl
							__nextHasNoMarginBottom
							className="godam-toggle"
							label={ __(
								'Disable Folder Organization in Media Library',
								'godam',
							) }
							help={ __(
								'Enable this option to disable folder organization in the media library.',
								'godam',
							) }
							checked={
								mediaSettings?.general?.disable_folder_organization || false
							}
							onChange={ handleMediaFolderOrganization }
						/>
					</div>
				</PanelBody>
			</Panel>
		</div>
	);
};

export default GeneralSettings;
