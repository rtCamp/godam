/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Notice } from '@wordpress/components';

/**
 * Shown to a connected user when the GoDAM analytics service can't be reached
 * (server down, or it returned a microservice error). The disconnected /
 * not-yet-connected case is handled by the onboarding overlay, not here.
 *
 * @param {Object} props
 * @param {string} props.area Page area, used for the test id (e.g. 'dashboard', 'analytics').
 * @return {JSX.Element} The notice.
 */
const AnalyticsUnavailableNotice = ( { area = 'dashboard' } ) => (
	<div className="godam-analytics-unavailable" data-test-id={ `godam-${ area }-notice-analytics-unavailable` }>
		<Notice status="error" isDismissible={ false }>
			<strong>{ __( 'Analytics is temporarily unavailable.', 'godam' ) }</strong>{ ' ' }
			{ __( 'We couldn’t reach the GoDAM analytics service. This is usually temporary — please refresh in a few minutes.', 'godam' ) }
		</Notice>
	</div>
);

export default AnalyticsUnavailableNotice;
