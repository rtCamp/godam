/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { TextControl, Button, Notice, Panel, PanelBody } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

const GeneralSettings = ( { mediaSettings, saveMediaSettings, licenseKey, setLicenseKey, verifyLicenseFromUrl } ) => {
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );
	const [ isLicenseKeyLoading, setIsLicenseKeyLoading ] = useState( false ); // Loading indicator for saving license key.
	const [ isDeactivateLoading, setIsDeactivateLoading ] = useState( false );
	const loading = useSelector( ( state ) => state.storage.loading );
	const [ trackStatusOnUserProfile, setTrackStatusOnUserProfile ] = useState( mediaSettings?.general?.track_status || false );
	const [ plans, setPlans ] = useState( [] );

	useEffect( () => {
		if ( mediaSettings?.general?.track_status !== undefined ) {
			setTrackStatusOnUserProfile( mediaSettings.general.track_status );
		}
	}, [ mediaSettings ] );

	useEffect( () => {
		// Trigger verification if the flag is true
		if ( verifyLicenseFromUrl && licenseKey ) {
			saveLicenseKey(); // Use the existing saveLicenseKey function
		}
	}, [ verifyLicenseFromUrl, licenseKey ] );

	useEffect( () => {
		const fetchPlans = async () => {
			try {
				const response = await fetch(
					'/wp-json/easydam/v1/settings/subscription-plans',
					{
						method: 'GET',
						headers: {
							'Content-Type': 'application/json',
						},
					},
				);
				const result = await response.json();

				if ( response.ok ) {
					const sortedPlans = result.data.sort( ( a, b ) => a.cost - b.cost );
					setPlans( sortedPlans );
				} else {
					console.error( 'Failed to fetch subscription plans:', result.message );
				}
			} catch ( error ) {
				console.error( 'Error fetching subscription plans:', error );
			}
		};

		fetchPlans();
	}, [] );

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
			<Panel
				header={ __( 'General Settings', 'godam' ) }
				className="mb-4"
			>
				<PanelBody
					opened={ true }
				>
					{ notice?.isVisible && (
						<Notice
							className="mb-2"
							status={ notice.status }
							onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
						>
							{ notice.message }
						</Notice>
					) }
					<div className="flex flex-col gap-2">
						<TextControl
							label={ __( 'License Key', 'godam' ) }
							value={ licenseKey }
							onChange={ ( value ) => setLicenseKey( value ) }
							help={
								<>
									{ __( 'Your license key is required to access the features. You can get your active license key from your ', 'godam' ) }
									<a
										href="https://frappe-transcoder-api.rt.gw/"
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-500 underline"
									>
										{ __( 'Account', 'godam' ) }
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
								{ __( 'Save License Key', 'godam' ) }
							</Button>
							<Button
								className="max-w-[160px] w-full flex justify-center items-center"
								onClick={ deactivateLicenseKey }
								disabled={ isLicenseKeyLoading || ! mediaSettings?.general?.is_verified } // Disable if no license key is present
								variant="secondary"
								isDestructive
								isBusy={ isDeactivateLoading }
							>
								{ __( 'Remove License Key', 'godam' ) }
							</Button>
						</div>
					</div>
				</PanelBody>
			</Panel>

			{ /* <div className="py-3 flex flex-col gap-2">
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

			{ ! mediaSettings?.general?.is_verified && (
				<Panel
					header={ __( 'General Settings', 'godam' ) }
				>
					<PanelBody
						opened={ true }
					>
						<div className="subscription-plans">

							<p className="mb-4 mt-0">
								{ __( 'To enable transcoding, you will need to subscribe to one of the following plans after downloading GoDAM. We encourage you to explore the service with the free subscription plan.', 'godam' ) }
							</p>

							<div className="flex gap-4 overflow-x-auto pb-4">
								{ plans.map( ( plan ) => (
									<div
										key={ plan.name }
										className="plan w-[25%] flex-shrink-0 border px-6 rounded-lg shadow-sm bg-white transition-transform transform hover:shadow-lg flex flex-col justify-center items-center gap-2"
									>
										<div className="text-center">
											<h3 className="text-lg font-bold text-gray-800 pt-5 mb-0">{ plan.name } { __( 'Plan', 'godam' ) }</h3>
										</div>
										<p className="text-xl font-semibold text-gray-800 my-1 text-center">
											${ plan.cost } <span className="text-sm text-gray-500">{ __( 'Per', 'godam' ) } { plan.billing_interval }</span>
										</p>
										<ul className="text-xs text-gray-600 my-2 text-center">
											<li>{ plan.bandwidth }{ __( 'GB bandwidth', 'godam' ) }</li>
											<li>{ plan.storage }{ __( 'GB storage', 'godam' ) }</li>
											<li>{ __( 'High-quality transcoding', 'godam' ) }</li>
											<li>{ __( 'Access to advanced analytics', 'godam' ) }</li>
										</ul>
										<Button
											className="mb-5"
											variant="primary"
											href={ `https://frappe-transcoder-api.rt.gw/subscription/account-creation?plan_name=${ encodeURIComponent( plan.name ) }` }
											target="_blank"
											rel="noopener noreferrer"
										>
											{ __( 'Subscribe', 'godam' ) }
										</Button>
									</div>
								) ) }
							</div>
						</div>
					</PanelBody>
				</Panel>

			) }

			{ mediaSettings?.general?.is_verified && (
				<>
					<Panel
						header={ __( 'Quick overview', 'godam' ) }
					>
						<PanelBody
							opened={ true }
						>

						</PanelBody>
					</Panel>
				</>
			) }
		</div>
	);
};

export default GeneralSettings;
