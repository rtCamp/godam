/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
import { error } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { buildSettingsUrl } from '../../utils/formUtils';

const AjaxWarning = ( { formType, formId } ) => {
	const settingsUrl = buildSettingsUrl( formType, formId );

	return (
		<p className="text-sm text-gray-500 mb-4">
			<Icon icon={ error } className="w-5 h-5 inline mr-1" style={ { fill: '#EAB308', verticalAlign: 'text-bottom' } } />
			{ __( 'AJAX submission is required to prevent the form from reloading the video page on submit. ', 'godam' ) }
			{ __( 'Make sure it\'s enabled in your', 'godam' ) }
			{ ' ' }
			<a
				href={ settingsUrl }
				target="_blank"
				rel="noopener noreferrer"
				style={ { color: '#007cba', textDecoration: 'underline' } }
			>
				{ __( 'form settings', 'godam' ) }
			</a>
			{ '.' }
		</p>
	);
};

export default AjaxWarning;
