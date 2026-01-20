/**
 * Internal dependencies
 */
import initBlock from '../../utils/init-block';
import edit from './edit';
import metadata from './block.json';
import save from './save';
import './style.scss';
import { ReactComponent as icon } from '../../images/godam-pdf.svg';

const { name } = metadata;

export { metadata, name };

/**
 * Block registration settings.
 */
export const settings = {
	icon,
	edit,
	save,
};

initBlock( { name, metadata, settings } );
