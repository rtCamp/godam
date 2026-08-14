/**
 * External dependencies
 */
import React from 'react';
/**
 * Internal dependencies
 */
import Tooltip from './Tooltip';
import { formatWatchTime } from '../utils/formatters';

import './charts.js';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

// Maps the card's metricType to the history field used for the client-side
// trend-% badge (analytics mode) and to the server-computed period-over-period
// change field on the dashboard-metrics payload (dashboard range mode).
// `total-videos` has no server change field, so its badge stays hidden.
const chartConfigMap = {
	'engagement-rate': { key: 'engagement_rate', changeKey: 'avg_engagement_change' },
	plays: { key: 'plays', changeKey: 'views_change' },
	'play-rate': { key: 'play_rate', changeKey: 'play_rate_change' },
	'watch-time': { key: 'watch_time', changeKey: 'watch_time_change' },
	'total-videos': { key: 'total_videos', changeKey: 'total_videos_change' },
};

/**
 * Format a dashboard "Insights" KPI value from the dashboard-metrics payload.
 * Mirrors the formulas ChartsDashboard.js used imperatively, so all-time and
 * range-scoped values render identically.
 *
 * @param {string} metricType One of the chartConfigMap keys.
 * @param {Object} data       dashboard_metrics object (all-time or range-scoped).
 * @return {string} Display string for the card value.
 */
function formatDashboardMetric( metricType, data ) {
	const d = data || {};
	switch ( metricType ) {
		case 'total-videos':
			return ( d.total_videos ?? 0 ).toLocaleString();
		case 'play-rate': {
			const rate = d.page_load ? ( d.plays / d.page_load ) * 100 : 0;
			return `${ rate.toFixed( 2 ) }%`;
		}
		case 'watch-time':
			return formatWatchTime( d.play_time ?? 0 );
		case 'engagement-rate':
			return `${ ( d.avg_engagement ?? 0 ).toFixed( 2 ) }%`;
		default:
			return '0';
	}
}

const SingleMetrics = ( {
	mode = 'analytics',
	metricType,
	label,
	tooltipText,
	dataLabel,
	analyticsDataFetched,
	// Dashboard range mode: when a bounded range is active the card shows the
	// server-computed period-over-period delta with this label ("vs previous
	// N days"). All-time keeps the badge hidden (there is no previous window).
	rangeActive = false,
	deltaLabel,
} ) => {
	const isDashboard = mode === 'dashboard';
	const config = chartConfigMap[ metricType ];

	// Dashboard mode renders value + a range-aware period-over-period delta from
	// props: the server nulls the *_change fields outside a bounded range, so the
	// badge appears only once a range is picked, and All Time falls back to the
	// range sub-label. Per-video (analytics) mode shows no trend badge; charts.js
	// sets the value and the bottom row is the active range sub-label, so it
	// matches the range picker and the other per-video cards.
	const dashboardValue = isDashboard
		? formatDashboardMetric( metricType, analyticsDataFetched )
		: null;
	const serverDelta =
		isDashboard && rangeActive && config && analyticsDataFetched
			? analyticsDataFetched[ config.changeKey ]
			: null;
	const hasServerDelta = serverDelta !== null && serverDelta !== undefined;

	// Only dashboard mode shows a delta badge (range-aware); per-video always
	// falls back to the range sub-label below.
	const deltaValue = isDashboard ? serverDelta : null;
	const showDelta = isDashboard ? hasServerDelta : false;
	const deltaText = deltaLabel || __( 'vs prev period', 'godam' );

	return (
		<div className="analytics-info flex justify-between max-lg:flex-col border border-zinc-200 w-full md:w-[calc(50%-0.5rem)] lg:w-full">
			<div className="analytics-single-info">
				<div className="flex justify-between items-start flex-row w-full gap-2">
					<div className="analytics-info-heading">
						<p className="text-xs text-[#525252] whitespace-nowrap">{ label }</p>
						<Tooltip text={ tooltipText } />
					</div>
				</div>
				<div className="flex flex-row justify-between gap-2 items-end">
					<div className="flex flex-col gap-3">
						<p
							id={ `${ metricType }` }
							className="min-w-[90px] single-metrics-value"
						>
							{ isDashboard ? dashboardValue : '0%' }
						</p>
						{ /* Delta on the bottom row (arrow + coloured % + muted label),
						    matching Figma, for both dashboard and per-video. Falls back
						    to the range sub-label when there is no delta to show. */ }
						{ showDelta ? (
							<div className="flex items-center gap-1.5">
								<span className={ `text-xs font-semibold ${ deltaValue >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]' }` }>
									{ `${ deltaValue >= 0 ? '↑' : '↓' } ${ Math.abs( deltaValue ).toFixed( 2 ) }%` }
								</span>
								<span className="text-[11px] text-zinc-400 whitespace-nowrap">{ deltaText }</span>
							</div>
						) : (
							<p className="text-zinc-500 text-xs">{ dataLabel || __( 'All time', 'godam' ) }</p>
						) }
					</div>
				</div>
			</div>
		</div>
	);
};

export default SingleMetrics;
