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

/**
 * PasswordFieldWithToggle component
 *
 * @param {Object}   param0                - Props passed to the PasswordFieldWithToggle component.
 * @param {boolean}  param0.hasValidAPIKey - Indicates if the API key is valid.
 * @param {string}   param0.maskedAPIKey   - The masked version of the API key.
 * @param {string}   param0.apiKey         - The current API key value.
 * @param {Function} param0.setAPIKey      - Function to update the API key value.
 *
 * @return {JSX.Element} the rendered component.
 */
const PasswordFieldWithToggle = ( { hasValidAPIKey, maskedAPIKey, apiKey, setAPIKey } ) => {
	const [ showPassword, setShowPassword ] = useState( false );

	/**
	 * Function to render help text based on the API key validity.
	 *
	 * @return {JSX.Element|null} Returns help text if API key is not valid, otherwise null.
	 */
	const renderHelpText = () => {
		if ( ! hasValidAPIKey ) {
			return (
				<>
					{ __( 'Your API key is required to access the features. You can get your active API key from your', 'godam' ) }
					{ ' ' }
					<a href={ ( window.godamRestRoute?.apiBase ?? 'https://app.godam.io' ) + '/web/billing?tab=API' } target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
						{ __( 'Account', 'godam' ) }
					</a>.
				</>
			);
		}
		return null;
	};

	/**
	 * Renders the TextControl component with shared props
	 *
	 * @param {string} inputType - The input type ('text' or 'password')
	 * @return {JSX.Element} The TextControl component
	 */
	const renderTextControl = ( inputType = 'text' ) => (
		<TextControl
			label={ __( 'API Key', 'godam' ) }
			value={ apiKey }
			onChange={ setAPIKey }
			help={ renderHelpText() }
			placeholder={ __( 'Enter your API key here', 'godam' ) }
			className={ `godam-input godam-input__api-key ${ ! hasValidAPIKey && maskedAPIKey ? 'invalid-api-key' : '' }` }
			disabled={ hasValidAPIKey }
			type={ inputType }
		/>
	);

	// If API key is valid, render simple TextControl without toggle
	if ( hasValidAPIKey ) {
		return renderTextControl();
	}

	// If API key is not valid, render with password toggle
	return (
		<div className="godam-password-field-wrapper">
			{ renderTextControl( showPassword ? 'text' : 'password' ) }
			<Button
				icon={ showPassword ? seen : unseen }
				onClick={ () => setShowPassword( ! showPassword ) }
				className="godam-password-toggle"
				aria-label={ showPassword ? __( 'Hide password', 'godam' ) : __( 'Show password', 'godam' ) }
			/>
		</div>
	);
};

export default PasswordFieldWithToggle;
