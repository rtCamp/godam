/**
 * External dependencies
 */
import { useState } from 'react';

/**
 * WordPress dependencies
 */
import { Button, Panel, PanelBody, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useDeactivateAPIKeyMutation, useRefreshAPIKeyStatusMutation, useVerifyAPIKeyMutation } from '../../../redux/api/media-settings.js';
import { hasValidAPIKey, hasAPIKey, maskedAPIKey, apiKeyStatus, scrollToTop } from '../../../utils/index.js';
import UsageData from './UsageData.jsx';
import PasswordFieldWithToggle from './components/PasswordFieldWIthToggle/index.jsx';

const APISettings = ( { setNotice } ) => {
	const [ apiKey, setAPIKey ] = useState( hasAPIKey ? maskedAPIKey : '' );
	const [ verifyAPIKey, { isLoading: isAPIKeyLoading } ] = useVerifyAPIKeyMutation();
	const [ deactivateAPIKey, { isLoading: isDeactivateLoading } ] = useDeactivateAPIKeyMutation();
	const [ refreshAPIKeyStatus, { isLoading: isRefreshLoading } ] = useRefreshAPIKeyStatusMutation();

	// Function to handle saving the API key
	const handleSaveAPIKey = async () => {
		if ( ! apiKey.trim() ) {
			setNotice( {
				message: __( 'Please enter a valid API key', 'godam' ),
				status: 'error',
				isVisible: true,
			} );
			return;
		}

		try {
			const response = await verifyAPIKey( apiKey ).unwrap();
			setNotice( {
				message: response.message || __( 'API key verified successfully!', 'godam' ),
				status: 'success',
				isVisible: true,
			} );

			window.location.reload();
		} catch ( error ) {
			setNotice( {
				message: error.data?.message || __( 'Failed to verify API key', 'godam' ),
				status: 'error',
				isVisible: true,
			} );
		}

		scrollToTop();
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

			// Reload to update the UI with new status
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

	return (
		<Panel header={ __( 'API Settings', 'godam' ) } className="godam-panel">
			<PanelBody initialOpen className="flex gap-8 flex-col sm:flex-row">
				<div className="flex flex-col gap-2 b-4m">
					<PasswordFieldWithToggle
						hasValidAPIKey={ hasValidAPIKey }
						hasAPIKey={ hasAPIKey }
						apiKey={ apiKey }
						setAPIKey={ setAPIKey }
						apiKeyStatus={ apiKeyStatus }
					/>
					<div className="flex flex-wrap gap-2">
						<Button
							className="godam-button godam-margin-right"
							onClick={ handleSaveAPIKey }
							icon={ isAPIKeyLoading && <Spinner /> }
							disabled={ isAPIKeyLoading || ( hasAPIKey ) || ! apiKey.trim() }
							variant="primary"
							isBusy={ isAPIKeyLoading }
						>
							{ isAPIKeyLoading ? __( 'Saving…', 'godam' ) : __( 'Save API Key', 'godam' ) }
						</Button>
						<Button
							className="godam-button"
							onClick={ handleDeactivateAPIKey }
							disabled={ isAPIKeyLoading || ! hasAPIKey }
							variant="secondary"
							isDestructive
							isBusy={ isDeactivateLoading }
						>
							{ __( 'Remove API Key', 'godam' ) }
						</Button>
						{ hasAPIKey && (
							<Button
								className="godam-button"
								onClick={ handleRefreshAPIKeyStatus }
								disabled={ isRefreshLoading }
								variant="secondary"
								isBusy={ isRefreshLoading }
							>
								{ isRefreshLoading ? __( 'Refreshing…', 'godam' ) : __( 'Refresh Status', 'godam' ) }
							</Button>
						) }
					</div>
					<p className="description">
						{ __( 'Having any issues?', 'godam' ) } { ' ' }
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

				{ hasAPIKey && ( <UsageData /> ) }
			</PanelBody>
		</Panel>
	);
};

export default APISettings;
