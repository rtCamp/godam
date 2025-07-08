/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';
import { addCard as icon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import edit from './edit';
import metadata from './block.json';

/**
 * Register the block
 */
registerBlockType( metadata.name, {
	...metadata,
	icon,
	edit,
	save: () => null, // Dynamic block, so save returns null
} );
