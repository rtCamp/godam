/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';
import { InnerBlocks } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import Edit from './edit';
import metadata from './block.json';
import icon from '../../../images/godam-product-gallery-filled.svg';
import './style.scss';
import './editor.scss';

/**
 * Register the block
 */
registerBlockType( metadata.name, {
	...metadata,
	icon: <img src={ icon } alt="GoDAM Video Product Gallery Block icon" />,
	edit: Edit,
	save: () => <InnerBlocks.Content />,
} );
