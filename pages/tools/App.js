/**
 * WordPress dependencies
 */
import { addSubmenu, cloudDownload, alignJustify, close } from '@wordpress/icons';
import { Icon } from '@wordpress/components';
import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import GodamHeader from '../godam/components/GoDAMHeader.jsx';
import GoDAMFooter from '../godam/components/GoDAMFooter.jsx';
import MigrationTab from './components/tabs/Migration/MigrationTab.jsx';
import RetranscodeTab from './components/tabs/RetranscodeTab.jsx';
import { isSafari } from '../godam/utils/index.js';

const TABS = [
	{
		id: 'retranscode-media',
		label: __( 'Retranscode Media', 'godam' ),
		component: RetranscodeTab,
		icon: addSubmenu,
	},
	{
		id: 'video-migration',
		label: __( 'Video Migration', 'godam' ),
		component: MigrationTab,
		icon: cloudDownload,
	},
];

const App = () => {
	const [ activeTab, setActiveTab ] = useState( TABS[ 0 ].id );
	const [ isSidebarOpen, setIsSidebarOpen ] = useState( false );

	useEffect( () => {
		const hash = window.location.hash.replace( '#', '' );
		if ( hash && TABS.some( ( tab ) => tab.id === hash ) ) {
			setActiveTab( hash );
		}
	}, [] );

	const activeTabData = TABS.find( ( tab ) => tab.id === activeTab );

	return (
		<div id="godam-tools">
			<GodamHeader />

			<div className="godam-tools__hamburger-container">
				<button
					className="godam-tools__hamburger"
					onClick={ () => setIsSidebarOpen( ! isSidebarOpen ) }
					title="Open Menu"
					aria-label="Open Menu"
				>
					<Icon icon={ alignJustify } className="open-btn" />
				</button>
			</div>

			{ isSidebarOpen && (
				<div
					className="godam-tools__overlay"
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

			<div className="godam-tools__container">
				<nav className={ `godam-tools__container__tabs ${ isSidebarOpen ? 'open' : '' } ${ isSafari() ? 'is-safari' : '' }` }>
					<button
						className={ `godam-tools__close-btn ${ isSidebarOpen ? 'open' : '' }` }
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
				<div id="main-content" className="godam-tools__container__content">
					{ activeTabData && <activeTabData.component /> }
				</div>
			</div>
			<GoDAMFooter />
		</div>
	);
};

export default App;
