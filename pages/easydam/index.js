/**
 * External dependencies
 */
import ReactDOM from 'react-dom';

/**
 * Internal dependencies
 */
import GeneralSettings from './GeneralSettings';
import EasyDAM from './EasyDAM';
import VideoSettings from './VideoSettings';
import ImageSettings from './ImageSettings';
import Analytics from './Analytics';

/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';

const App = () => {
	const [ activeTab, setActiveTab ] = useState( 'general-settings' );
	const [ isPremiumUser, setIsPremiumUser ] = useState( false ); // Should be initially set to false.
	const [ mediaSettings, setMediaSettings ] = useState( null );
	const [ licenseKey, setLicenseKey ] = useState( '' );
	const [ isVerified, setIsVerified ] = useState( false ); // Tracks if the license is verified.

	const tabs = [
		{
			id: 'general-settings',
			label: 'General Settings',
			component: GeneralSettings,
		},
		// {
		// 	id: 'easydam',
		// 	label: 'EasyDAM',
		// 	component: EasyDAM,
		// },
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
		// 	id: 'analytics',
		// 	label: 'Analytics',
		// 	component: Analytics,
		// },
	];

	useEffect( () => {
		const fetchSettings = async () => {
			try {
				const settingsResponse = await fetch( '/wp-json/transcoder/v1/easydam-settings', {
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.wpApiSettings.nonce,
					},
				} );
				const licenseResponse = await fetch( '/wp-json/transcoder/v1/get-license-key', {
					method: 'GET',
					headers: {
						'X-WP-Nonce': window.wpApiSettings.nonce,
					},
				} );

				const settingsData = await settingsResponse.json();
				const licenseData = await licenseResponse.json();

				console.log( 'Fetched data:', settingsData );

				setMediaSettings( settingsData );
				setLicenseKey( licenseData.license_key || '' ); // Save the license key
				setIsVerified( settingsData?.general?.is_verified || false );
			} catch ( error ) {
				console.error( 'Failed to fetch data:', error );
			}
		};

		fetchSettings();
	}, [] );

	const saveMediaSettings = async ( updatedSettings ) => {
		try {
			const response = await fetch( '/wp-json/transcoder/v1/easydam-settings', {
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
						<div className="quick-analytics-share-link max-w-[400px] w-full">
							<a href="https://www.google.com" target="_blank" rel="noreferrer">Quick Analytics Share Link</a>
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default App;

ReactDOM.render( <App />, document.getElementById( 'root-easydam' ) );
