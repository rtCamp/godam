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
	singleMetricsChart,
	ensureAll7Days,
	calculateTrendPercentage,
} from './helper';

import './charts.js';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

const chartConfigMap = {
	'engagement-rate': {
		id: '#single-engagement-rate-chart',
		key: 'engagement_rate',
		changeKey: 'avg_engagement_change',
	},
	plays: {
		id: '#single-plays-chart',
		key: 'plays',
		changeKey: 'views_change',
	},
	'play-rate': {
		id: '#single-play-rate-chart',
		key: 'play_rate',
		changeKey: 'play_rate_change',
	},
	'watch-time': {
		id: '#single-watch-time-chart',
		key: 'watch_time',
		changeKey: 'watch_time_change',
	},
	'total-videos': {
		id: '#single-total-videos-chart',
		key: 'total_videos',
		changeKey: 'total_videos_change',
	},
};

const SingleMetrics = ( {
	mode = 'analytics',
	metricType,
	label,
	tooltipText,
	dataLabel,
	processedAnalyticsHistory,
	analyticsDataFetched,
} ) => {
	useEffect( () => {
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

		const config = chartConfigMap[ metricType ];

		if ( config && config.id ) {
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

			singleMetricsChart(
				sortedData,
				config.id,
				config.key,
				7, // Always show last 7 days
				trendPercentage,
			);
		}
	}, [ processedAnalyticsHistory, analyticsDataFetched, metricType, mode ] );

	return (
		<div className="analytics-info flex justify-between max-lg:flex-col border border-zinc-200 w-full md:w-[calc(50%-0.5rem)] lg:w-full">
			<div className="analytics-single-info">
				<div className="flex justify-between items-center flex-row w-full">
					<div className="analytics-info-heading">
						<p className="text-xs text-[#525252]">{ label }</p>
						<Tooltip text={ tooltipText } />
					</div>
					<p id={ `${ metricType }-change` } className="metric-change">+0%</p>
				</div>
				<div className="flex flex-row justify-between gap-2 items-end">
					<div className="flex flex-col gap-3">
						<p
							id={ `${ metricType }` }
							className="min-w-[90px] single-metrics-value"
						>
							0%
						</p>
						<p className="text-zinc-500 text-xs">{ dataLabel || __( 'All time', 'godam' ) }</p>
					</div>
					<div className="flex flex-col gap-1 items-end">
						<div id={ `single-${ metricType }-chart` } className="metrics-chart"></div>
						<p className="text-zinc-400 text-[10px]">{ __( 'Last 7 days', 'godam' ) }</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default SingleMetrics;
