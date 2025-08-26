
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
import GlobalLayersSettings from './components/tabs/GlobalLayersSettings/GlobalLayersSettings.jsx';

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
		id: 'global-layers',
		label: __( 'Global Layers', 'godam' ),
		component: GlobalLayersSettings,
		icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-layers" viewBox="0 0 16 16">
			<path d="M8.235 1.441c-.104-.037-.292-.037-.471 0L1.17 4.15c-.139.05-.139.252 0 .302l6.594 2.709c.179.074.292.074.471 0l6.594-2.709c.139-.05.139-.252 0-.302L8.235 1.441zM7.764.745c.293-.106.646-.106.472 0L15.1 3.454c.317.115.317.495 0 .61L8.236 6.773c-.226.082-.647.082-.472 0L.9 4.064c-.317-.115-.317-.495 0-.61L7.764.745z" />
			<path d="m2.12 6.15 6.594 2.71c.226.09.646.09.471 0l6.594-2.71c.317-.13.317-.51 0-.64L8.235 2.8c-.226-.09-.647-.09-.471 0L.9 5.51c-.317.13-.317.51 0 .64zm6.594 4.71c.226.09.646.09.471 0l6.594-2.71c.317-.13.317-.51 0-.64L8.235 4.8c-.226-.09-.647-.09-.471 0L.9 7.51c-.317.13-.317.51 0 .64l6.594 2.71z" />
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
				<nav className={ `godam-settings__container__tabs ${ isSidebarOpen ? 'open' : '' }` }>
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
