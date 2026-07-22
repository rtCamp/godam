/**
 * External dependencies
 */
import React, { useEffect } from 'react';
/**
 * Internal dependencies
 */
import Tooltip from './Tooltip';
import {
	calculateEngagementRate,
	calculatePlayRate,
	ensureAll7Days,
	calculateTrendPercentage,
} from './helper';
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
	processedAnalyticsHistory,
	analyticsDataFetched,
	// Dashboard range mode: when a bounded range is active the card shows the
	// server-computed period-over-period delta with this label ("vs previous
	// N days"). All-time keeps the badge hidden (there is no previous window).
	rangeActive = false,
	deltaLabel,
} ) => {
	const isDashboard = mode === 'dashboard';
	const config = chartConfigMap[ metricType ];

	// Dashboard mode renders value + delta reactively from props (range-aware).
	// The server nulls the *_change fields outside a bounded range, so the
	// badge only appears once a range is picked. Analytics (per-video) mode is
	// unchanged: charts.js sets the value and the effect below writes a
	// client-side trend badge.
	const dashboardValue = isDashboard
		? formatDashboardMetric( metricType, analyticsDataFetched )
		: null;
	const serverDelta =
		isDashboard && rangeActive && config && analyticsDataFetched
			? analyticsDataFetched[ config.changeKey ]
			: null;
	const hasServerDelta = serverDelta !== null && serverDelta !== undefined;
	const showChange = isDashboard ? hasServerDelta : true;

	useEffect( () => {
		// Dashboard mode is fully React-rendered — no imperative DOM writes
		// (they would detach React's text nodes and freeze range updates).
		if ( isDashboard ) {
			return;
		}
		if ( ! processedAnalyticsHistory || ! analyticsDataFetched ) {
			return;
		}

		let finalHistoryArray = [];

		if ( mode === 'analytics' ) {
			const mappedData = processedAnalyticsHistory.map( ( history ) => {
				return {
					date: history.date,
					engagement_rate: parseFloat( calculateEngagementRate(
						history.plays,
						history.video_length,
						history.play_time,
					) ) || 0,
					play_rate: parseFloat( calculatePlayRate( history.page_load, history.plays ) ) || 0,
					plays: parseFloat( history.plays ) || 0,
					watch_time: parseFloat( history.play_time ) || 0,
				};
			} );
			finalHistoryArray = ensureAll7Days( mappedData );
		} else if ( mode === 'dashboard' ) {
			const mappedData = processedAnalyticsHistory.map( ( history ) => {
				return {
					date: history.date,
					engagement_rate: parseFloat( history.avg_engagement ) || 0,
					play_rate: history.play_rate
						? parseFloat( history.play_rate * 100 )
						: 0,
					plays: parseFloat( history.plays ) || 0,
					watch_time: parseFloat( history.watch_time ) || 0,
					total_videos: parseInt( history.total_videos ) || 0,
				};
			} );
			finalHistoryArray = ensureAll7Days( mappedData );
		}

		if ( config ) {
			// Ensure we have the data sorted by date (oldest to newest)
			const sortedData = [ ...finalHistoryArray ].sort( ( a, b ) => {
				return new Date( a.date ) - new Date( b.date );
			} );

			const trendPercentage = calculateTrendPercentage( sortedData, config.key );

			// Update the change percentage UI
			const changeEl = document.getElementById( `${ metricType }-change` );
			if ( changeEl ) {
				const rounded = Math.abs( trendPercentage ).toFixed( 2 );
				const prefix = trendPercentage >= 0 ? '+' : '-';
				changeEl.innerText = `${ prefix }${ rounded }%`;
				// Remove existing classes first
				changeEl.classList.remove( 'change-rise', 'change-drop' );
				changeEl.classList.add( trendPercentage >= 0 ? 'change-rise' : 'change-drop' );
			}
		}
	}, [ processedAnalyticsHistory, analyticsDataFetched, metricType, mode, config, isDashboard ] );

	return (
		<div className="analytics-info flex justify-between max-lg:flex-col border border-zinc-200 w-full md:w-[calc(50%-0.5rem)] lg:w-full">
			<div className="analytics-single-info">
				<div className="flex justify-between items-start flex-row w-full gap-2">
					<div className="analytics-info-heading">
						<p className="text-xs text-[#525252] whitespace-nowrap">{ label }</p>
						<Tooltip text={ tooltipText } />
					</div>
					{ showChange && (
						isDashboard ? (
							<div className="flex flex-col items-end shrink-0">
								<p className={ `metric-change ${ serverDelta >= 0 ? 'change-rise' : 'change-drop' }` }>
									{ `${ serverDelta >= 0 ? '+' : '-' }${ Math.abs( serverDelta ).toFixed( 2 ) }%` }
								</p>
								<span className="text-[10px] text-zinc-400 whitespace-nowrap">{ deltaLabel || __( 'vs previous period', 'godam' ) }</span>
							</div>
						) : (
							<div className="flex items-center gap-1.5">
								<p id={ `${ metricType }-change` } className="metric-change">+0%</p>
								<span className="text-[11px] text-zinc-400 whitespace-nowrap">{ __( 'vs 7 days ago', 'godam' ) }</span>
							</div>
						)
					) }
				</div>
				<div className="flex flex-row justify-between gap-2 items-end">
					<div className="flex flex-col gap-3">
						<p
							id={ `${ metricType }` }
							className="min-w-[90px] single-metrics-value"
						>
							{ isDashboard ? dashboardValue : '0%' }
						</p>
						<p className="text-zinc-500 text-xs">{ dataLabel || __( 'All time', 'godam' ) }</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default SingleMetrics;
