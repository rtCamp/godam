/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Icon, commentContent, external } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import './contact-support.scss';

/**
 * GoDAM helpdesk, where a site owner opens or follows a support ticket.
 *
 * @type {string}
 */
export const SUPPORT_URL = 'https://app.godam.io/helpdesk/my-tickets';

/**
 * "Contact Support" link that goes with every error message GoDAM shows to a
 * site admin, so there is always a way to reach a person.
 *
 * Deliberately plain markup (no @wordpress/components) so it renders through
 * `renderToString` in unit tests, like the analytics error components.
 *
 * @param {Object}  props
 * @param {string}  [props.variant='link'] `link` (inline text link) or `button` (outlined button).
 * @param {string}  [props.className]      Extra class names.
 * @param {string}  [props.testId]         data-test-id for the link.
 * @param {boolean} [props.showIcon]       Show the speech-bubble icon (button variant only by default).
 * @return {JSX.Element} The link.
 */
const ContactSupportLink = ( {
	variant = 'link',
	className = '',
	testId = 'godam-contact-support-link',
	showIcon = 'button' === variant,
} ) => (
	<a
		className={ `godam-contact-support godam-contact-support--${ variant } ${ className }`.trim() }
		href={ SUPPORT_URL }
		target="_blank"
		rel="noopener noreferrer"
		data-test-id={ testId }
	>
		{ showIcon && <Icon icon={ commentContent } size={ 18 } /> }
		<span>{ __( 'Contact Support', 'godam' ) }</span>
		<Icon icon={ external } size={ 14 } className="godam-contact-support__external" />
		<span className="screen-reader-text">{ __( '(opens in a new tab)', 'godam' ) }</span>
	</a>
);

export default ContactSupportLink;
