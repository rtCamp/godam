/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import './analytics-unavailable.scss';

/**
 * Inline error for a SINGLE analytics section (the gauge, the Insights KPIs, or
 * the WooCommerce cards) when its range-scoped request fails or the service
 * reports those sections unavailable. Unlike AnalyticsUnavailableNotice (a
 * page-wide banner for a total outage), this is scoped: the rest of the
 * dashboard keeps rendering. We surface it instead of letting the affected
 * cards silently vanish or read a fake "0".
 *
 * Deliberately plain markup (no @wordpress/components) so it renders through
 * `renderToString` in unit tests, matching the other analytics card components.
 *
 * @param {Object}   props
 * @param {Function} [props.onRetry] Called when the viewer clicks "Try again"; omit to hide the action.
 * @param {string}   [props.message] Override the default message.
 * @param {string}   [props.testId]  data-test-id for the wrapper.
 * @return {JSX.Element} The scoped error.
 */
const AnalyticsSectionError = ( {
	onRetry,
	message = __( 'These metrics couldn’t load. This is usually temporary.', 'godam' ),
	testId = 'godam-analytics-section-error',
} ) => (
	<div
		className="godam-analytics-section-error"
		data-test-id={ testId }
		role="alert"
	>
		<span className="godam-analytics-section-error__message">{ message }</span>
		{ onRetry && (
			<button
				type="button"
				className="godam-analytics-section-error__retry"
				onClick={ onRetry }
			>
				{ __( 'Try again', 'godam' ) }
			</button>
		) }
	</div>
);

export default AnalyticsSectionError;
