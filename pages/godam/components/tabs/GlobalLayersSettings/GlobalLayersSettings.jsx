/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import {
	Notice,
	TabPanel,
	Button,
	Spinner,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { scrollToTop } from '../../../utils/index.js';
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { resetChangeFlag } from '../../../redux/slice/media-settings.js';

// Layer components
import VideoAdsLayer from './components/VideoAdsLayer.jsx';
import FormsLayer from './components/FormsLayer.jsx';
import CTALayer from './components/CTALayer.jsx';

const GlobalLayersSettings = () => {
	const dispatch = useDispatch();

	// Selectors to get media settings and change flag
	const { mediaSettings, isChanged } = useSelector( ( state ) => ( {
		mediaSettings: state.mediaSettings,
		isChanged: state.mediaSettings.isChanged,
	} ) );

	const [ saveMediaSettings, { isLoading: saveMediaSettingsLoading } ] = useSaveMediaSettingsMutation();
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	// Function to show a notice message
	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		if ( window.scrollY > 0 ) {
			scrollToTop();
		}
	};

	// Function to save settings
	const handleSaveSettings = async () => {
		try {
			await saveMediaSettings( mediaSettings ).unwrap();
			dispatch( resetChangeFlag() );
			showNotice( __( 'Global layers settings saved successfully!', 'godam' ), 'success' );
		} catch ( error ) {
			let errorMessage = __( 'Failed to save global layers settings. Please try again.', 'godam' );
			if ( error.data && error.data.message ) {
				errorMessage = error.data.message;
			}

			showNotice( errorMessage, 'error' );
		}
	};

	// Hide notice after 5 seconds
	useEffect( () => {
		let timer;
		if ( notice.isVisible ) {
			timer = setTimeout( () => {
				setNotice( { ...notice, isVisible: false } );
			}, 5000 );
		}
		return () => clearTimeout( timer );
	}, [ notice ] );

	const tabs = [
		{
			name: 'video-ads',
			title: __( 'Video Ads', 'godam' ),
			component: VideoAdsLayer,
		},
		{
			name: 'forms',
			title: __( 'Forms', 'godam' ),
			component: FormsLayer,
		},
		{
			name: 'cta',
			title: __( 'Call to Action', 'godam' ),
			component: CTALayer,
		},
	];

	return (
		<div className="godam-global-layers-settings">
			<div className="godam-global-layers-settings__header">
				<h1 className="godam-global-layers-settings__title">
					{ __( 'Global Layers Settings', 'godam' ) }
				</h1>
				<p className="godam-global-layers-settings__description">
					{ __( 'Configure default layers that will be applied to all videos. Individual videos can override these global settings.', 'godam' ) }
				</p>
			</div>

			{ notice.isVisible && (
				<Notice
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
					isDismissible={ true }
				>
					{ notice.message }
				</Notice>
			) }

			<div className="godam-global-layers-settings__content">
				<TabPanel
					className="godam-global-layers-tabs"
					activeClass="active-tab"
					tabs={ tabs }
				>
					{ ( tab ) => {
						const TabComponent = tab.component;
						return (
							<div className="godam-global-layers-tab-content">
								<TabComponent />
							</div>
						);
					} }
				</TabPanel>
			</div>

			<div className="godam-global-layers-settings__footer">
				<Button
					variant="primary"
					onClick={ handleSaveSettings }
					disabled={ ! isChanged || saveMediaSettingsLoading }
					className="godam-global-layers-settings__save-button godam-button"
				>
					{ saveMediaSettingsLoading && <Spinner /> }
					{ __( 'Save Global Layers Settings', 'godam' ) }
				</Button>
			</div>
		</div>
	);
};

export default GlobalLayersSettings;
