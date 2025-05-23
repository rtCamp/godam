/**
 * WordPress dependencies
 */
import { info } from '@wordpress/icons';
import { Icon } from '@wordpress/components';

const Tooltip = ( { text } ) => {
	return (
		<span id="tooltip-container" className="tooltip-container">
			<Icon icon={ info } size={ 13 } />
			<span className="tooltip-text">{ text }</span>
		</span>
	);
};

export default Tooltip;
