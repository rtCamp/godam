
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
import Skeleton from './components/Skeleton.jsx';
import GodamHeader from './components/GoDAMHeader.jsx';
import GoDAMFooter from './GoDAMFooter';

import GeneralSettings from './components/tabs/GeneralSettings/GeneralSettings.jsx';
import VideoSettings from './components/tabs/VideoSettings/VideoSettings.jsx';

import { useGetMediaSettingsQuery } from './redux/api/media-settings.js';
import { setMediaSettings } from './redux/slice/media-settings.js';

const TABS = [
	{
		id: 'general-settings',
		label: 'General Settings',
		component: GeneralSettings,
		icon: cog,
	},
	{
		id: 'video-settings',
		label: 'Video Settings',
		component: VideoSettings,
		icon: video,
	},
];

const App = () => {
	const [ activeTab, setActiveTab ] = useState( TABS[ 0 ].id );
	const { data: mediaSettingsData, isLoading } = useGetMediaSettingsQuery();
	const dispatch = useDispatch();

	useEffect( () => {
		if ( mediaSettingsData ) {
			dispatch( setMediaSettings( mediaSettingsData ) );
		}
	}, [ mediaSettingsData, dispatch ] );

	if ( isLoading ) {
		return <Skeleton />;
	}

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
