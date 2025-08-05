/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { cog, video, code, upload } from '@wordpress/icons';
import { Icon } from '@wordpress/components';
import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import Skeleton from './components/Skeleton.jsx';
import GodamHeader from './components/GoDAMHeader.jsx';
import GoDAMFooter from './components/GoDAMFooter.jsx';

import GeneralSettings from './components/tabs/GeneralSettings/GeneralSettings.jsx';
import VideoSettings from './components/tabs/VideoSettings/VideoSettings.jsx';
import UploadsSettings from './components/tabs/UploadsSettings/UploadsSettings.jsx';

import { useGetMediaSettingsQuery } from './redux/api/media-settings.js';
import { setMediaSettings } from './redux/slice/media-settings.js';
import VideoPlayer from './components/tabs/VideoPlayer/VideoPlayer.jsx';
import { isPremiumUser } from './utils';

const TABS = [
	{
		id: 'general-settings',
		label: __( 'General Settings', 'godam' ),
		component: GeneralSettings,
		icon: cog,
		weight: 10,
	},
	{
		id: 'video-settings',
		label: __( 'Video Settings', 'godam' ),
		component: VideoSettings,
		icon: video,
		weight: 20,
	},
	{
		id: 'video-player',
		label: __( 'Video Player', 'godam' ),
		component: VideoPlayer,
		icon: code,
		weight: 30,
	},
];

const addTab = ( isPremium, id, label, component, icon, weight ) => {
	// Return early if the tab already exists
	if ( TABS.some( ( tab ) => tab.id === id ) ) {
		return;
	}

	if ( isPremium ) {
		if ( isPremiumUser() ) {
			TABS.push( {
				id,
				label,
				component,
				icon,
				weight,
			} );
		}

		return;
	}

	TABS.push( {
		id,
		label,
		component,
		icon,
		weight,
	} );
};

// Add tabs dynamically based on the API key validity
addTab( true, 'uploads-settings', __( 'Uploads Settings', 'godam' ), UploadsSettings, upload, 15 );

const App = () => {
	const [ activeTab, setActiveTab ] = useState( TABS[ 0 ].id );
	const { data: mediaSettingsData, isLoading } = useGetMediaSettingsQuery();
	const dispatch = useDispatch();

	useEffect( () => {
		if ( mediaSettingsData ) {
			dispatch( setMediaSettings( mediaSettingsData ) );
		}
	}, [ mediaSettingsData, dispatch ] );

	useEffect( () => {
		const hash = window.location.hash.replace( '#', '' );
		if ( hash && TABS.some( ( tab ) => tab.id === hash ) ) {
			setActiveTab( hash );
		}
	}, [] );

	if ( isLoading ) {
		return <Skeleton />;
	}

	// Sort tabs by weight
	TABS.sort( ( a, b ) => a.weight - b.weight );

	const activeTabData = TABS.find( ( tab ) => tab.id === activeTab );

	return (
		<div id="godam-settings">
			<GodamHeader />
			<div className="godam-settings__container">
				<nav className="godam-settings__container__tabs">
					{ TABS.map( ( { id, label, icon } ) => (
						<a
							key={ id }
							href={ `#${ id }` }
							className={ `sidebar-nav-item ${ activeTab === id ? 'active' : '' }` }
							onClick={ () => setActiveTab( id ) }
						>
							<Icon icon={ icon } />
							{ label }
						</a>
					) ) }
				</nav>
				<div id="main-content" className="godam-settings__container__content">
					{ activeTabData && <activeTabData.component /> }
				</div>
			</div>
			<GoDAMFooter />
		</div>
	);
};

export default App;
