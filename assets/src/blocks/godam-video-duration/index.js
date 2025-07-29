/**
 * WordPress dependencies
 */

/**
 * Internal dependencies
 */
import initBlock from '../../utils/init-block';
import edit from './edit';
import metadata from './block.json';
import save from './save';

const { name } = metadata;

export { metadata, name };

/**
 * Block registration settings.
 */
export const settings = {
	edit,
	save,
	example: {
		viewportWidth: 350,
	},
};

export const init = () => initBlock( { name, metadata, settings } );

init();
