/**
 * WordPress dependencies
 */
import {
	useBlockProps,
	InnerBlocks,
} from '@wordpress/block-editor';

export default function save() {
	// Since we're using server-side rendering (render.php),
	// we only need to save the InnerBlocks content
	return (
		<div { ...useBlockProps.save() }>
			<InnerBlocks.Content />
		</div>
	);
}
