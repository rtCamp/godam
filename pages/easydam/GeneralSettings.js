/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { TextControl, ToggleControl, Spinner, Button, Notice } from '@wordpress/components';

const GeneralSettings = ( { mediaSettings, saveMediaSettings } ) => {
	const [ licenseKey, setLicenseKey ] = useState( '' );
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );
	const [ isLicenseKeyLoading, setIsLicenseKeyLoading ] = useState( false ); // Loading indicator for saving license key.

	const [ trackStatusOnUserProfile, setTrackStatusOnUserProfile ] = useState( mediaSettings?.general?.track_status || false );

	useEffect( () => {
		if ( mediaSettings?.general?.track_status !== undefined ) {
			setTrackStatusOnUserProfile( mediaSettings.general.track_status );
		}
	}, [ mediaSettings ] );

	// Fetch the saved license key on component mount.
	useEffect( () => {
		const fetchLicenseKey = async () => {
			try {
				const response = await fetch( '/wp-json/transcoder/v1/get-license-key', {
					method: 'GET',
					headers: {
						'X-WP-Nonce': window.wpApiSettings.nonce,
					},
				} );

				if ( response.ok ) {
					const result = await response.json();
					setLicenseKey( result.license_key || '' );
				}
			} catch ( error ) {
				console.error( 'Failed to fetch the license key.', error );
			}
		};

		fetchLicenseKey();
	}, [ ] );

	const saveLicenseKey = async () => {
		if ( ! licenseKey.trim() ) {
			setNotice( { message: 'Please enter a valid license key.', status: 'error', isVisible: true } );
			return;
		}

		setIsLicenseKeyLoading( true ); // Show loading indicator.

		try {
			const response = await fetch( '/wp-json/transcoder/v1/verify-license', {
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
				/>
				<Button
					className="max-w-[140px] w-full flex justify-center items-center"
					onClick={ saveLicenseKey }
					disabled={ isLicenseKeyLoading }
					variant="primary"
				>
					{ isLicenseKeyLoading ? <Spinner /> : 'Save License Key' }
				</Button>
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
				/>
				<div className="text-slate-500">
					If enabled, It will display check status button to know the status of the transcoding process at the client side if that user has administrator rights.
				</div>
			</div>

			<Button
				className="max-w-[140px] w-full flex justify-center items-center"
				onClick={ saveGeneralSettings }
				variant="primary"
			>
				Save Settings
			</Button>
		</div>
	);
};

export default GeneralSettings;
