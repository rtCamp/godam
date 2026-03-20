/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';
import { gallery as galleryIcon } from '@wordpress/icons';
import { InnerBlocks } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import Edit from './edit';
import metadata from './block.json';
import './editor.scss';

/**
 * Register the block
 */
registerBlockType( metadata.name, {
	...metadata,
	icon: galleryIcon,
	edit: Edit,
	save: () => <InnerBlocks.Content />,
} );
