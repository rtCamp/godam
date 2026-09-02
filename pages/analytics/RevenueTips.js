/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { formatRevenue } from '../dashboard/components/TopProductsTable';

/**
 * Comparative revenue tips for the single-video Analytics page (WooCommerce only).
 *
 * The service computes each comparison and a `*_favourable` flag; this renders a
 * tip ONLY when its flag is set, so an unfavourable or absent comparison shows
 * nothing (never a discouraging "below average" line). Amounts use the shipped
 * formatRevenue in the store's base currency.
 *
 * @param {Object} props        Component props.
 * @param {Object} [props.tips] The tips payload from the service, or null.
 * @return {JSX.Element|null} The tips banner, or null when there is nothing to say.
 */
export default function RevenueTips( { tips } ) {
	if ( ! tips ) {
		return null;
	}

	const messages = [];
	if ( tips.aov_favourable ) {
		messages.push(
			sprintf(
				/* translators: 1: this video's average order value, 2: the store's average order value. */
				__( 'This video’s average order value (%1$s) beats your store average (%2$s).', 'godam' ),
				formatRevenue( tips.video_aov_minor, tips.currency ),
				formatRevenue( tips.store_aov_minor, tips.currency ),
			),
		);
	}
	if ( tips.revenue_per_session_favourable ) {
		messages.push(
			sprintf(
				/* translators: %s: revenue earned per viewer, formatted with the currency. */
				__( 'This video earns %s in revenue per viewer.', 'godam' ),
				formatRevenue( tips.revenue_per_session_minor, tips.currency ),
			),
		);
	}

	if ( ! messages.length ) {
		return null;
	}

	return (
		<div
			className="godam-revenue-tips rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
			data-test-id="godam-revenue-tips"
		>
			{ messages.map( ( message, i ) => (
				<p key={ i } className="m-0">{ message }</p>
			) ) }
		</div>
	);
}
