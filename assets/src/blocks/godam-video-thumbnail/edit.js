/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useBlockProps } from '@wordpress/block-editor';

function Edit() {
	const blockProps = useBlockProps();

	return (
		<div { ...blockProps }>
			<p>{ __( 'GoDAM Video Thumbnail Placeholder', 'godam' ) }</p>
		</div>
	);
}

export default Edit;
