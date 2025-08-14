/**
 * WordPress dependencies
 */
import {
	useBlockProps,
	InnerBlocks,
} from '@wordpress/block-editor';

/**
 * The save function for the GoDAM player block.
 *
 * @return {JSX.Element} The saved content of the block.
 */
export default function save() {
	// Since we're using server-side rendering (render.php),
	// we only need to save the InnerBlocks content.
	return (
		<div { ...useBlockProps.save() }>
			<InnerBlocks.Content />
		</div>
	);
}
