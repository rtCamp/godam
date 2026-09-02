/**
 * Internal dependencies
 */
import Tooltip from './Tooltip';
import MetricTrend from './MetricTrend';
import { formatRevenue } from '../dashboard/components/TopProductsTable';

/**
 * WordPress dependencies
 */
import { __, sprintf, _n } from '@wordpress/i18n';

// Direct = added to cart in-video (dark blue); Assisted = clicked through, then
// bought (light blue). Same palette as the Purchase Funnel so the two read as one
// system.
const COLOR_DIRECT = '#2563eb';
const COLOR_ASSISTED = '#93c5fd';

/**
 * Video-Attributed Revenue card (WooCommerce only).
 *
 * Shows total video-attributed revenue in the store's single base currency, split
 * into Direct (added to cart in-video) and Assisted (clicked through to the product
 * page, then bought). Orders placed in other currencies are not converted; when
 * there are any, a sub-line reports how many were left out. On the account-wide
 * dashboard a separate Influenced figure is shown too (bought on a product page
 * after playing its video, with no click), reported on its own and never added to
 * the Direct + Assisted total. Influenced is a product-page concept, so it is not
 * shown per video (the payload omits it there).
 *
 * @param {Object} props
 * @param {Object} [props.revenue]    { revenue_minor, currency, excluded_orders, direct_minor, assisted_minor, influenced_minor, change }.
 * @param {string} [props.dataLabel]  The active range label (e.g. "All time").
 * @param {string} [props.deltaLabel] Label for the trend badge, e.g. "vs previous 7 days".
 */
