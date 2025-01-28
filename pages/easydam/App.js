/**
 * External dependencies
 */
import ReactDOM from 'react-dom';

/**
 * Internal dependencies
 */
import GeneralSettings from './GeneralSettings';
import VideoSettings from './VideoSettings';
import ImageSettings from './ImageSettings';
import StorageSettings from './storage-settings/index';

/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { useDispatch, useSelector } from 'react-redux';
import { setLoading } from './redux/slice/storage';
import { __ } from '@wordpress/i18n';
import { cog, video, image, help } from '@wordpress/icons';
import { Button, Icon, Panel, PanelBody } from '@wordpress/components';

const App = () => {
	const [ activeTab, setActiveTab ] = useState( 'general-settings' );
	const [ isPremiumUser, setIsPremiumUser ] = useState( true ); // Should be initially set to false.
	const [ mediaSettings, setMediaSettings ] = useState( null );
	const [ licenseKey, setLicenseKey ] = useState( '' );
	const [ isVerified, setIsVerified ] = useState( false ); // Tracks if the license is verified.
	const [ verifyLicenseFromUrl, setVerifyLicenseFromUrl ] = useState( false );

	const dispatch = useDispatch();

	const tabs = [
		{
			id: 'general-settings',
			label: 'General Settings',
			component: GeneralSettings,
			icon: cog,
		},
		{
			id: 'video-settings',
			label: 'Video settings',
			component: VideoSettings,
			icon: video,
		},
		{
			id: 'image-settings',
			label: 'Image settings',
			component: ImageSettings,
			icon: image,
		},
		// {
		// 	id: 'storage-settings', // Disable this tab for now
		// 	label: 'Storage settings',
		// 	component: StorageSettings,
		// },
	];

	const helpLink = 'https://godam.io/';
	const upgradePlanLink = 'https://godam.io/';

	useEffect( () => {
		const fetchSettings = async () => {
			dispatch( setLoading( true ) );
			try {
				const settingsResponse = await fetch( '/wp-json/easydam/v1/settings/easydam-settings', {
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.wpApiSettings.nonce,
					},
				} );
				const licenseResponse = await fetch( '/wp-json/easydam/v1/settings/get-license-key', {
					method: 'GET',
					headers: {
						'X-WP-Nonce': window.wpApiSettings.nonce,
					},
				} );

				const settingsData = await settingsResponse.json();
				const licenseData = await licenseResponse.json();

				let licenseFromUrl = '';
				const urlParams = new URLSearchParams( window.location.search );
				if ( urlParams.has( 'license_key' ) ) {
					licenseFromUrl = urlParams.get( 'license_key' );
				}

				if ( ! licenseData.license_key && licenseFromUrl ) {
					// Set license key from URL and trigger verification in GeneralSettings
					setLicenseKey( licenseFromUrl );
					settingsData.general.is_verified = false; // Mark as not verified initially
					setVerifyLicenseFromUrl( true ); // Pass this flag to GeneralSettings
				} else {
					setLicenseKey( licenseData.license_key || '' );
					settingsData.general.is_verified = licenseData.license_key ? true : false;
				}

				setMediaSettings( settingsData );
				setIsVerified( settingsData?.general?.is_verified || false );
			} catch ( error ) {
				console.error( 'Failed to fetch data:', error );
			} finally {
				dispatch( setLoading( false ) ); // Set loading to false
			}
		};

		fetchSettings();
	}, [ dispatch ] );

	const saveMediaSettings = async ( updatedSettings ) => {
		try {
			const response = await fetch( '/wp-json/easydam/v1/settings/easydam-settings', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
				body: JSON.stringify( { settings: updatedSettings } ),
			} );

			const result = await response.json();
			if ( result.status === 'success' ) {
				setMediaSettings( updatedSettings ); // Update local state
				setIsVerified( updatedSettings?.general?.is_verified );
				return true;
			}
			console.error( result.message );
			return false;
		} catch ( error ) {
			console.error( 'Failed to save media settings:', error );
		}
	};

	return (
		<div id="easydam-settings">
			<header>
				<div className="easydam-settings-header border-b -ml-[32px] pl-[32px]">
					<div className="max-w-[1200px] mx-auto px-4 flex items-center justify-between">
						<h1 className="py-6 m-0 text-4xl leading-4 font-semibold text-slate-900 flex items-center">
							{ __( 'GoDAM', 'transcoder' ) }
							<div className="ml-2">
								<div className="text-xs font-normal leading-4">1.0.3</div>
								<div className="text-xs font-bold py-[2px] px-2 rounded bg-indigo-100 mt-1">Pro</div>
							</div>
						</h1>
						<div className="flex items-center">
							<Button
								variant="tertiary"
								// size="compact"
								href={ helpLink }
								target="_blank"
								className="rounded-full"
								label={ __( 'Need help?', 'transcoder' ) }
								icon={ help }
							/>
							<Button
								className="ml-2"
								variant="primary"
								size="compact"
								href={ upgradePlanLink }
								target="_blank"
								text={ __( 'Upgrade plan', 'transcoder' ) }
							/>
						</div>
					</div>
				</div>
			</header>
			<div className="wrap flex gap-4 my-8 max-w-[1200px] px-4 mx-auto">
				<div className="max-w-[220px] w-full">
					<nav className="sticky-navbar pt-8 -mt-8">
						{
							tabs.map( ( tab ) => (
								<a
									key={ tab.id }
									href={ `#${ tab.id }` }
									className={ `sidebar-nav-item ${ activeTab === tab.id ? 'active' : '' } ${
										tab.id !== 'general-settings' && ! isVerified ? 'opacity-50 pointer-events-none' : ''
									}` }
									onClick={ () => {
										setActiveTab( tab.id );
									} }
								>
									<Icon icon={ tab.icon } />
									{ tab.label }
								</a>
							) )
						}
					</nav>
				</div>
				<div id="main-content" className="w-full">
					<div className="flex gap-5">
						<div className="w-full">
							{
								tabs.map( ( tab ) => (
									activeTab === tab.id &&
									<tab.component
										key={ tab.id }
										isPremiumUser={ isPremiumUser }
										mediaSettings={ mediaSettings }
										saveMediaSettings={ saveMediaSettings }
										licenseKey={ licenseKey }
										setLicenseKey={ setLicenseKey }
										verifyLicenseFromUrl={ verifyLicenseFromUrl }
									/>
								) )
							}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default App;
