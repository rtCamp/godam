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
import { useDeactivateAPIKeyMutation, useVerifyAPIKeyMutation } from '../../../redux/api/media-settings.js';
import { hasValidAPIKey, maskedAPIKey, scrollToTop } from '../../../utils/index.js';
import UsageData from './UsageData.jsx';
import PasswordFieldWithToggle from './components/PasswordFieldWIthToggle/index.jsx';

const APISettings = ( { setNotice } ) => {
	const [ apiKey, setAPIKey ] = useState( hasValidAPIKey ? maskedAPIKey : '' );
	const [ verifyAPIKey, { isLoading: isAPIKeyLoading } ] = useVerifyAPIKeyMutation();
	const [ deactivateAPIKey, { isLoading: isDeactivateLoading } ] = useDeactivateAPIKeyMutation();

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

	return (
		<Panel header={ __( 'API Settings', 'godam' ) } className="godam-panel">
			<PanelBody initialOpen className="flex gap-8 flex-col sm:flex-row">
				<div className="flex flex-col gap-2 b-4m">
					<PasswordFieldWithToggle
						hasValidAPIKey={ hasValidAPIKey }
						maskedAPIKey={ maskedAPIKey }
						apiKey={ apiKey }
						setAPIKey={ setAPIKey }
					/>
					<div className="flex gap-2">
						<Button
							className="godam-button godam-margin-right"
							onClick={ handleSaveAPIKey }
							icon={ isAPIKeyLoading && <Spinner /> }
							disabled={ isAPIKeyLoading || hasValidAPIKey || ! apiKey.trim() }
							variant="primary"
							isBusy={ isAPIKeyLoading }
						>
							{ isAPIKeyLoading ? __( 'Saving…', 'godam' ) : __( 'Save API Key', 'godam' ) }
						</Button>
						<Button
							className="godam-button"
							onClick={ handleDeactivateAPIKey }
							disabled={ isAPIKeyLoading || ! hasValidAPIKey }
							variant="secondary"
							isDestructive
							isBusy={ isDeactivateLoading }
						>
							{ __( 'Remove API Key', 'godam' ) }
						</Button>
					</div>
				</div>

				{ hasValidAPIKey && ( <UsageData /> ) }
			</PanelBody>
		</Panel>
	);
};

export default APISettings;
