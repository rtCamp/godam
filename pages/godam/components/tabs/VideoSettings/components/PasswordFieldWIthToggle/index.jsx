/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { TextControl, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { seen, unseen } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import './style.scss';

const PasswordFieldWithToggle = ( { hasValidAPIKey, maskedAPIKey, apiKey, setAPIKey } ) => {
	const [ showPassword, setShowPassword ] = useState( false );

	// Function to render help text based on API key validity
	const renderHelpText = () => {
		if ( ! hasValidAPIKey ) {
			return (
				<>
					{ __( 'Your API key is required to access the features. You can get your active API key from your ', 'godam' ) }
					<a href={ ( window.godamRestRoute?.apiBase ?? 'https://app.godam.io' ) + '/web/my-account?accTab=API' } target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
						{ __( 'Account', 'godam' ) }
					</a>.
				</>
			);
		}
		return null;
	};

	const togglePasswordVisibility = () => {
		setShowPassword( ! showPassword );
	};

	// If API key is valid, render simple TextControl without toggle
	if ( hasValidAPIKey ) {
		return (
			<TextControl
				label={ __( 'API Key', 'godam' ) }
				value={ apiKey }
				onChange={ setAPIKey }
				help={ renderHelpText() }
				placeholder={ __( 'Enter your API key here', 'godam' ) }
				className={ `godam-input ${ ! hasValidAPIKey && maskedAPIKey ? 'invalid-api-key' : '' }` }
				disabled={ hasValidAPIKey }
				type="text"
			/>
		);
	}

	// If API key is not valid, render with password toggle
	return (
		<div className="godam-password-field-wrapper" style={ { position: 'relative' } }>
			<TextControl
				label={ __( 'API Key', 'godam' ) }
				value={ apiKey }
				onChange={ setAPIKey }
				help={ renderHelpText() }
				placeholder={ __( 'Enter your API key here', 'godam' ) }
				className={ `godam-input ${ ! hasValidAPIKey && maskedAPIKey ? 'invalid-api-key' : '' }` }
				disabled={ hasValidAPIKey }
				type={ showPassword ? 'text' : 'password' }
			/>
			<Button
				icon={ showPassword ? seen : unseen }
				onClick={ togglePasswordVisibility }
				className="godam-password-toggle"
				style={ {
					position: 'absolute',
					right: '8px',
					top: '32px',
					background: 'none',
					border: 'none',
					padding: '4px',
					minWidth: 'auto',
					height: 'auto',
				} }
				aria-label={ showPassword ? __( 'Hide password', 'godam' ) : __( 'Show password', 'godam' ) }
			/>
		</div>
	);
};

export default PasswordFieldWithToggle;
