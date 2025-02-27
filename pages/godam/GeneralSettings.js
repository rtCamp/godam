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

/* global userData */

const GeneralSettings = ( { mediaSettings, saveMediaSettings, licenseKey, setLicenseKey, verifyLicenseFromUrl } ) => {
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );
	const [ isLicenseKeyLoading, setIsLicenseKeyLoading ] = useState( false ); // Loading indicator for saving license key.
	const [ isDeactivateLoading, setIsDeactivateLoading ] = useState( false );
	const loading = useSelector( ( state ) => state.storage.loading );
	const [ trackStatusOnUserProfile, setTrackStatusOnUserProfile ] = useState( mediaSettings?.general?.track_status || false );
	const [ plans, setPlans ] = useState( [] );

	const GODAM_API_BASE = 'https://app.godam.io';

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
					'/wp-json/godam/v1/settings/subscription-plans',
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

		let result = {};

		try {
			const response = await fetch( '/wp-json/godam/v1/settings/verify-license', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
				body: JSON.stringify( { license_key: licenseKey } ),
			} );

			result = await response.json();

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

				// Reload the page to reflect the changes
				window.location.reload();
			} else {
				setNotice( { message: result.message || 'Failed to verify the license key', status: 'error', isVisible: true } );
				window.userData.valid_license = false;
				window.userData.user_data = {};
			}
		} catch ( error ) {
			setNotice( { message: 'An error occurred. Please try again later', status: 'error', isVisible: true } );
			window.userData.valid_license = false;
			window.userData.user_data = {};
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
			const response = await fetch( '/wp-json/godam/v1/settings/deactivate-license', {
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
			// reload the page.
			window.userData.valid_license = false; // Set the flag to true.
			window.userData.user_data = {}; // Set the flag to true.
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

	const calculatePercentage = ( used, total ) => {
		if ( total === 0 ) {
			return 0;
		}
		try {
			const result = ( used / total ) * 100;
			return result.toFixed( 2 );
		} catch ( error ) {
			console.error( 'Error calculating percentage:', error );
			return 0;
		}
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

			{ notice?.isVisible && (
				<Notice
					className="mb-2"
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
				>
					{ notice.message }
				</Notice>
			) }
			<div className="flex flex-col lg:flex-row gap-4 items-start mb-4">
				<Panel header={ __( 'Settings Overview', 'godam' ) } className="w-full">
					<PanelBody
						opened={ true }
						className="flex gap-8"
					>
						<div className="flex flex-col gap-2 b-4m">
							<TextControl
								label={ __( 'License Key', 'godam' ) }
								value={ licenseKey }
								onChange={ ( value ) => setLicenseKey( value ) }
								help={
									<>
										{
											( ! window?.userData?.valid_license ) &&
											<>
												{ __( 'Your license key is required to access the features. You can get your active license key from your ', 'godam' ) }
												<a
													href={ GODAM_API_BASE + '/#licenses' }
													target="_blank"
													rel="noopener noreferrer"
													className="text-blue-500 underline"
												>
													{ __( 'Account', 'godam' ) }
												</a>.
											</>
										}
									</>
								}
								placeholder="Enter your license key here"
								className={ `max-w-[400px] ${ ( ! window?.userData?.valid_license && window?.userData?.user_data?.license_key ) ? 'invalid-license-key' : '' }` }
								disabled={ window?.userData?.valid_license }
							/>
							<div className="flex gap-2">
								<Button
									className="max-w-[140px] w-full flex justify-center items-center"
									onClick={ saveLicenseKey }
									disabled={ isLicenseKeyLoading || window?.userData?.valid_license }
									variant="primary"
									isBusy={ isLicenseKeyLoading }
								>
									{ __( 'Save License Key', 'godam' ) }
								</Button>
								<Button
									className="max-w-[160px] w-full flex justify-center items-center"
									onClick={ deactivateLicenseKey }
									disabled={ isLicenseKeyLoading || ! window?.userData?.valid_license }
									variant="secondary"
									isDestructive
									isBusy={ isDeactivateLoading }
								>
									{ __( 'Remove License Key', 'godam' ) }
								</Button>
							</div>
						</div>
						{
							( mediaSettings?.general?.is_verified && window?.userData?.valid_license ) && (
								<div className="flex gap-4 flex-wrap">

									{
										userData.storageBandwidthError ? (
											<p className="text-yellow-700 text-xs h-max">{ userData.storageBandwidthError }</p>
										) : (
											<>
												<div className="flex gap-3 items-center">
													<div className="circle-container">
														<div className="data text-xs">{ calculatePercentage( userData.bandwidth_used, userData.total_bandwidth ) }%</div>
														<div
															className={ `circle ${
																calculatePercentage( userData.bandwidth_used, userData.total_bandwidth ) > 90 ? 'red' : ''
															}` }
															style={ { '--percentage': calculatePercentage( userData.bandwidth_used, userData.total_bandwidth ) + '%' } }
														></div>
													</div>
													<div className="leading-6">
														<div className="easydam-settings-label text-base">{ __( 'BANDWIDTH', 'godam' ) }</div>
														<strong>{ __( 'Available: ', 'godam' ) }</strong>{ parseFloat( userData.total_bandwidth - userData.bandwidth_used ).toFixed( 2 ) }{ __( 'GB', 'godam' ) }
														<br />
														<strong>{ __( 'Used: ', 'godam' ) }</strong>{ parseFloat( userData.bandwidth_used ).toFixed( 2 ) }{ __( 'GB', 'godam' ) }
													</div>
												</div>
												<div className="flex gap-3 items-center">
													<div className="circle-container">
														<div className="data text-xs">{ calculatePercentage( userData.storage_used, userData.total_storage ) }%</div>
														<div
															className={ `circle ${
																calculatePercentage( userData.storage_used, userData.total_storage ) > 90 ? 'red' : ''
															}` }
															style={ { '--percentage': calculatePercentage( userData.storage_used, userData.total_storage ) + '%' } }
														></div>
													</div>
													<div className="leading-6">
														<div className="easydam-settings-label text-base">{ __( 'STORAGE', 'godam' ) }</div>
														<strong>{ __( 'Available: ', 'godam' ) }</strong>{ parseFloat( userData.total_storage - userData.storage_used ).toFixed( 2 ) }{ __( 'GB', 'godam' ) }
														<br />
														<strong>{ __( 'Used: ', 'godam' ) }</strong>{ parseFloat( userData.storage_used ).toFixed( 2 ) }{ __( 'GB', 'godam' ) }
													</div>
												</div>
											</>
										)
									}
								</div>
							) }
					</PanelBody>
				</Panel>
			</div>

			{ ! window?.userData?.valid_license && (
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
											href={ `${ GODAM_API_BASE }/subscription/account-creation?plan_name=${ encodeURIComponent( plan.name ) }&ref=${ encodeURIComponent( window.location.href ) }` }
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

		</div>
	);
};

export default GeneralSettings;
