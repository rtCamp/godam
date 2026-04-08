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
import icon from '../../images/godam-gallery-filled.svg';
import './style.scss';

registerBlockType( metadata.name, {
	...metadata,
	icon: <img src={ icon } alt="GoDAM Gallery Block icon" />,
	edit: Edit,
	save: () => <InnerBlocks.Content />,
} );
