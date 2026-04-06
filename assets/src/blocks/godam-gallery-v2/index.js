/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable import/no-unresolved */

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
import './style.scss';

registerBlockType( metadata.name, {
	...metadata,
	icon: galleryIcon,
	edit: Edit,
	save: () => <InnerBlocks.Content />,
} );
