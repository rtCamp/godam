
/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { cog, video } from '@wordpress/icons';
import { Icon } from '@wordpress/components';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { setLoading } from './redux/slice/storage';
import GeneralSettings from './GeneralSettings';
import VideoSettings from './VideoSettings';
// import ImageSettings from './ImageSettings';
// import StorageSettings from './storage-settings/index';
import GodamHeader from './GodamHeader';
import GoDAMFooter from './GoDAMFooter';

const App = () => {
	const [ activeTab, setActiveTab ] = useState( 'general-settings' );
	const isPremiumUser = window.userData?.user_data?.active_plan !== 'Starter';
	const [ mediaSettings, setMediaSettings ] = useState( null );
	const [ apiKey, setAPIKey ] = useState( '' );
	const [ verifyAPIKeyFromURL, setVerifyAPIKeyFromURL ] = useState( false );

	const dispatch = useDispatch();

	const restURL = window.godamRestRoute.url || '';

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
		// {
		// 	id: 'image-settings',
		// 	label: 'Image settings',
		// 	component: ImageSettings,
		// 	icon: image,
		// },
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
				const url = window.pathJoin( [ restURL, '/godam/v1/settings/easydam-settings' ] );
				const settingsResponse = await fetch( url, {
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.wpApiSettings.nonce,
					},
				} );

				const settingsData = await settingsResponse.json();

				let apiKeyFromURL = '';
				const urlParams = new URLSearchParams( window.location.search );
				if ( urlParams.has( 'api_key' ) ) {
					apiKeyFromURL = urlParams.get( 'api_key' );
				}

				if ( ! window.userData?.valid_api_key && apiKeyFromURL ) {
					// Set API key from URL and trigger verification in GeneralSettings
					setAPIKey( apiKeyFromURL );
					setVerifyAPIKeyFromURL( true ); // Pass this flag to GeneralSettings
				} else {
					setAPIKey( window?.userData?.user_data?.masked_api_key || '' );
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
			const url = window.pathJoin( [ restURL, '/godam/v1/settings/easydam-settings' ] );
			const response = await fetch( url, {
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
			<div className="wrap flex gap-4 my-8 max-w-[1260px] pl-4 pr-9 mx-auto">
				<div className="max-w-[220px] min-w-[160px]">
					<nav className="sticky-navbar pt-8 -mt-8">
						{
							tabs.map( ( tab ) => (
								<a
									key={ tab.id }
									href={ `#${ tab.id }` }
									className={ `sidebar-nav-item ${ activeTab === tab.id ? 'active' : '' }` }
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
				<div id="main-content" className="flex-grow">
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
											apiKey={ apiKey }
											setAPIKey={ setAPIKey }
											verifyAPIKeyFromURL={ verifyAPIKeyFromURL }
										/>
								) )
							}
						</div>
					</div>
				</div>
			</div>
			<GoDAMFooter />
		</div>
	);
};

export default App;
