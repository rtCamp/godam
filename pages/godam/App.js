/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { cog, video } from '@wordpress/icons';
import { Icon } from '@wordpress/components';

/**
 * Internal dependencies
 */
import Skeleton from './components/Skeleton.jsx';

import GeneralSettings from './components/tabs/GeneralSettings/GeneralSettings.jsx';
import VideoSettings from './VideoSettings';

import GodamHeader from './GodamHeader';

import { useGetMediaSettingsQuery } from './redux/api/media-settings.js';
import { setMediaSettings } from './redux/slice/media-settings.js';

const App = () => {
	const [ activeTab, setActiveTab ] = useState( 'general-settings' );

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
	}, [ mediaSettingsData, dispatch ] );

	if ( isMediaSettingLoading ) {
		return ( <Skeleton /> );
	}

	return (
		<div id="godam-settings">
			<GodamHeader />
			<div className="godam-settings__container">
				<div className="godam-settings__container__tabs">
					<nav>
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
				<div id="main-content" className="godam-settings__container__content">
					{
						tabs.map( ( tab ) => (
							activeTab === tab.id &&
								<tab.component key={ tab.id } />
						) )
					}
				</div>
			</div>
		</div>
	);
};

export default App;
