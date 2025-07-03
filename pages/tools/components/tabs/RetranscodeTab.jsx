/**
 * External dependencies
 */

/**
 * WordPress dependencies
 */
import {
	Button,
	Panel,
	PanelBody,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

const RetranscodeTab = () => {
	const mediaPageUrl = `${ window.godamRestRoute?.adminUrl || '/wp-admin/' }upload.php`;

	const message = sprintf(
		// translators: %s is the URL to the Media page in the WordPress admin.
		__(
			"You can retranscode specific media files (rather than ALL media) from the <a class='godam-url' href='%s'>Media</a> page using Bulk Action via drop down or mouse hover a specific media (audio/video) file.",
			'godam',
		),
		mediaPageUrl,
	);

	return (
		<>
			<Panel header={ __( 'Retranscode Media', 'godam' ) } className="godam-panel">
				<PanelBody opened>
					<p>
						{ __( 'This tool will retranscode ALL audio/video media uploaded to your website. This can be handy if you need to transcode media files uploaded in the past. Sending your entire media library for retranscoding can consume a lot of your bandwidth allowance, so use this tool with care.', 'godam' ) }
					</p>
					<p dangerouslySetInnerHTML={ { __html: message } } />
					<p>
						{ __( 'To begin, just press the button below.', 'godam' ) }
					</p>

					<Button
						isPrimary
						className="godam-button"
					>{ __( 'Retranscode all media', 'godam' ) }</Button>
				</PanelBody>
			</Panel>
		</>
	);
};

export default RetranscodeTab;
