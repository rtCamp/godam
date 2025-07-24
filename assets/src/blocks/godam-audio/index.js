/**
 * Internal dependencies
 */
import initBlock from '../../utils/init-block';
import edit from './edit';
import metadata from './block.json';
import save from './save';
import './style.scss';
import { GodamLogo as icon } from '../common/godam-logo';

const { name } = metadata;

export { metadata, name };

export const settings = {
	icon,
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
