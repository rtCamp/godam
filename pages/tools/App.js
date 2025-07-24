/**
 * WordPress dependencies
 */
import { addSubmenu, cloudDownload } from '@wordpress/icons';
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

const TABS = [
	{
		id: 'retranscode-media',
		label: __( 'Retranscode Media', 'godam' ),
		component: <RetranscodeTab />,
		icon: addSubmenu,
	},
	{
		id: 'video-migration',
		label: __( 'Video Migration', 'godam' ),
		component: <MigrationTab />,
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

			{ /* Hamburger for smaller screens */ }
			<button
				className="godam-tools__hamburger lg:hidden"
				onClick={ () => setIsSidebarOpen( ! isSidebarOpen ) }
				aria-label="Toggle menu"
			>
				☰
			</button>

			{ /* Optional overlay */ }
			{ isSidebarOpen && (
				<div className="godam-tools__overlay" onClick={ () => setIsSidebarOpen( false ) } />
			) }

			<div className="godam-tools__container">
				<nav className={ `godam-tools__container__tabs ${ isSidebarOpen ? 'open' : '' }` }>
					{ TABS.map( ( { id, label, icon } ) => (
						<a
							key={ id }
							href={ `#${ id }` }
							className={ `sidebar-nav-item whitespace-nowrap ${ activeTab === id ? 'active' : '' }` }
							// onClick={ () => setActiveTab( id ) }
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
					{ activeTabData && activeTabData.component }
				</div>
			</div>
			<GoDAMFooter />
		</div>
	);
};

export default App;
