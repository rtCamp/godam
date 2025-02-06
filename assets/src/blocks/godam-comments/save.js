/**
 * WordPress dependencies
 */
import {
	useBlockProps,
} from '@wordpress/block-editor';

export default function save( { attributes } ) {
	const {
		post_id,
	} = attributes;
	return (
		<div { ...useBlockProps.save() }>
			<div id="root-godam-comments" data-post_id={ post_id }></div>
		</div>
	);
}
