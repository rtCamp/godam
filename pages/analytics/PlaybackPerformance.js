/* global d3 */

/**
 * External dependencies
 */
import { useEffect, useRef, useState } from 'react';
/**
 * Internal dependencies
 */
import { useFetchProcessedAnalyticsHistoryQuery } from './redux/api/analyticsApi';
import { useFetchDashboardMetricsHistoryQuery } from '../dashboard/redux/api/dashboardAnalyticsApi';
/**
 * WordPress dependencies
 */
import { __, _x } from '@wordpress/i18n';

export default function PlaybackPerformanceDashboard( {
	attachmentID,
	initialData,
	mode = 'analytics',
} ) {
	const chartRef = useRef( null );
	const [ selectedPeriod, setSelectedPeriod ] = useState( '7D' );
	const [ selectedMetrics, setSelectedMetrics ] = useState( [
		'engagement_rate',
		'play_rate',
	] );
	const [ parsedData, setParsedData ] = useState( initialData ); // Stores formatted data.

	// Get days value from selected period
	const getDaysFromPeriod = ( period ) => {
		switch ( period ) {
			case '7D':
				return 7;
			case '1M':
				return 30;
			case '6M':
				return 180;
			case '1Y':
				return 365;
			case 'All':
				return 730; // Set a large value for "All"
			default:
				return 7;
		}
	};

	// Fetch analytics data based on selected period
	const dashboardHistoryResult = useFetchDashboardMetricsHistoryQuery(
		{
			days: getDaysFromPeriod( selectedPeriod ),
			siteUrl: window.location.origin,
		},
		{ skip: mode !== 'dashboard' },
	);

	const analyticsHistoryResult = useFetchProcessedAnalyticsHistoryQuery(
		{
			videoId: attachmentID,
			siteUrl: window.location.origin,
			days: getDaysFromPeriod( selectedPeriod ),
		},
		{ skip: mode === 'dashboard' || ! attachmentID },
	);

	// Then pick the right one based on mode
	const processedAnalyticsHistory =
		mode === 'dashboard'
			? dashboardHistoryResult.data
			: analyticsHistoryResult.data;

	// Format data response for chart.
	useEffect( () => {
		const parseDate = d3.timeParse( '%Y-%m-%d' );
		const timeMetricsChartData = ( processedAnalyticsHistory || [] ).map(
			( entry ) => {
				const date = parseDate( entry.date );

				if ( mode === 'dashboard' ) {
					return {
						date,
						engagement_rate: +entry.avg_engagement?.toFixed( 2 ) || 0,
						play_rate: +( entry.play_rate * 100 || 0 ).toFixed( 2 ),
						watch_time: +( entry.watch_time || 0 ).toFixed( 2 ),
					};
				}

				const {
					page_load: dailyPageLoad,
					play_time: dailyPlayTime,
					video_length: dailyVideoLength,
					plays: dailyPlays,
				} = entry;

				const dailyEngagementRate =
					dailyPlays && dailyVideoLength
						? ( dailyPlayTime / ( dailyPlays * dailyVideoLength ) ) * 100
						: 0;

				const dailyPlayRate = dailyPageLoad
					? ( dailyPlays / dailyPageLoad ) * 100
					: 0;

				return {
					date,
					engagement_rate: +dailyEngagementRate.toFixed( 2 ),
					play_rate: +dailyPlayRate.toFixed( 2 ),
					watch_time: +dailyPlayTime.toFixed( 2 ),
				};
			},
		);
		setParsedData( timeMetricsChartData );
	}, [ processedAnalyticsHistory, selectedMetrics, mode ] );

	// Handle metric toggling
	const toggleMetric = ( metric ) => {
		if ( selectedMetrics.includes( metric ) ) {
			if ( selectedMetrics.length > 1 ) {
				setSelectedMetrics( selectedMetrics.filter( ( m ) => m !== metric ) );
			}
		} else {
			setSelectedMetrics( [ ...selectedMetrics, metric ] );
		}
	};

	useEffect( () => {
		const renderChart = () => {
			if ( ! chartRef.current || ! parsedData || parsedData.length === 0 ) {
				return;
			}
			// ... (The renderChart logic from your original helper would go here, but adapted to be a local function)
			// For brevity, assuming the large `renderChart` logic is here. Key change is that it reads dimensions dynamically.

			// Clear previous chart
			d3.select( chartRef.current ).selectAll( '*' ).remove();

			// Set the dimensions and margins of the graph
			const margin = { top: 20, right: 30, bottom: 50, left: 60 };
			const width = chartRef.current.clientWidth - margin.left - margin.right;
			const height = 300 - margin.top - margin.bottom; // Keep height fixed for consistency

			// The rest of your d3 chart rendering logic...
		};

		const handleResize = () => {
			renderChart();
		};

		// Initial render
		renderChart();

		// Add resize listener
		window.addEventListener( 'resize', handleResize );

		// Cleanup
		return () => {
			window.removeEventListener( 'resize', handleResize );
			d3.select( '#chart-tooltip' ).remove();
		};
	}, [ selectedPeriod, selectedMetrics, parsedData ] );

	return (
		<div className="w-full border rounded-lg p-4 shadow-sm h-auto lg:h-[400px]">
			{ /* Header now stacks on mobile */ }
			<div className="flex flex-col lg:flex-row justify-between gap-4">
				<h2 className="text-base font-bold text-gray-800 m-0 whitespace-nowrap">
					{ __( 'Playback Performance', 'godam' ) }
				</h2>
				<div className="flex flex-col sm:flex-row gap-4">
					{ /* Metric Toggles */ }
					<div className="flex items-center gap-2 flex-wrap">
						<button
							className={ `flex items-center gap-1 rounded-md bg-transparent` }
							onClick={ () => toggleMetric( 'engagement_rate' ) }
						>
							<div
								className={ `w-4 h-4 rounded ${
									selectedMetrics.includes( 'engagement_rate' )
										? 'bg-[#AB3A6C]'
										: 'bg-gray-300'
								} flex items-center justify-center` }
							>
								{ /* Checkmark SVG */ }
							</div>
							<span className="whitespace-nowrap">{ __( 'Engagement Rate', 'godam' ) }</span>
						</button>
						<button
							className={ `flex items-center gap-1 rounded-md bg-transparent` }
							onClick={ () => toggleMetric( 'play_rate' ) }
						>
							<div
								className={ `w-4 h-4 rounded ${
									selectedMetrics.includes( 'play_rate' )
										? 'bg-[#AB3A6C]'
										: 'bg-gray-300'
								} flex items-center justify-center` }
							>
								{ /* Checkmark SVG */ }
							</div>
							<span className="whitespace-nowrap">{ __( 'Play Rate', 'godam' ) }</span>
						</button>
					</div>
					{ /* Period Selector */ }
					<div className="flex items-center gap-1 text-sm flex-wrap">
						<button className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === 'All' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` } onClick={ () => setSelectedPeriod( 'All' ) }>{ _x( 'All', 'All time period', 'godam' ) }</button>
						<button className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === '7D' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` } onClick={ () => setSelectedPeriod( '7D' ) }>{ _x( '7D', '7 days period', 'godam' ) }</button>
						<button className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === '1M' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` } onClick={ () => setSelectedPeriod( '1M' ) }>{ _x( '1M', '1 month period', 'godam' ) }</button>
						<button className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === '6M' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` } onClick={ () => setSelectedPeriod( '6M' ) }>{ _x( '6M', '6 months period', 'godam' ) }</button>
						<button className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === '1Y' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` } onClick={ () => setSelectedPeriod( '1Y' ) }>{ _x( '1Y', '1 year period', 'godam' ) }</button>
					</div>
				</div>
			</div>

			<div className="w-full mt-4" style={ { height: '300px' } } ref={ chartRef }></div>
		</div>
	);
}