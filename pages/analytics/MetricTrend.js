/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * The bottom row of a metric card: a period-over-period trend badge when there is
 * a change to show, otherwise the active range sub-label. Matches the SingleMetrics
 * badge (green up / red down arrow, coloured %, muted "vs prev" label) so every
 * card reads the same.
 *
 * The server only sends a `change` on a fully bounded range (all-time and
 * open-ended ranges have no comparison window), so the badge appears only then and
 * the card falls back to the range label otherwise.
 *
 * @param {Object}      props
 * @param {number|null} [props.change]     Percentage change vs the previous window, or null/undefined for none.
 * @param {string}      [props.deltaLabel] Label beside the badge, e.g. "vs previous 7 days".
 * @param {string}      [props.dataLabel]  Fallback range label, e.g. "All time".
 * @param {string}      [props.testId]     Optional data-test-id for the badge.
 */
export default function MetricTrend( { change, deltaLabel, dataLabel, testId } ) {
	const hasChange = change !== null && change !== undefined;

	if ( ! hasChange ) {
		// No comparison window: show the range label if the caller wants one (the
		// KPI tiles do), otherwise render nothing (the revenue card supplies its own
		// "before refunds" line beside this).
		return dataLabel ? (
			<span className="text-[11px] text-zinc-400">{ dataLabel }</span>
		) : null;
	}

	// Exactly 0% is flat, not growth: render it neutral (grey, flat arrow) so a
	// static metric is never shown as green upward movement.
	let trendColor = 'text-zinc-500';
	let trendArrow = '→';
	if ( change > 0 ) {
		trendColor = 'text-[#15803D]';
		trendArrow = '↗';
	} else if ( change < 0 ) {
		trendColor = 'text-[#B91C1C]';
		trendArrow = '↘';
	}

	return (
		<div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5" data-test-id={ testId }>
			<span className={ `text-xs font-semibold whitespace-nowrap ${ trendColor }` }>
				{ `${ trendArrow } ${ Math.abs( change ).toFixed( 2 ) }%` }
			</span>
			<span className="text-[11px] text-zinc-400 whitespace-nowrap">
				{ deltaLabel || __( 'vs prev period', 'godam' ) }
			</span>
		</div>
	);
}
