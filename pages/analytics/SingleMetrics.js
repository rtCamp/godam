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
	processedAnalyticsHistory,
	analyticsDataFetched,
} ) => {
	useEffect( () => {
		if ( ! processedAnalyticsHistory || ! analyticsDataFetched ) {
			return;
		}

		let finalHistoryArray = [];

		if ( mode === 'analytics' ) {
			finalHistoryArray = processedAnalyticsHistory.map( ( history ) => {
				return {
					date: history.date,
					engagement_rate: calculateEngagementRate(
						history.plays,
						history.video_length,
						history.play_time,
					),
					play_rate: calculatePlayRate( history.page_load, history.plays ),
					plays: history.plays.toFixed( 2 ),
					watch_time: history.play_time,
				};
			} );
		} else if ( mode === 'dashboard' ) {
			finalHistoryArray = processedAnalyticsHistory.map( ( history ) => {
				return {
					date: history.date,
					engagement_rate: history.avg_engagement || 0,
					play_rate: history.play_rate
						? parseFloat( history.play_rate * 100 ).toFixed( 2 )
						: 0,
					plays: history.plays.toFixed( 2 ),
					watch_time: history.watch_time,
					total_videos: history.total_videos ?? 0,
				};
			} );
		}

		const config = chartConfigMap[ metricType ];

		if ( config && config.id ) {
			let trendChange = 0;
			let trendPercentage = 0;

			if ( finalHistoryArray.length >= 2 ) {
				const last = parseFloat( finalHistoryArray[ 0 ][ config.key ] );
				const first = parseFloat( finalHistoryArray[ finalHistoryArray.length - 1 ][ config.key ] );

				if ( ! isNaN( first ) && first !== 0 ) {
					trendChange = last - first;
					trendPercentage = ( trendChange / first ) * 100;
				}
			}

			// Update the change percentage UI
			const changeEl = document.getElementById( `${ metricType }-change` );
			if ( changeEl ) {
				const rounded = Math.abs( trendPercentage ).toFixed( 2 );
				const prefix = trendPercentage >= 0 ? '+' : '-';
				changeEl.innerText = `${ prefix }${ rounded }%`;
				changeEl.classList.add( trendPercentage >= 0 ? 'change-rise' : 'change-drop' );
			}

			singleMetricsChart(
				finalHistoryArray,
				config.id,
				config.key,
				Math.min( 7, finalHistoryArray.length ), // Cap to available data
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
						<p className="text-zinc-500 text-xs">{ __( 'Last 7 days', 'godam' ) }</p>
					</div>
					<div id={ `single-${ metricType }-chart` } className="metrics-chart"></div>
				</div>
			</div>
		</div>
	);
};

export default SingleMetrics;
