/**
 * Internal dependencies
 */
import Tooltip from './Tooltip';
import { formatRevenue } from '../dashboard/components/TopProductsTable';

/**
 * WordPress dependencies
 */
import { __, sprintf, _n } from '@wordpress/i18n';

/**
 * Revenue KPI card for the dashboard Insights row (WooCommerce only).
 *
 * GoDAM commits to a single store currency: this shows total video-attributed
 * revenue in the store's base currency, summing only orders placed in that
 * currency. Orders in other currencies are not converted; when there are any, a
 * sub-line reports how many were left out, e.g. "excluding 33 orders in other
 * currencies". A single-currency store (the common case) excludes nothing and
 * shows just the figure.
 *
 * @param {Object} props
 * @param {Object} [props.revenue]   The revenue payload: { revenue_minor, currency, excluded_orders }.
 * @param {string} [props.dataLabel] The active range label (e.g. "All time").
 */
export default function RevenueCard( { revenue, dataLabel } ) {
	// Absent payload (an analytics service that predates the revenue read, or a
	// non-Woo store where no base currency is passed) -> render nothing, so the
	// card never asserts a misleading "0" for "metric unavailable". A present
	// payload with a real 0 still renders.
	if ( revenue === null || revenue === undefined ) {
		return null;
	}

	const minor = Number( revenue.revenue_minor || 0 );
	const currency = revenue.currency || '';
	const excluded = Number( revenue.excluded_orders || 0 );

	return (
		<div
			className="analytics-info flex justify-between max-lg:flex-col border border-zinc-200 w-full md:w-[calc(50%-0.5rem)] lg:w-full"
			data-test-id="godam-revenue-card"
		>
			<div className="analytics-single-info">
				<div className="flex justify-between items-start flex-row w-full gap-2">
					<div className="analytics-info-heading">
						<p className="text-xs text-[#525252] whitespace-nowrap" data-test-id="godam-revenue-label">{ __( 'Revenue', 'godam' ) }</p>
						{ /* WooCommerce badge (per Figma): the metric comes from store data. */ }
						<span
							className="text-[10px] font-semibold leading-none px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9]"
							data-test-id="godam-revenue-woo-tag"
						>
							Woo
						</span>
						<Tooltip
							text={ __(
								'Total video-attributed revenue in the store\'s base currency. Orders placed in other currencies are not converted, so they are excluded from this total and counted separately.',
								'godam',
							) }
						/>
					</div>
				</div>
				<div className="flex flex-row justify-between gap-2 items-end">
					<div className="flex flex-col gap-2">
						<div className="flex flex-row items-baseline gap-2">
							<p className="single-metrics-value" data-test-id="godam-revenue-value">{ formatRevenue( minor, currency ) }</p>
						</div>
						{ excluded > 0 && (
							<span className="text-xs text-zinc-500" data-test-id="godam-revenue-excluded">
								{ sprintf(
									/* translators: %s: number of orders placed in other currencies, not included in the total. */
									_n(
										'excluding %s order in other currencies',
										'excluding %s orders in other currencies',
										excluded,
										'godam',
									),
									excluded.toLocaleString(),
								) }
							</span>
						) }
						<span className="text-[11px] text-zinc-400">{ dataLabel || __( 'All time', 'godam' ) }</span>
					</div>
				</div>
			</div>
		</div>
	);
}
