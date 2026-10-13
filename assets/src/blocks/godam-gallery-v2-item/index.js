/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';
import { video as videoIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import Edit from './edit';
import metadata from './block.json';

registerBlockType( metadata.name, {
	...metadata,
	icon: videoIcon,
	edit: Edit,
	save: () => null,
} );
