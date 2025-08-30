/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import edit from './edit';
import metadata from './block.json';
import { ReactComponent as icon } from '../../images/godam-gallery-filled.svg';

/**
 * Register the block
 */
registerBlockType( metadata.name, {
	...metadata,
	icon,
	edit,
	save: () => null, // Dynamic block, so save returns null
} );
