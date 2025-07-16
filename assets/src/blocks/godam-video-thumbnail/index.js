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

/**
 * Block registration settings.
 */
export const settings = {
	icon,
	edit,
	save,
	example: {
		viewportWidth: 350,
	},
};

export const init = () => initBlock( { name, metadata, settings } );

init();
