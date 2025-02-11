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

import godamLogo from '../../assets/src/images/godam-logo.png';

const App = () => {
	const [ activeTab, setActiveTab ] = useState( 'general-settings' );
	const [ isPremiumUser, setIsPremiumUser ] = useState( true ); // Should be initially set to false.
	const [ mediaSettings, setMediaSettings ] = useState( null );
	const [ licenseKey, setLicenseKey ] = useState( '' );
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
	const upgradePlanLink = 'https://app.godam.io/';

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

				const settingsData = await settingsResponse.json();

				let licenseFromUrl = '';
				const urlParams = new URLSearchParams( window.location.search );
				if ( urlParams.has( 'license_key' ) ) {
					licenseFromUrl = urlParams.get( 'license_key' );
				}

				if ( ! window.userData.valid_license && licenseFromUrl ) {
					// Set license key from URL and trigger verification in GeneralSettings
					setLicenseKey( licenseFromUrl );
					setVerifyLicenseFromUrl( true ); // Pass this flag to GeneralSettings
				} else {
					setLicenseKey( window?.userData?.user_data?.license_key || '' );
				}

				setMediaSettings( settingsData );
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
					<div className="max-w-[1260px] mx-auto pl-4 pr-9 flex items-center justify-between">
						<h1 className="py-6 m-0 text-4xl leading-4 font-semibold text-slate-900 flex items-end">
							<img className="h-12" src={ godamLogo } alt="GoDAM" />
							<div className="ml-3">
								<div className="text-xs font-normal leading-4">1.0.3</div>
								{
									window?.userData?.user_data?.active_plan &&
										<div className="text-xs font-bold py-[2px] px-2 rounded bg-indigo-100 mt-1">{ window?.userData?.user_data?.active_plan }</div>
								}
							</div>
						</h1>
						<div className="flex items-center">
							<Button
								variant="tertiary"
								href={ helpLink }
								target="_blank"
								className="rounded-full"
								label={ __( 'Need help?', 'godam' ) }
								icon={ help }
							/>
							{
								( window?.userData?.valid_license && window?.userData?.user_data?.active_plan ) &&
								<Button
									className="ml-2"
									variant="primary"
									size="compact"
									href={ upgradePlanLink }
									target="_blank"
									text={ __( 'Upgrade plan', 'godam' ) }
								/>
							}
						</div>
					</div>
				</div>
			</header>
			<div className="wrap flex gap-4 my-8 max-w-[1260px] pl-4 pr-9 mx-auto">
				<div className="max-w-[220px] w-full">
					<nav className="sticky-navbar pt-8 -mt-8">
						{
							tabs.map( ( tab ) => (
								<a
									key={ tab.id }
									href={ `#${ tab.id }` }
									className={ `sidebar-nav-item ${ activeTab === tab.id ? 'active' : '' } ${
										tab.id !== 'general-settings' && ! window.userData.valid_license ? 'opacity-50 pointer-events-none' : ''
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
