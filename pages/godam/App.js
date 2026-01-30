
/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { cog, video, alignJustify, close } from '@wordpress/icons';
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
import { isSafari } from './utils/index.js';

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
		icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="18" fill="currentColor" className="bi bi-palette" viewBox="0 0 18 18">
			<path d="M8 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m4 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M5.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m.5 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" />
			<path d="M16 8c0 3.15-1.866 2.585-3.567 2.07C11.42 9.763 10.465 9.473 10 10c-.603.683-.475 1.819-.351 2.92C9.826 14.495 9.996 16 8 16a8 8 0 1 1 8-8m-8 7c.611 0 .654-.171.655-.176.078-.146.124-.464.07-1.119-.014-.168-.037-.37-.061-.591-.052-.464-.112-1.005-.118-1.462-.01-.707.083-1.61.704-2.314.369-.417.845-.578 1.272-.618.404-.038.812.026 1.16.104.343.077.702.186 1.025.284l.028.008c.346.105.658.199.953.266.653.148.904.083.991.024C14.717 9.38 15 9.161 15 8a7 7 0 1 0-7 7" />
		</svg>,
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
	const [ isSidebarOpen, setIsSidebarOpen ] = useState( false );
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

			<div className="godam-settings__hamburger-container">
				<button
					className="godam-settings__hamburger lg:hidden"
					onClick={ () => setIsSidebarOpen( ! isSidebarOpen ) }
					title="Open Menu"
					aria-label="Open Menu"
				>
					<Icon icon={ alignJustify } className="open-btn" />
				</button>
			</div>

			{ isSidebarOpen && (
				<div
					className="godam-settings__overlay"
					onClick={ () => setIsSidebarOpen( false ) }
					role="button"
					tabIndex={ 0 }
					onKeyDown={ ( e ) => {
						if ( e.key === 'Enter' || e.key === ' ' ) {
							setIsSidebarOpen( false );
						}
					} }
				/>
			) }

			<div className="godam-settings__container">
				<nav className={ `godam-settings__container__tabs ${ isSidebarOpen ? 'open' : '' } ${ isSafari() ? 'is-safari' : '' }` }>
					<button
						className={ `godam-settings__close-btn ${ isSidebarOpen ? 'open' : '' }` }
						onClick={ () => setIsSidebarOpen( false ) }
						title="Close Menu"
						aria-label="Close Menu"
					>
						<Icon icon={ close } />
					</button>

					{ TABS.map( ( { id, label, icon } ) => (
						<a
							key={ id }
							href={ `#${ id }` }
							className={ `sidebar-nav-item whitespace-nowrap ${ activeTab === id ? 'active' : '' }` }
							onClick={ () => {
								setActiveTab( id );
								setIsSidebarOpen( false );
							} }
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
