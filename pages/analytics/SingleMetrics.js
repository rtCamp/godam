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

const SingleMetrics = ( {
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

		const finalHistoryArray = processedAnalyticsHistory.map( ( history ) => {
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

		singleMetricsChart(
			finalHistoryArray,
			'#single-engagement-rate-chart',
			'engagement_rate',
			7,
			analyticsDataFetched.avg_engagement_change,
		);

		singleMetricsChart(
			finalHistoryArray,
			'#single-plays-chart',
			'plays',
			7,
			analyticsDataFetched.views_change,
		);
		singleMetricsChart(
			finalHistoryArray,
			'#single-play-rate-chart',
			'play_rate',
			7,
			analyticsDataFetched.play_rate_change,
		);
		singleMetricsChart(
			finalHistoryArray,
			'#single-watch-time-chart',
			'watch_time',
			7,
			analyticsDataFetched.watch_time_change,
		);
	}, [ processedAnalyticsHistory, analyticsDataFetched ] );

	return (
		<div className="analytics-info flex justify-between max-lg:flex-col border border-zinc-200">
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
							className="min-w-[90px] engagement-rate"
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
