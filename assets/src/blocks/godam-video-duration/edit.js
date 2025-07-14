/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
} from '@wordpress/block-editor';

function Edit( {} ) {
	const blockProps = useBlockProps();

	return (
		<>
			<div { ...blockProps }>
				<h1>{ __( 'Video Duration', 'godam' ) }</h1>
			</div>
		</>
	);
}

export default Edit;
