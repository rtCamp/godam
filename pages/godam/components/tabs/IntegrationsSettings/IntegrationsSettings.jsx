/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import {
	Notice,
	TabPanel,
	Panel,
	PanelBody,
	Button,
	Spinner,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { scrollToTop, hasValidAPIKey } from '../../../utils/index.js';
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { updateMediaSetting, resetChangeFlag } from '../../../redux/slice/media-settings.js';
import { getPricingUrl } from '../../../../shared/premium-layers.js';

// WooCommerceSettings is loaded dynamically by the GoDAM for Woo add-on.
// It registers itself via window.godamIntegrationComponents.
const getWooCommerceSettings = () => window.godamIntegrationComponents?.WooCommerceSettings || null;

const IntegrationSettings = () => {
	const isWooActive = Boolean( window?.easydamMediaLibrary?.isWooActive );
	const WooCommerceSettings = getWooCommerceSettings();

	// Build tabs conditionally — only show Woo tab when add-on provides its component.
	const tabs = [
		...( isWooActive && WooCommerceSettings
			? [
				{
					name: 'woocommerce',
					title: (
						<>
							{ __( 'WooCommerce', 'godam' ) }
							<span className="godam-pro-badge">
								{ __( 'Pro', 'godam' ) }
							</span>
						</>
					),
					className: 'godam-tab',
				},
			]
			: [] ),
	];

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

	// Function to handle setting change
	const handleSettingChange = ( key, value ) => {
		dispatch(
			updateMediaSetting( {
				category: 'integrations',
				subCategory: 'woocommerce',
				key,
				value,
			} ),
		);
	};

	// Function to handle saving settings
	const handleSaveSettings = async () => {
		try {
			const response = await saveMediaSettings( { settings: mediaSettings } ).unwrap();

			if ( response?.status === 'success' ) {
				showNotice( __( 'Settings saved successfully.', 'godam' ) );
				dispatch( resetChangeFlag() );
			} else {
				showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
			}
		} catch ( error ) {
			showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
		}
	};

	// Add unsaved changes warning
	useEffect( () => {
		const handleBeforeUnload = ( event ) => {
			if ( isChanged ) {
				event.preventDefault();
				event.returnValue = __( 'You have unsaved changes. Are you sure you want to leave?', 'godam' );
			}
		};
		window.addEventListener( 'beforeunload', handleBeforeUnload );
		return () => window.removeEventListener( 'beforeunload', handleBeforeUnload );
	}, [ isChanged ] );

	// If no integrations available → render nothing.
	if ( tabs.length === 0 ) {
		return null;
	}

	return (
		<>
			{ notice.isVisible && (
				<Notice
					className="mb-4"
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
				>
					{ notice.message }
				</Notice>
			) }

			<Panel
				header={ __( 'Integration Settings', 'godam' ) }
				className="godam-panel"
			>
				<TabPanel
					className="godam-tab-panel"
					activeClass="is-active"
					tabs={ tabs }
				>
					{ ( tab ) => {
						switch ( tab.name ) {
							case 'woocommerce':
								return (
									<PanelBody opened>
										<WooCommerceSettings
											settings={ mediaSettings.integrations?.woocommerce || {} }
											onSettingChange={ handleSettingChange }
											hasValidAPIKey={ hasValidAPIKey }
											getPricingUrl={ getPricingUrl }
										/>
									</PanelBody>
								);
							default:
								return null;
						}
					} }
				</TabPanel>
			</Panel>

			<Button
				variant="primary"
				className="godam-button"
				onClick={ handleSaveSettings }
				icon={ saveMediaSettingsLoading && <Spinner /> }
				isBusy={ saveMediaSettingsLoading }
				disabled={ saveMediaSettingsLoading || ! isChanged || ! hasValidAPIKey }
			>
				{ saveMediaSettingsLoading ? __( 'Saving…', 'godam' ) : __( 'Save', 'godam' ) }
			</Button>
		</>
	);
};

export default IntegrationSettings;
