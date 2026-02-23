/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';
import { inbox as icon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import Edit from './edit';
import metadata from './block.json';
import './style.scss';
import './editor.scss';

/**
 * Register block.
 */
registerBlockType( metadata.name, {
	...metadata,
	icon,
	edit: Edit,
	save: () => null, // Dynamic block
} );
