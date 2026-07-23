/**
 * Internal dependencies
 */
import initBlock from '../../utils/init-block';
import edit from './edit';
import metadata from './block.json';
import save from './save';
import icon from '../../images/godam-image-filled.svg';
import './style.scss';

const { name } = metadata;

export { metadata, name };

/**
 * Block registration settings.
 */
export const settings = {
	// Block inserter icons are decorative — keep it out of the a11y tree.
	icon: <img src={ icon } alt="" aria-hidden="true" />,
	edit,
	save,
};

export const init = () => initBlock( { name, metadata, settings } );

init();
