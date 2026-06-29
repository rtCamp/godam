/**
 * External dependencies
 */
import { useState } from 'react';

/**
 * WordPress dependencies
 */
import { Button, Panel, PanelBody, Spinner } from '@wordpress/components';
import { copySmall, trash } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { useDeactivateAPIKeyMutation, useRefreshAPIKeyStatusMutation, useVerifyAPIKeyMutation } from '../../../redux/api/media-settings.js';
import { hasValidAPIKey, hasAPIKey, maskedAPIKey, apiKeyStatus, scrollToTop } from '../../../utils/index.js';
import PasswordFieldWithToggle from './components/PasswordFieldWIthToggle/index.jsx';
import ConfirmModal from '../../ConfirmModal.jsx';
import UsageData from './UsageData.jsx';

const APISettings = ( { setNotice } ) => {
	const [ apiKey, setAPIKey ] = useState( hasAPIKey ? maskedAPIKey : '' );
	const [ isRemoveModalOpen, setIsRemoveModalOpen ] = useState( false );
	const [ verifyAPIKey, { isLoading: isAPIKeyLoading } ] = useVerifyAPIKeyMutation();
	const [ deactivateAPIKey, { isLoading: isDeactivateLoading } ] = useDeactivateAPIKeyMutation();
	const [ refreshAPIKeyStatus, { isLoading: isRefreshLoading } ] = useRefreshAPIKeyStatusMutation();
	const [ validationError, setValidationError ] = useState( null );

	// Update the API key value and clear any inline validation error.
	const handleAPIKeyChange = ( value ) => {
		setAPIKey( value );
		setValidationError( null );
	};

	// Function to handle saving the API key
	const handleSaveAPIKey = async () => {
		if ( ! apiKey.trim() ) {
			setValidationError( __( 'Please enter a valid API key', 'godam' ) );
			return;
		}

		try {
			await verifyAPIKey( apiKey ).unwrap();
			setValidationError( null );

			// Reload so the verified state and Plan Usage reflect the new key.
			window.location.reload();
		} catch ( error ) {
			setValidationError( error.data?.message || __( 'The API key you’ve entered is incorrect. Please enter a valid key', 'godam' ) );
		}
	};

	// Function to handle deactivating the API key
	const handleDeactivateAPIKey = async () => {
		try {
			const response = await deactivateAPIKey().unwrap();

			setNotice( {
				message: response.message || __( 'API key deactivated successfully!', 'godam' ),
				status: 'success',
				isVisible: true,
			} );

			window.location.reload();
		} catch ( error ) {
			setIsRemoveModalOpen( false );
			setNotice( {
				message: error.data?.message || __( 'Failed to deactivate API key', 'godam' ),
				status: 'error',
				isVisible: true,
			} );
		}

		scrollToTop();
	};

	// Function to handle refreshing API key status
	const handleRefreshAPIKeyStatus = async () => {
		try {
			const response = await refreshAPIKeyStatus().unwrap();

			setNotice( {
				message: response.message || __( 'API key status refreshed!', 'godam' ),
				status: response.status === 'success' ? 'success' : 'warning',
				isVisible: true,
			} );

			setTimeout( () => {
				window.location.reload();
			}, 1000 );
		} catch ( error ) {
			setNotice( {
				message: error.data?.message || __( 'Failed to refresh API key status', 'godam' ),
				status: 'error',
				isVisible: true,
			} );
		}

		scrollToTop();
	};

	// Copy the actual (unmasked) API key to the clipboard.
	// The field only holds the masked key, so fetch the real one on demand.
	const handleCopyAPIKey = async () => {
		try {
			const response = await apiFetch( { path: '/godam/v1/settings/get-api-key' } );
			const key = response?.api_key;

			if ( ! key ) {
				throw new Error( 'No API key returned' );
			}

			await window.navigator.clipboard.writeText( key );
			setNotice( {
				message: __( 'API key copied to clipboard.', 'godam' ),
				status: 'success',
				isVisible: true,
			} );
		} catch ( error ) {
			setNotice( {
				message: __( 'Failed to copy API key.', 'godam' ),
				status: 'error',
				isVisible: true,
			} );
		}
	};

	return (
		<Panel header={ __( 'API Settings', 'godam' ) } className="godam-panel godam-margin-bottom">
			<PanelBody initialOpen>
				<div className="flex flex-col gap-2 b-4m">
					<div className="godam-api-key-row">
						<div className="godam-api-key-row__field">
							<PasswordFieldWithToggle
								hasValidAPIKey={ hasValidAPIKey }
								hasAPIKey={ hasAPIKey }
								apiKey={ apiKey }
								setAPIKey={ handleAPIKeyChange }
								apiKeyStatus={ apiKeyStatus }
								validationError={ validationError }
							/>
						</div>
						<div className="godam-api-key-row__actions">
							<Button
								icon={ copySmall }
								variant="secondary"
								onClick={ handleCopyAPIKey }
								disabled={ ! hasAPIKey }
								label={ __( 'Copy API key', 'godam' ) }
								showTooltip
								data-test-id="godam-settings-api-key-button-copy"
							/>
							<Button
								icon={ trash }
								variant="secondary"
								onClick={ () => setIsRemoveModalOpen( true ) }
								disabled={ ! hasAPIKey }
								isBusy={ isDeactivateLoading }
								label={ __( 'Remove API key', 'godam' ) }
								showTooltip
								data-test-id="godam-settings-video-button-remove-api-key"
							/>
						</div>
					</div>

					<div className="flex flex-wrap gap-2">
						<Button
							onClick={ handleSaveAPIKey }
							icon={ isAPIKeyLoading && <Spinner /> }
							disabled={ isAPIKeyLoading || hasAPIKey || ! apiKey.trim() }
							variant="primary"
							isBusy={ isAPIKeyLoading }
							data-test-id="godam-settings-api-key-button-save"
						>
							{ isAPIKeyLoading ? __( 'Saving…', 'godam' ) : __( 'Save API Key', 'godam' ) }
						</Button>
						{ hasAPIKey && ! hasValidAPIKey && (
							<Button
								onClick={ handleRefreshAPIKeyStatus }
								disabled={ isRefreshLoading }
								variant="secondary"
								isBusy={ isRefreshLoading }
								data-test-id="godam-settings-api-key-button-refresh"
							>
								{ isRefreshLoading ? __( 'Refreshing…', 'godam' ) : __( 'Refresh Status', 'godam' ) }
							</Button>
						) }
					</div>

					{ hasAPIKey && <UsageData /> }

					<div className="godam-api-key-footer">
						{ hasValidAPIKey && (
							<p className="description">
								{ __( 'Access your active API key from', 'godam' ) } { ' ' }
								<a
									href={ ( window.godamRestRoute?.apiBase ?? 'https://app.godam.io' ) + '/web/billing?tab=API' }
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-500 underline"
								>
									{ __( 'Account', 'godam' ) }
								</a>.
							</p>
						) }
						<p className="description">
							{ __( 'Having any issue?', 'godam' ) } { ' ' }
							<a
								href="https://app.godam.io/helpdesk/my-tickets"
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-500 underline"
							>
								{ __( 'Contact Support', 'godam' ) }
							</a>
						</p>
					</div>
				</div>
			</PanelBody>

			<ConfirmModal
				isOpen={ isRemoveModalOpen }
				title={ __( 'Remove API Key?', 'godam' ) }
				confirmLabel={ __( 'Yes, Remove', 'godam' ) }
				cancelLabel={ __( 'Cancel', 'godam' ) }
				isDestructive
				isBusy={ isDeactivateLoading }
				onCancel={ () => setIsRemoveModalOpen( false ) }
				onConfirm={ handleDeactivateAPIKey }
				data-test-id="godam-settings-api-key-button-confirm-remove"
			>
				{ __( 'If you remove the API key, your account will be deactivated and you’ll lose access to the platform.', 'godam' ) }
			</ConfirmModal>
		</Panel>
	);
};

export default APISettings;
