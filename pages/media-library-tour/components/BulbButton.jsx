/**
 * "Take a tour" bulb button, rendered next to Manage Media.
 */

/**
 * WordPress dependencies
 */
import { Tooltip } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { BulbIcon } from './icons.jsx';

/**
 * @param {Object}   props
 * @param {Function} props.onClick Start / restart the tour.
 * @param {boolean}  props.pulse   Draw attention (tour never taken yet).
 * @return {JSX.Element} The button.
 */
const BulbButton = ( { onClick, pulse = false } ) => {
	const label = __( 'Take a guided tour of GoDAM Media Library features', 'godam' );

	return (
		<Tooltip text={ label } placement="bottom">
			<button
				type="button"
				className={ `button godam-ml-tour-bulb${ pulse ? ' godam-ml-tour-bulb--pulse' : '' }` }
				aria-label={ label }
				onClick={ onClick }
				data-test-id="godam-ml-tour-bulb"
			>
				<BulbIcon />
			</button>
		</Tooltip>
	);
};

export default BulbButton;
