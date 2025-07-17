/**
 * WordPress dependencies
 */
import { Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * AJAX Warning Component
 *
 * Reusable component that displays a warning message about AJAX submission requirement
 * for forms in the video editor to prevent page reload on form submission.
 */
const AjaxWarning = () => {
	return (
		<Notice
			className="mb-4"
			status="info"
			isDismissible={ false }
		>
			{ __( '⚠️ AJAX submission is required to prevent the form from reloading the video page on submit. Make sure it\'s enabled in your form settings.', 'godam' ) }
		</Notice>
	);
};

export default AjaxWarning;
