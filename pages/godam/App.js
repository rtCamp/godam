/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { cog, Icon, video } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { setLoading } from './redux/slice/storage';

import GodamHeader from './GodamHeader';
import GeneralSettings from './general-settings/index.jsx';
import VideoSettings from './VideoSettings';

const App = () => {
	const [ activeTab, setActiveTab ] = useState( 'general-settings' );
	const isPremiumUser = window.userData?.user_data?.active_plan !== 'Starter';
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
	];

	useEffect( () => {
		const fetchSettings = async () => {
			dispatch( setLoading( true ) );
			try {
				const settingsResponse = await fetch( '/wp-json/godam/v1/settings/easydam-settings', {
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
			const response = await fetch( '/wp-json/godam/v1/settings/easydam-settings', {
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
			<GodamHeader />
			<div className="easydam-settings__container">
				<div className="easydam-settings__container__tabs">
					<nav>
						{
							tabs.map( ( tab ) => (
								<a
									key={ tab.id }
									href={ `#${ tab.id }` }
									className={ `${ activeTab === tab.id ? 'active' : '' }` }
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
				<div id="main-content" className="easydam-settings__container__content">
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
	);
};

export default App;
