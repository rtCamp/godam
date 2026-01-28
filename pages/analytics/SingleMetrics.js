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

		// Function to ensure all 7 days are present
		const ensureAll7Days = ( dataArray ) => {
			// Get today's date at midnight in local timezone
			const now = new Date();
			const today = new Date( now.getFullYear(), now.getMonth(), now.getDate() );

			// Create an array of all dates for the last 7 days (including today)
			const last7Days = [];
			for ( let i = 6; i >= 0; i-- ) {
				const date = new Date( today );
				date.setDate( today.getDate() - i );
				// Format as YYYY-MM-DD in local timezone
				const year = date.getFullYear();
				const month = String( date.getMonth() + 1 ).padStart( 2, '0' );
				const day = String( date.getDate() ).padStart( 2, '0' );
				const dateStr = `${ year }-${ month }-${ day }`;
				last7Days.push( dateStr );
			}

			// Create a map of existing data
			const dataMap = {};
			dataArray.forEach( ( d ) => {
				dataMap[ d.date ] = d;
			} );

			// Fill in missing days with zero values
			return last7Days.map( ( dateStr ) => {
				if ( dataMap[ dateStr ] ) {
					return dataMap[ dateStr ];
				}
				return {
					date: dateStr,
					engagement_rate: 0,
					play_rate: 0,
					watch_time: 0,
					plays: 0,
					total_videos: 0,
				};
			} );
		};

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
			let trendChange = 0;
			let trendPercentage = 0;

			// Ensure we have the data sorted by date (oldest to newest)
			const sortedData = [ ...finalHistoryArray ].sort( ( a, b ) => {
				return new Date( a.date ) - new Date( b.date );
			} );

			if ( sortedData.length >= 2 ) {
				// First day is the oldest, last day is the most recent
				const first = parseFloat( sortedData[ 0 ][ config.key ] );
				const last = parseFloat( sortedData[ sortedData.length - 1 ][ config.key ] );
				if ( ! isNaN( first ) && ! isNaN( last ) ) {
					trendChange = last - first;

					// Handle the case when first value is 0
					if ( first === 0 ) {
						// If first is 0 and last is > 0, show 100% increase
						// If first is 0 and last is 0, show 0% change
						// If first is 0 and last is < 0 (shouldn't happen but just in case), show negative
						if ( last > 0 ) {
							trendPercentage = 100;
						} else if ( last < 0 ) {
							trendPercentage = -100;
						} else {
							trendPercentage = 0;
						}
					} else {
						trendPercentage = ( trendChange / first ) * 100;
					}
				}
			}

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
						<p className="text-zinc-500 text-xs">{ __( 'Last 7 days', 'godam' ) }</p>
					</div>
					<div id={ `single-${ metricType }-chart` } className="metrics-chart"></div>
				</div>
			</div>
		</div>
	);
};

export default SingleMetrics;
