
/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { cog, video, code } from '@wordpress/icons';
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
import VideoPlayer from './components/tabs/VideoPlayer/VideoPlayer.jsx';
import AdsSettings from './components/tabs/AdsSettings/AdsSettings.jsx';

import { useGetMediaSettingsQuery } from './redux/api/media-settings.js';
import { setMediaSettings } from './redux/slice/media-settings.js';

const TABS = [
	{
		id: 'general-settings',
		label: __( 'General Settings', 'godam' ),
		component: GeneralSettings,
		icon: cog,
	},
	{
		id: 'video-settings',
		label: __( 'Video Settings', 'godam' ),
		component: VideoSettings,
		icon: video,
	},
	{
		id: 'video-player',
		label: __( 'Video Player', 'godam' ),
		component: VideoPlayer,
		icon: code,
	},
	{
		id: 'video-ads',
		label: __( 'Video Ads', 'godam' ),
		component: AdsSettings,
		icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-badge-ad" viewBox="0 0 16 16">
			<path d="m3.7 11 .47-1.542h2.004L6.644 11h1.261L5.901 5.001H4.513L2.5 11zm1.503-4.852.734 2.426H4.416l.734-2.426zm4.759.128c-1.059 0-1.753.765-1.753 2.043v.695c0 1.279.685 2.043 1.74 2.043.677 0 1.222-.33 1.367-.804h.057V11h1.138V4.685h-1.16v2.36h-.053c-.18-.475-.68-.77-1.336-.77zm.387.923c.58 0 1.002.44 1.002 1.138v.602c0 .76-.396 1.2-.984 1.2-.598 0-.972-.449-.972-1.248v-.453c0-.795.37-1.24.954-1.24z" />
			<path d="M14 3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM2 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
		</svg>,
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

	useEffect( () => {
		const hash = window.location.hash.replace( '#', '' );
		if ( hash && TABS.some( ( tab ) => tab.id === hash ) ) {
			setActiveTab( hash );
		}
	}, [] );

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
