/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import edit from './edit';
import metadata from './block.json';
import icon from '../../assets/images/godam-product-gallery-filled.svg';

/**
 * Register the block
 */
registerBlockType( metadata.name, {
	...metadata,
	icon: <img src={ icon } alt="GoDAM Product Gallery Block icon" />,
	edit,
	save: () => null, // Dynamic block, so save returns null
} );
