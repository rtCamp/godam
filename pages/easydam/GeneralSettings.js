/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { TextControl, ToggleControl, Spinner, Button, Notice } from '@wordpress/components';

const GeneralSettings = ( { mediaSettings, saveMediaSettings, licenseKey, setLicenseKey } ) => {
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );
	const [ isLicenseKeyLoading, setIsLicenseKeyLoading ] = useState( false ); // Loading indicator for saving license key.

	const [ trackStatusOnUserProfile, setTrackStatusOnUserProfile ] = useState( mediaSettings?.general?.track_status || false );

	useEffect( () => {
		if ( mediaSettings?.general?.track_status !== undefined ) {
			setTrackStatusOnUserProfile( mediaSettings.general.track_status );
		}
	}, [ mediaSettings ] );

	const saveLicenseKey = async () => {
		if ( ! licenseKey.trim() ) {
			setNotice( { message: 'Please enter a valid license key.', status: 'error', isVisible: true } );
			return;
		}

		setIsLicenseKeyLoading( true );

		try {
			const response = await fetch( '/wp-json/easydam/v1/settings/verify-license', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
				body: JSON.stringify( { license_key: licenseKey } ),
			} );

			const result = await response.json();

			if ( response.ok ) {
				setNotice( { message: result.message || 'License key verified successfully!', status: 'success', isVisible: true } );
				const updatedSettings = {
					...mediaSettings,
					general: {
						...mediaSettings.general,
						is_verified: true,
					},
				};

				saveMediaSettings( updatedSettings );
			} else {
				setNotice( { message: result.message || 'Failed to verify the license key.', status: 'error', isVisible: true } );
			}
		} catch ( error ) {
			setNotice( { message: 'An error occurred. Please try again later.', status: 'error', isVisible: true } );
		} finally {
			setIsLicenseKeyLoading( false ); // Hide loading indicator.
		}

		window.scrollTo( { top: 0, behavior: 'smooth' } );

		// Hide the notice after 5 seconds
		setTimeout( () => {
			setNotice( { ...notice, isVisible: false } );
		}, 5000 );
	};

	const deactivateLicenseKey = async () => {
		setIsLicenseKeyLoading( true );

		try {
			const response = await fetch( '/wp-json/easydam/v1/settings/deactivate-license', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} );

			if ( response.ok ) {
				setLicenseKey( '' ); // Clear the license key from state.
				setNotice( { message: 'License key deactivated successfully.', status: 'success', isVisible: true } );
				const updatedSettings = {
					...mediaSettings,
					general: {
						...mediaSettings.general,
						is_verified: false,
					},
				};

				saveMediaSettings( updatedSettings );
			} else {
				setNotice( { message: 'Failed to deactivate license key. Please try again.', status: 'error', isVisible: true } );
			}
		} catch ( error ) {
			setNotice( { message: 'An error occurred while deactivating the license key.', status: 'error', isVisible: true } );
		} finally {
			setIsLicenseKeyLoading( false ); // Hide loading indicator.
		}

		window.scrollTo( { top: 0, behavior: 'smooth' } );

		// Hide the notice after 5 seconds
		setTimeout( () => {
			setNotice( { ...notice, isVisible: false } );
		}, 5000 );
	};

	const saveGeneralSettings = async () => {
		const updatedSettings = {
			...mediaSettings,
			general: {
				track_status: trackStatusOnUserProfile,
			},
		};

		const isSaved = await saveMediaSettings( updatedSettings );

		if ( isSaved ) {
			setNotice( { message: 'Settings saved successfully!', status: 'success', isVisible: true } );
		} else {
			setNotice( { message: 'Failed to save settings. Please try again.', status: 'error', isVisible: true } );
		}

		window.scrollTo( { top: 0, behavior: 'smooth' } );

		// Hide the notice after 5 seconds
		setTimeout( () => {
			setNotice( { ...notice, isVisible: false } );
		}, 5000 );
	};

	return (
		<div>
			<h2 className="py-2 border-b text-xl font-bold">General Settings</h2>
			{ notice?.isVisible && (
				<Notice
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
				>
					{ notice.message }
				</Notice>
			) }
			<div className="py-3 flex flex-col gap-2">
				<label className="block text-base font-semibold" htmlFor="license_key">
					License Key
				</label>
				<TextControl
					value={ licenseKey }
					onChange={ ( value ) => setLicenseKey( value ) }
					help="Your license key is required to access premium features."
					placeholder="Enter your license key here"
					className="max-w-[400px]"
					disabled={ mediaSettings?.general?.is_verified }
				/>
				<div className="flex gap-2">
					<Button
						className="max-w-[140px] w-full flex justify-center items-center"
						onClick={ saveLicenseKey }
						disabled={ isLicenseKeyLoading || mediaSettings?.general?.is_verified }
						variant="primary"
					>
						{ isLicenseKeyLoading ? <Spinner /> : 'Save License Key' }
					</Button>
					<Button
						className="max-w-[160px] w-full flex justify-center items-center"
						onClick={ deactivateLicenseKey }
						disabled={ isLicenseKeyLoading || ! mediaSettings?.general?.is_verified } // Disable if no license key is present
						variant="secondary"
						isDestructive
					>
						Deactivate License Key
					</Button>
				</div>
			</div>

			<hr />

			<div className="py-3 flex flex-col gap-2">
				<label className="block text-base font-semibold" htmlFor="track_status">
					Allow admin to track real-time transcoding status on user profile
				</label>
				<ToggleControl
					label="Display 'Check Status' button on user profiles"
					checked={ trackStatusOnUserProfile }
					onChange={ ( value ) => setTrackStatusOnUserProfile( value ) }
					disabled={ ! mediaSettings?.general?.is_verified }
				/>
				<div className="text-slate-500">
					If enabled, It will display check status button to know the status of the transcoding process at the client side if that user has administrator rights.
				</div>
			</div>

			<Button
				className="max-w-[140px] w-full flex justify-center items-center"
				onClick={ saveGeneralSettings }
				variant="primary"
				disabled={ ! mediaSettings?.general?.is_verified }
			>
				Save Settings
			</Button>
		</div>
	);
};

export default GeneralSettings;
