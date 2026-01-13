/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import edit from './edit';
import metadata from './block.json';
import icon from '../../images/godam-gallery-filled.svg';

/**
 * Register the block
 */
registerBlockType( metadata.name, {
	...metadata,
	icon: <img src={ icon } alt="" />,
	edit,
	save: () => null, // Dynamic block, so save returns null
} );
