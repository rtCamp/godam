/**
 * WordPress dependencies
 */
import { video as icon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import initBlock from '../../utils/init-block';
import edit from './edit';
import metadata from './block.json';
import save from './save';
import './style.scss';

const { name } = metadata;

export { metadata, name };

export const settings = {
	icon,
	edit,
	save,
};

export const init = () => initBlock( { name, metadata, settings } );

init();
