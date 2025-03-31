/**
 * External dependencies
 */
import { useState } from 'react';

/**
 * WordPress dependencies
 */
import { Button, Panel, PanelBody, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useDeactivateAPIKeyMutation, useVerifyAPIKeyMutation } from '../../../redux/api/media-settings.js';

import { hasValidAPIKey, maskedAPIKey, GODAM_API_BASE, scrollToTop } from '../../../utils/index.js';
import UsageData from './UsageData.jsx';

const APIKeyInput = ( { setNotice } ) => {
	const [ apiKey, setAPIKey ] = useState( hasValidAPIKey ? maskedAPIKey : '' );

	const [ verifyAPIKey, { isLoading: isAPIKeyLoading } ] = useVerifyAPIKeyMutation();
	const [ deactivateAPIKey, { isLoading: isDeactivateLoading } ] = useDeactivateAPIKeyMutation();

	const renderHelpText = () => {
		if ( ! hasValidAPIKey ) {
			return (
				<>
					{ __( 'Your API key is required to access the features. You can get your active API key from your ', 'godam' ) }
					<a href={ GODAM_API_BASE } target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
						{ __( 'Account', 'godam' ) }
					</a>.
				</>
			);
		}
		return null;
	};

	const handleSaveAPIKey = async () => {
		if ( ! apiKey.trim() ) {
			setNotice( {
				message: 'Please enter a valid API key',
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
			<PanelBody initialOpen className="flex gap-8">
				<div className="flex flex-col gap-2 b-4m">
					<TextControl
						label={ __( 'API Key', 'godam' ) }
						value={ apiKey }
						onChange={ setAPIKey }
						help={ renderHelpText() }
						placeholder="Enter your API key here"
						className={ `godam-input ${ ! hasValidAPIKey && maskedAPIKey ? 'invalid-api-key' : '' }` }
						disabled={ hasValidAPIKey }
					/>
					<div className="flex gap-2">
						<Button
							className="godam-button godam-margin-right"
							onClick={ handleSaveAPIKey }
							disabled={ isAPIKeyLoading || hasValidAPIKey }
							variant="primary"
							isBusy={ isAPIKeyLoading }
						>
							{ __( 'Save API Key', 'godam' ) }
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

export default APIKeyInput;
