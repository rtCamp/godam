/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { TextControl, Button, Notice } from '@wordpress/components';
/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

const GeneralSettings = ( { mediaSettings, saveMediaSettings, licenseKey, setLicenseKey } ) => {
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );
	const [ isLicenseKeyLoading, setIsLicenseKeyLoading ] = useState( false ); // Loading indicator for saving license key.
	const [ isDeactivateLoading, setIsDeactivateLoading ] = useState( false );
	const loading = useSelector( ( state ) => state.storage.loading );
	const [ trackStatusOnUserProfile, setTrackStatusOnUserProfile ] = useState( mediaSettings?.general?.track_status || false );

	useEffect( () => {
		if ( mediaSettings?.general?.track_status !== undefined ) {
			setTrackStatusOnUserProfile( mediaSettings.general.track_status );
		}
	}, [ mediaSettings ] );

	const saveLicenseKey = async () => {
		if ( ! licenseKey.trim() ) {
			setNotice( { message: 'Please enter a valid license key', status: 'error', isVisible: true } );
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
				setNotice( { message: result.message || 'Failed to verify the license key', status: 'error', isVisible: true } );
			}
		} catch ( error ) {
			setNotice( { message: 'An error occurred. Please try again later', status: 'error', isVisible: true } );
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
		setIsDeactivateLoading( true );

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
				setNotice( { message: 'License key deactivated successfully', status: 'success', isVisible: true } );
				const updatedSettings = {
					...mediaSettings,
					general: {
						...mediaSettings.general,
						is_verified: false,
					},
				};

				saveMediaSettings( updatedSettings );
			} else {
				setNotice( { message: 'Failed to deactivate license key. Please try again', status: 'error', isVisible: true } );
			}
		} catch ( error ) {
			setNotice( { message: 'An error occurred while deactivating the license key', status: 'error', isVisible: true } );
		} finally {
			setIsDeactivateLoading( false );
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
				...mediaSettings.general,
				track_status: trackStatusOnUserProfile,
			},
		};

		const isSaved = await saveMediaSettings( updatedSettings );

		if ( isSaved ) {
			setNotice( { message: 'Settings saved successfully!', status: 'success', isVisible: true } );
		} else {
			setNotice( { message: 'Failed to save settings. Please try again', status: 'error', isVisible: true } );
		}

		window.scrollTo( { top: 0, behavior: 'smooth' } );

		// Hide the notice after 5 seconds
		setTimeout( () => {
			setNotice( { ...notice, isVisible: false } );
		}, 5000 );
	};

	if ( loading ) {
		// Skeleton loader when data is loading
		return (
			<div id="main-content" className="w-full p-5 bg-white">
				<div className="loading-skeleton flex flex-col gap-4">
					<div className="skeleton-container skeleton-container-short">
						<div className="skeleton-header w-1/2"></div>
					</div>
					<div className="skeleton-container">
						<div className="skeleton-line w-3/4"></div>
						<div className="skeleton-line short w-1/2"></div>
					</div>
					<div className="flex gap-2">
						<div className="skeleton-button w-32 h-10"></div>
						<div className="skeleton-button w-40 h-10"></div>
					</div>
				</div>
			</div>
		);
	}

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
					help={
						<>
							Your license key is required to access the features.
							You can get your active license key from your { ' ' }
							<a
								href="https://example.com/subscriptions"
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-500 underline"
							>
								Account
							</a>.
						</>
					}
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
						isBusy={ isLicenseKeyLoading }
					>
						Save License Key
					</Button>
					<Button
						className="max-w-[160px] w-full flex justify-center items-center"
						onClick={ deactivateLicenseKey }
						disabled={ isLicenseKeyLoading || ! mediaSettings?.general?.is_verified } // Disable if no license key is present
						variant="secondary"
						isDestructive
						isBusy={ isDeactivateLoading }
					>
						Remove License Key
					</Button>
				</div>
			</div>

			{ /* <hr />

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
			</Button> */ }

			{
				! mediaSettings?.general?.is_verified && (
					<div className="subscription-plans">
						<h2 className="py-2 border-b text-xl font-bold">Subscription Plans</h2>
						<p className="mb-4">
							To enable transcoding, you will need to subscribe to one of the following plans after
							downloading Transcoder. We encourage you to explore the service with the free subscription
							plan.
						</p>
						<div className="flex gap-4">
							<div className="plan free-plan p-4 border rounded shadow">
								<h3 className="text-lg font-bold">Free Plan</h3>
								<p>$0 Per month</p>
								<ul className="list-disc list-inside text-sm">
									<li>100MB upload file size limit</li>
									<li>5GB bandwidth (per month)</li>
									<li>Overage not allowed</li>
									<li>rtAmazon S3 support</li>
									<li>No HD Profiling</li>
								</ul>
								<Button className="mt-4 w-full" variant="primary">
									Try Now
								</Button>
							</div>
							<div className="plan silver-plan p-4 border rounded shadow">
								<h3 className="text-lg font-bold">Silver Plan</h3>
								<p>$9 Per Month</p>
								<ul className="list-disc list-inside text-sm">
									<li>16GB upload file size limit</li>
									<li>100GB bandwidth (per month)</li>
									<li>Overage not currently charged</li>
									<li>rtAmazon S3 support</li>
									<li>HD Profiling coming soon</li>
								</ul>
								<Button className="mt-4 w-full" variant="secondary">
									Subscribe
								</Button>
							</div>
						</div>
						<hr className="my-4" />
					</div>
				)
			}
		</div>
	);
};

export default GeneralSettings;
