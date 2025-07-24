/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import edit from './edit';
import metadata from './block.json';
import { GodamLogo } from '../common/godam-logo';
/**
 * Register the block
 */
registerBlockType( metadata.name, {
	...metadata,
	icon: GodamLogo,
	edit,
	save: () => null, // Dynamic block, so save returns null
} );
