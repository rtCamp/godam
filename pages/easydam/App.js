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
		},
		{
			id: 'video-settings',
			label: 'Video settings',
			component: VideoSettings,
		},
		{
			id: 'image-settings',
			label: 'Image settings',
			component: ImageSettings,
		},
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
			<div className="wrap flex min-h-[80vh] gap-4 my-4">
				<div className="max-w-[220px] w-full rounded-lg bg-white">
					<nav className="sticky-navbar">
						{
							tabs.map( ( tab ) => (
								<a
									key={ tab.id }
									href={ `#${ tab.id }` }
									className={ `outline-none block p-4 border-gray-200 font-bold first:rounded-t-lg ${ activeTab === tab.id ? 'bg-blue-700 text-white font-bold border-r-0 hover:text-white focus:text-white focus:ring-2' : '' } ${
										tab.id !== 'general-settings' && ! isVerified ? 'opacity-50 pointer-events-none' : ''
									}` }
									onClick={ () => {
										setActiveTab( tab.id );
									} }
								>
									{ tab.label }
								</a>
							) )
						}
					</nav>
				</div>
				<div id="main-content" className="w-full p-5 bg-white rounded-lg border">
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
						{ isVerified && (
							<div className="quick-analytics-share-link max-w-[400px] w-full">
								<a href="https://www.google.com" target="_blank" rel="noreferrer">Quick Analytics Share Link</a>
							</div>
						) }
					</div>
				</div>
			</div>
		</>
	);
};

export default App;
