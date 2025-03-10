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
import GodamHeader from './GodamHeader';
import Skeleton from './common/Skeleton.jsx';

import GeneralSettings from './general-settings/index.jsx';
import VideoSettings from './video-settings/index.jsx';

import { useGetMediaSettingsQuery } from './redux/api/media-settings.js';
import { setMediaSettings } from './redux/slice/media-settings.js';

const App = () => {
	const [ activeTab, setActiveTab ] = useState( 'general-settings' );
	const [ licenseKey, setLicenseKey ] = useState( '' );
	const [ verifyLicenseFromUrl, setVerifyLicenseFromUrl ] = useState( false );

	const { data: mediaSettingsData, isLoading: isMediaSettingLoading } = useGetMediaSettingsQuery();

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
		if ( mediaSettingsData ) {
			dispatch( setMediaSettings( mediaSettingsData ) );
		}
	}, [ dispatch, mediaSettingsData ] );

	useEffect( () => {
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
	}, [] );

	if ( isMediaSettingLoading ) {
		return <Skeleton />;
	}

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
