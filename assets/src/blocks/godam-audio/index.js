/**
 * Internal dependencies
 */
import initBlock from '../../utils/init-block';
import edit from './edit';
import metadata from './block.json';
import save from './save';
import './style.scss';
import icon from '../../images/godam-audio-filled.svg';

const { name } = metadata;

export { metadata, name };

/**
 * Block registration settings.
 */
export const settings = {
	icon: <img src={ icon } alt="" />,
	example: {
		attributes: {
			src: 'https://upload.wikimedia.org/wikipedia/commons/d/dd/Armstrong_Small_Step.ogg',
		},
		viewportWidth: 350,
	},
	edit,
	save,
};

export const init = () => initBlock( { name, metadata, settings } );

init();
