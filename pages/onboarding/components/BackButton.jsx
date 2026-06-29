/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { ChevronLeftIcon } from './icons';

/**
 * Shared "‹ BACK" control used by the auth screens.
 *
 * @param {Object}   props         Props.
 * @param {Function} props.onClick Click handler (usually a goToStep dispatch).
 */
const BackButton = ( { onClick } ) => (
	<button type="button" className="godam-onboarding__back" onClick={ onClick } data-test-id="godam-onboarding-button-back">
		<ChevronLeftIcon /> { __( 'BACK', 'godam' ) }
	</button>
);

export default BackButton;
