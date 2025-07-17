/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

const AjaxWarning = ( { formType, formId } ) => {
	// Helper function to extract post ID from Jetpack form ID
	const getPostIdFromFormId = ( currentFormId ) => {
		if ( ! currentFormId ) {
			return null;
		}
		// Form ID format is "postId-formNumber" (e.g., "123-1")
		const parts = currentFormId.split( '-' );
		return parts[ 0 ] ? parseInt( parts[ 0 ] ) : null;
	};

	// Define settings URLs for each form plugin
	const getSettingsUrl = () => {
		const adminUrl = window?.videoData?.adminUrl || '';

		switch ( formType ) {
			case 'wpforms':
				return `${ adminUrl }admin.php?page=wpforms-builder&view=settings&form_id=${ formId }&section=general`;
			case 'gravity':
				return `${ adminUrl }admin.php?subview=confirmation&page=gf_edit_forms&id=${ formId }&view=settings`;
			case 'cf7':
				return `${ adminUrl }admin.php?page=wpcf7&post=${ formId }&action=edit`;
			case 'fluentforms':
				return `${ adminUrl }admin.php?page=fluent_forms&form_id=${ formId }&route=settings&sub_route=form_settings`;
			case 'everestforms':
				return `${ adminUrl }admin.php?page=evf-builder&view=fields&form_id=${ formId }&tab=settings`;
			case 'forminator':
				return `${ adminUrl }admin.php?page=forminator-cform-wizard&id=${ formId }`;
			case 'sureforms':
				return `${ adminUrl }post.php?post=${ formId }&action=edit`;
			case 'jetpack':
				const postId = getPostIdFromFormId( formId );
				if ( ! postId ) {
					return `${ adminUrl }admin.php?page=jetpack-forms-admin#/responses`;
				}
				// Return URL to edit the post/page in block editor
				return `${ adminUrl }post.php?post=${ postId }&action=edit`;
			default:
				return '#';
		}
	};

	const settingsUrl = getSettingsUrl();

	return (
		<p className="text-sm text-gray-500 mb-4">
			{ __( '⚠️ AJAX submission is required to prevent the form from reloading the video page on submit. ', 'godam' ) }
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
			{ __( '.', 'godam' ) }
		</p>
	);
};

export default AjaxWarning;
