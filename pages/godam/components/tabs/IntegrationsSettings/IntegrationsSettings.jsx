/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-nested-ternary */
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
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { scrollToTop, hasValidAPIKey } from '../../../utils/index.js';
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { updateMediaSetting, resetChangeFlag } from '../../../redux/slice/media-settings.js';
import { getPricingUrl } from '../../../../shared/premium-layers.js';
import IntegrationToggle from './IntegrationToggle.jsx';
import IntegrationActionButton from './IntegrationActionButton.jsx';
import integrationTabs from './integration-tabs.js';

/**
 * Retrieve the extended-settings component registered by an add-on for a
 * given integration tab.
 *
 * Add-ons register themselves on `window.godamIntegrationComponents` keyed by
 * the integration slug (must match the tab `name`), e.g.:
 *
 * window.godamIntegrationComponents.woocommerce = MySettingsComponent;
 *
 * @param {string} tabName The integration slug / tab name.
 * @return {Function|null} React component, or null.
 */
const getExtendedSettings = ( tabName ) =>
	window.godamIntegrationComponents?.[ tabName ] || null;

const TOGGLE_SUCCESS_NOTICE_KEY = 'godam_integration_toggle_notice';

const IntegrationSettings = () => {
	const tabs = integrationTabs;

	const dispatch = useDispatch();

	// Selectors to get media settings and change flag
	const { mediaSettings, isChanged } = useSelector( ( state ) => ( {
		mediaSettings: state.mediaSettings,
		isChanged: state.mediaSettings.isChanged,
	} ) );

	const [ saveMediaSettings, { isLoading: saveMediaSettingsLoading } ] = useSaveMediaSettingsMutation();
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );
	const [ togglingPlugin, setTogglingPlugin ] = useState( null );
	const [ installingPlugin, setInstallingPlugin ] = useState( null );
	const [ installError, setInstallError ] = useState( null );

	useEffect( () => {
		const persistedNotice = window.sessionStorage?.getItem( TOGGLE_SUCCESS_NOTICE_KEY );

		if ( persistedNotice ) {
			showNotice( persistedNotice, 'success' );
			window.sessionStorage?.removeItem( TOGGLE_SUCCESS_NOTICE_KEY );
		}
	}, [] );

	// Function to show a notice message
	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		if ( window.scrollY > 0 ) {
			scrollToTop();
		}
	};

	// Handle integration toggle — activate / deactivate the add-on plugin.
	const handleToggle = async ( tab, value ) => {
		if ( tab.pluginSlug ) {
			setTogglingPlugin( tab.name );
			try {
				const response = await apiFetch( {
					path: '/godam/v1/addon/toggle',
					method: 'POST',
					data: {
						plugin: tab.pluginSlug,
						activate: value,
					},
				} );

				if ( response?.status === 'success' ) {
					window.sessionStorage?.setItem(
						TOGGLE_SUCCESS_NOTICE_KEY,
						response?.message || __( 'Integration status updated successfully.', 'godam' ),
					);
					window.location.reload();
				}
			} catch ( error ) {
				showNotice(
					error.message || __( 'Failed to toggle add-on.', 'godam' ),
					'error',
				);
			} finally {
				setTogglingPlugin( null );
			}
		} else {
			handleSettingChange( tab.name, 'enable', value );
		}
	};

	// Handle add-on installation via Frappe Dispatch.
	const handleInstall = async ( tab ) => {
		if ( ! tab.fdItemId ) {
			return;
		}

		setInstallingPlugin( tab.name );
		try {
			const response = await apiFetch( {
				path: '/godam/v1/addon/install',
				method: 'POST',
				data: {
					plugin_slug: tab.fdItemId,
				},
			} );

			if ( response?.status === 'success' ) {
				showNotice(
					__( 'Add-on installed successfully! Reloading…', 'godam' ),
				);
				window.location.reload();
			}
		} catch ( error ) {
			const downloadLink = error?.data?.download_link || null;
			setInstallError( { tabName: tab.name, downloadLink } );
			showNotice(
				__( 'Installation failed.', 'godam' ),
				'error',
			);
		} finally {
			setInstallingPlugin( null );
		}
	};

	// Function to handle setting change for a given integration.
	const handleSettingChange = ( subCategory, key, value ) => {
		dispatch(
			updateMediaSetting( {
				category: 'integrations',
				subCategory,
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
						const integrationSettings = mediaSettings.integrations?.[ tab.name ] || {};
						const addonStatus = tab.pluginSlug ? window.godamAddonStatuses?.[ tab.pluginSlug ] : null;
						const isInstalled = ! tab.pluginSlug || !! addonStatus?.installed;
						const isPluginActive = tab.pluginSlug
							? !! addonStatus?.active
							: ( integrationSettings?.enable !== undefined ? integrationSettings.enable : true );
						const requiredStatus = tab.requiredPlugin ? window.godamAddonStatuses?.[ tab.requiredPlugin ] : null;
						const isRequiredActive = ! tab.requiredPlugin || ( !! requiredStatus?.installed && !! requiredStatus?.active );

						return (
							<PanelBody opened>
								<IntegrationActionButton
									label={ tab.addonLabel || tab.integrationLabel }
									isAddonInstalled={ isInstalled }
									isRequiredActive={ isRequiredActive }
									hasValidAPIKey={ hasValidAPIKey }
									getPricingUrl={ getPricingUrl }
									featureSlug={ `${ tab.name }-integration` }
									learnMoreUrl="https://godam.io/woo/"
									onInstall={ () => handleInstall( tab ) }
									isInstalling={ installingPlugin === tab.name }
								/>

								{ installError?.tabName === tab.name && ! isInstalled && (
									<Notice
										status="error"
										isDismissible={ true }
										onRemove={ () => setInstallError( null ) }
										className="godam-install-error-notice"
									>
										<p>
											{ __( 'Installation failed. Please download the ZIP and install it like any other WordPress plugin.', 'godam' ) }
										</p>
										<div style={ { display: 'flex', gap: '12px', marginTop: '8px' } }>
											{ installError.downloadLink && (
												<Button
													variant="secondary"
													href={ installError.downloadLink }
													icon="download"
												>
													{ __( 'Download ZIP', 'godam' ) }
												</Button>
											) }
											<Button
												variant="link"
												href="https://wordpress.org/documentation/article/manage-plugins/#upload-via-wordpress-admin"
												target="_blank"
												rel="noopener noreferrer"
												icon="external"
											>
												{ __( 'View Installation Guide', 'godam' ) }
											</Button>
										</div>
									</Notice>
								) }

								{ /* This will show when the Button Displays Install Addon text */ }
								{ isRequiredActive && hasValidAPIKey && ! isInstalled && (
									<p>
										{ sprintf(
										/* translators: %s: Integration name, e.g. "WooCommerce". */
											__( 'The %s add-on plugin is not installed. Please install it to enable this integration.', 'godam' ),
											tab.integrationLabel,
										) }
									</p>
								) }

								{ /* This will show when the Button Displays Upgrade Plan text */ }
								{ ! isInstalled && ! hasValidAPIKey && (
									<p>
										{ __( 'This is a Pro feature.', 'godam' ) }
										{ ' ' }
										<a
											href={ getPricingUrl( `${ tab.name }-integration` ) }
											target="_blank"
											rel="noopener noreferrer"
											style={ { color: '#b02544', textDecoration: 'underline', fontWeight: 500 } }
										>
											{ __( 'Upgrade to Pro', 'godam' ) }
											{ ' ↗' }
										</a>
										{ ' ' }
										{ __( 'to use this integration.', 'godam' ) }
									</p>
								) }

								{ isInstalled && (
									<IntegrationToggle
										label={ tab.integrationLabel }
										enabled={ isPluginActive }
										onChange={ ( value ) => handleToggle( tab, value ) }
										hasValidAPIKey={ hasValidAPIKey }
										getPricingUrl={ getPricingUrl }
										featureSlug={ `${ tab.name }-integration` }
										isToggling={ togglingPlugin === tab.name }
									/>
								) }

								{ /* Render add-on extended settings if the add-on registered a component. */ }
								{ ( () => {
									const ExtendedSettings = getExtendedSettings( tab.name );
									if ( ! ExtendedSettings ) {
										return null;
									}
									return (
										<ExtendedSettings
											settings={ integrationSettings }
											onSettingChange={ ( key, value ) => handleSettingChange( tab.name, key, value ) }
											hasValidAPIKey={ hasValidAPIKey }
											getPricingUrl={ getPricingUrl }
										/>
									);
								} )() }
							</PanelBody>
						);
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
