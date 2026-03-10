/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import icon from '../../assets/images/godam-reel-pops-filled.svg';
import Edit from './edit';
import metadata from './block.json';
import './style.scss';
import './editor.scss';

/**
 * Register block.
 */
registerBlockType( metadata.name, {
	...metadata,
	icon: <img src={ icon } alt="GoDAM Reel Pops Block icon" />,
	edit: Edit,
	save: () => null, // Dynamic block
} );
