/**
 * External dependencies
 */
import ReactDOM from 'react-dom';

/**
 * Internal dependencies
 */
import EasyDAM from './EasyDAM';
import VideoSettings from './VideoSettings';
import ImageSettings from './ImageSettings';
import Analytics from './Analytics';

/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';

const App = () => {
	const [ activeTab, setActiveTab ] = useState( 'video-settings' );
	const [ isPremiumUser, setIsPremiumUser ] = useState( false ); // Should be initially set to false.

	const tabs = [
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
		const fetchUserStatus = async () => { // Update the FETCH FUNCTION
			const apiKey = '7130b8ec614c12246ad7c31558d58e46';
			// Fetch from internal API endpoint, which will already have the license key, instead of the frappe-transcoder endpoint.
			const endpoint = `http://frappe-transcoder-api.rt.gw/api/resource/Transcoder License/${ apiKey }`;

			try {
				const response = await fetch( endpoint );
				if ( ! response.ok ) {
					throw new Error( 'Network response was not ok' );
				}
				const data = await response.json();

				// Update isPremiumUser based on "plan" or "status"
				const isVerified = data?.data?.status === 'Active' && data?.data?.plan !== 'Free';
				setIsPremiumUser( isVerified );
			} catch ( error ) {
				console.error( 'Error fetching user status:', error );
			}
		};

		fetchUserStatus();
	}, [] );

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
									className={ `outline-none block p-4 border-gray-200 font-bold first:rounded-t-lg ${ activeTab === tab.id ? 'bg-indigo-500 text-white font-bold border-r-0 hover:text-white focus:text-white focus:ring-2' : '' }` }
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
									activeTab === tab.id && <tab.component key={ tab.id } isPremiumUser={ isPremiumUser } />
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
