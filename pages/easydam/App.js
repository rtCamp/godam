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
import { cog, video, image, trendingUp } from '@wordpress/icons';
import { Button, Icon, Panel, PanelBody } from '@wordpress/components';

const App = () => {
	const [ activeTab, setActiveTab ] = useState( 'general-settings' );
	const [ isPremiumUser, setIsPremiumUser ] = useState( true ); // Should be initially set to false.
	const [ mediaSettings, setMediaSettings ] = useState( null );
	const [ licenseKey, setLicenseKey ] = useState( '' );
	const [ isVerified, setIsVerified ] = useState( false ); // Tracks if the license is verified.

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
		}
		// {
		// 	id: 'storage-settings', // Disable this tab for now
		// 	label: 'Storage settings',
		// 	component: StorageSettings,
		// },
	];

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

				if ( ! licenseData.license_key ) {
					settingsData.general.is_verified = false;
				}

				setMediaSettings( settingsData );
				setLicenseKey( licenseData.license_key || '' ); // Save the license key
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
		<>
			<header>
				<div className="easydam-settings-header border-b -ml-[32px] pl-[32px]">
					<div className="max-w-[1200px] mx-auto px-4 flex items-center justify-between">
						<h1 className="py-6 m-0 font-semibold text-slate-900 flex items-start">
							{ __( 'GoDAM', 'transcoder' ) }
							<spa className="text-sm font-normal ml-1">1.0.3</spa>
						</h1>
						<div>
							<Button
								variant="primary"
								size="compact"
								href="https://godam.io/"
								target="_blank"
								text={ __( 'Need help?', 'transcoder' ) }
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
									className={ `flex items-center gap-2 p-2 font-medium rounded-md text-slate-700 hover:text-slate-900 border border-transparent transition-all ${ activeTab === tab.id ? 'border bg-white font-semibold focus:ring-2 text-slate-900 drop-shadow' : '' } ${
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
									/>
								) )
							}
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default App;