export default function RevenueCard( { revenue, dataLabel, deltaLabel } ) {
	// Absent payload (an analytics service that predates the revenue read, or a
	// non-Woo store where no base currency is passed) -> render nothing, so the
	// card never asserts a misleading "0" for "metric unavailable". A present
	// payload with a real 0 still renders.
	if ( revenue === null || revenue === undefined ) {
		return null;
	}

	// null-not-zero: a payload whose revenue_minor is null/undefined means "no
	// revenue-bearing row" (the service's sentinel), so hide rather than render a
	// misleading "0". A real measured 0 (numeric) still renders. This also guards
	// the per-video page, which always builds the payload object inline and so
	// cannot rely on the whole-prop null check above.
	if ( revenue.revenue_minor === null || revenue.revenue_minor === undefined ) {
		return null;
	}

	const currency = revenue.currency || '';
	const excluded = Number( revenue.excluded_orders || 0 );
	const direct = Number( revenue.direct_minor || 0 );
	const assisted = Number( revenue.assisted_minor || 0 );
	const splitTotal = direct + assisted;
	// When the Direct/Assisted split is present, the headline is their sum, so the
	// total always equals the parts shown beneath it. Every paid order line carries
	// a tier, so this can never hide revenue; without a split, use the service total.
	const hasSplit =
		revenue.direct_minor !== undefined &&
		revenue.direct_minor !== null &&
		revenue.assisted_minor !== undefined &&
		revenue.assisted_minor !== null;
	const total = hasSplit ? splitTotal : Number( revenue.revenue_minor || 0 );
	const directFrac = splitTotal > 0 ? ( direct / splitTotal ) * 100 : 0;
	const assistedFrac = splitTotal > 0 ? ( assisted / splitTotal ) * 100 : 0;

	// Influenced is account-level (dashboard only); the per-video payload omits the
	// key, so the box is hidden there rather than showing a misleading 0.
	const hasInfluenced =
		revenue.influenced_minor !== undefined && revenue.influenced_minor !== null;
	const influenced = Number( revenue.influenced_minor || 0 );

	return (
		<div className="godam-card godam-revenue-card" data-test-id="godam-revenue-card">
			<div className="godam-card__head">
				<div className="flex items-center gap-2.5">
					<h2>{ __( 'Video-Attributed Revenue', 'godam' ) }</h2>
					<span className="text-[10px] font-semibold leading-none px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9]" data-test-id="godam-revenue-woo-tag">Woo</span>
					<span className="text-[10px] font-bold leading-none px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] tracking-wide">{ __( 'NEW', 'godam' ) }</span>
					<Tooltip
						text={ __(
							'Order value traced back to the video that earned it, in the store\'s base currency. Direct means added to cart inside the video; Assisted means the shopper clicked through to the product page and bought there. Orders in other currencies are counted separately, not converted. Shown before refunds.',
							'godam',
						) }
					/>
				</div>
				{ dataLabel && (
					<span className="text-[13px] text-[#50575e] border border-[#e2e4e7] rounded-md px-3 py-1">{ dataLabel }</span>
				) }
			</div>

			<div className="flex gap-6 max-lg:flex-col">
				{ /* Left: headline total + Direct/Assisted split. */ }
				<div className="flex-1 min-w-0">
					<p className="text-4xl font-bold text-[#1e1e1e] leading-none" data-test-id="godam-revenue-value">{ formatRevenue( total, currency ) }</p>
					<div className="flex items-center flex-wrap gap-x-1.5 mt-2 text-[13px] text-zinc-500">
						<MetricTrend change={ revenue.change } deltaLabel={ deltaLabel } testId="godam-revenue-trend" />
						{ revenue.change !== null && revenue.change !== undefined && (
							<span className="text-zinc-400">·</span>
						) }
						<span>
							{ excluded > 0
								? sprintf(
									/* translators: %s: number of orders placed in other currencies, not included in the total. */
									_n(
										'before refunds · excluding %s order in other currencies',
										'before refunds · excluding %s orders in other currencies',
										excluded,
										'godam',
									),
									excluded.toLocaleString(),
								)
								: __( 'before refunds', 'godam' ) }
						</span>
					</div>

					{ /* Split bar: Direct + Assisted, summing to the base total. */ }
					<div className="flex h-2.5 w-full rounded-full overflow-hidden bg-zinc-100 mt-4" data-test-id="godam-revenue-split-bar">
						<div style={ { width: `${ directFrac }%`, background: COLOR_DIRECT } } />
						<div style={ { width: `${ assistedFrac }%`, background: COLOR_ASSISTED } } />
					</div>

					<div className="flex flex-col gap-2 mt-4">
						<div className="flex items-center justify-between gap-4">
							<span className="flex items-center gap-2 text-[13px] text-zinc-600">
								<span className="w-3 h-3 rounded-sm" style={ { background: COLOR_DIRECT } } />
								{ __( 'Direct · added to cart in-video', 'godam' ) }
							</span>
							<span className="text-[14px] font-semibold text-[#1e1e1e]" data-test-id="godam-revenue-direct">{ formatRevenue( direct, currency ) }</span>
						</div>
						<div className="flex items-center justify-between gap-4">
							<span className="flex items-center gap-2 text-[13px] text-zinc-600">
								<span className="w-3 h-3 rounded-sm" style={ { background: COLOR_ASSISTED } } />
								{ __( 'Assisted · clicked through, then bought', 'godam' ) }
							</span>
							<span className="text-[14px] font-semibold text-[#1e1e1e]" data-test-id="godam-revenue-assisted">{ formatRevenue( assisted, currency ) }</span>
						</div>
					</div>
				</div>

				{ /* Right: Influenced, reported separately (dashboard only). */ }
				{ hasInfluenced && (
					<div className="lg:w-[34%] rounded-lg border border-dashed border-zinc-300 p-4" data-test-id="godam-revenue-influenced">
						<div className="flex items-center gap-1.5">
							<span className="text-[13px] text-zinc-500">{ __( 'Influenced', 'godam' ) }</span>
							<Tooltip
								text={ __(
									'Bought on a product page after playing its video, with no click to prove the video caused the sale. Worked out at the product level, shown on its own, and never added to the Direct + Assisted figure.',
									'godam',
								) }
							/>
						</div>
						<p className="text-2xl font-bold text-[#1e1e1e] mt-1" data-test-id="godam-revenue-influenced-value">{ formatRevenue( influenced, currency ) }</p>
						<p className="text-[12px] text-zinc-500 mt-2 leading-snug">
							{ __( 'Bought on a product page after playing its video. Reported separately because there is no click-through to prove intent, so it is not added to the figure on the left.', 'godam' ) }
						</p>
					</div>
				) }
			</div>
		</div>
	);
}
