/**
 * WordPress dependencies
 */
import { TextControl, Icon } from '@wordpress/components';
import { check, warning } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import './style.scss';
import { API_KEY_STATUS } from '../../../../../../shared/enums';

/**
 * API Key input field.
 *
 * Renders the API key text input with contextual help text. The copy / remove
 * actions live in the parent (APISettings) so they can sit beside the field.
 *
 * @param {Object}   param0                 - Props.
 * @param {boolean}  param0.hasValidAPIKey  - Indicates if the API key is valid.
 * @param {boolean}  param0.hasAPIKey       - Indicates if any API key exists (valid or invalid).
 * @param {string}   param0.apiKey          - The current API key value.
 * @param {Function} param0.setAPIKey       - Function to update the API key value.
 * @param {string}   param0.apiKeyStatus    - The current status of the API key.
 * @param {string}   param0.validationError - Inline error message to show below the field.
 *
 * @return {JSX.Element} the rendered component.
 */
const PasswordFieldWithToggle = ( { hasValidAPIKey, hasAPIKey, apiKey, setAPIKey, apiKeyStatus, validationError } ) => {
	/**
	 * Render the help text based on the API key state.
	 *
	 * @return {JSX.Element|null} Help text node, or null.
	 */
	const renderHelpText = () => {
		const accountLink = () => {
			return (
				<>
					{ ' ' }
					<a href={ ( window.godamRestRoute?.apiBase ?? 'https://app.godam.io' ) + '/web/billing?tab=API' } target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
						{ __( 'Account', 'godam' ) }
					</a>.
				</>
			);
		};

		if ( validationError ) {
			return (
				<span className="invalid-api-key godam-api-key-msg">
					<Icon icon={ warning } size={ 18 } />
					<span>{ validationError }</span>
				</span>
			);
		}

		if ( ! hasAPIKey ) {
			return (
				<>
					{ __( 'Your API key is required to access the features. You can get your active API key from', 'godam' ) }
					{ accountLink() }
				</>
			);
		}

		if ( hasValidAPIKey ) {
			return (
				<span className="valid-api-key godam-api-key-msg">
					<Icon icon={ check } size={ 18 } />
					<span>{ __( 'API key verified', 'godam' ) }</span>
				</span>
			);
		}

		if ( apiKeyStatus === API_KEY_STATUS.EXPIRED ) {
			return (
				<span className="invalid-api-key godam-api-key-msg">
					<Icon icon={ warning } size={ 18 } />
					<span>
						{ __( 'Your API Key has expired. You can renew it from your', 'godam' ) }
						{ accountLink() }
					</span>
				</span>
			);
		}

		if ( apiKeyStatus === API_KEY_STATUS.VERIFICATION_FAILED ) {
			return (
				<span className="invalid-api-key godam-api-key-msg">
					<Icon icon={ warning } size={ 18 } />
					<span>{ __( 'Unable to verify API key. Please click "Refresh Status" to try again.', 'godam' ) }</span>
				</span>
			);
		}

		return null;
	};

	return (
		<TextControl
			label={ __( 'API Key', 'godam' ) }
			value={ apiKey }
			onChange={ setAPIKey }
			help={ renderHelpText() }
			placeholder={ __( 'Enter your API key here', 'godam' ) }
			className={ `godam-input__api-key godam-form-group ${ ( validationError || ( hasAPIKey && ! hasValidAPIKey ) ) ? 'invalid-api-key' : '' }` }
			disabled={ hasAPIKey }
			type="text"
		/>
	);
};

export default PasswordFieldWithToggle;
