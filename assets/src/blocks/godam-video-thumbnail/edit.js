/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useBlockProps } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import './editor.scss';

function Edit() {
	const blockProps = useBlockProps(
		{
			className: 'godam-editor-video-item',
		},
	);

	return (
		<div { ...blockProps }>
			<div className="godam-editor-video-thumbnail">
				<span className="godam-editor-video-label">
					{ __( 'GoDAM Video Thumbnail', 'godam' ) }
				</span>
			</div>
		</div>
	);
}

export default Edit;
