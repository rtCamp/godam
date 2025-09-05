/**
 * External dependencies
 */
import React, { useEffect } from 'react';

/**
 * Internal dependencies
 */
import { useFetchProcessedLayerAnalyticsQuery } from './redux/api/analyticsApi';
import { layerAnalyticsBarChart } from './helper.js';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

const SingleLayerAnalyticsList = ( { activeTab, dateRange, attachmentID } ) => {
	const siteUrl = window.location.origin;

	let days;
	switch ( dateRange ) {
		case '7d':
			days = 7;
			break;
		case '30d':
			days = 30;
			break;
		case '60d':
			days = 60;
			break;
		default:
			days = 365;
	}

	const { data: layerAnalyticsDataFetched, isLoading, isFetching } =
		useFetchProcessedLayerAnalyticsQuery( {
			layerType: activeTab.toLowerCase(),
			days,
			siteUrl,
			videoId: attachmentID,
		} );

	// Utility function for colors
	const getClickRateColor = ( rate ) => {
		if ( rate < 65 ) {
			return 'text-red-600';
		}
		if ( rate >= 65 && rate <= 75 ) {
			return 'text-yellow-500';
		}
		return 'text-green-600';
	};

	const metricsByLayerType = {
		form: [ 'submitted', 'skipped' ],
		hotspot: [ 'clicked', 'skipped' ],
		cta: [ 'clicked', 'skipped' ],
	};

	const labelMap = {
		submitted: __( 'Submissions', 'godam' ),
		skipped: __( 'Skips', 'godam' ),
		hovered: __( 'Hovers', 'godam' ),
		clicked: __( 'Clicks', 'godam' ),
	};

	const metricsToShow = metricsByLayerType[ activeTab.toLowerCase() ] || [];

	useEffect( () => {
		if ( ! layerAnalyticsDataFetched ) {
			return;
		}

		const { daily_breakdown: dailyBreakdown } = layerAnalyticsDataFetched;

		// If daily_breakdown is missing or empty, bail out
		if (
			! Array.isArray( dailyBreakdown ) ||
			dailyBreakdown.length === 0
		) {
			return;
		}

		layerAnalyticsBarChart(
			dailyBreakdown,
			'#layer-analytics-graph',
			dateRange,
			labelMap,
			activeTab.toLowerCase(),
		);
	}, [ dateRange, activeTab, layerAnalyticsDataFetched ] );

	useEffect( () => {
		const barChart = document.getElementById( 'layer-analytics-graph' );
		if ( ! barChart || ( ! isLoading && ! isFetching ) ) {
			return;
		}

		if ( '' !== barChart.innerHTML.trim() ) {
			barChart.innerHTML = '';
		}
	}, [ isLoading, isFetching ] );

	return (
		<>
			{ ( isLoading || isFetching ) && (
				<div className="grid grid-cols-[3fr_3fr_2fr] h-[350px]">
					{ /* Left column skeleton */ }
					<div className="animate-pulse bg-zinc-200 rounded-lg mx-3 z-999999"></div>

					<div
						className="animate-pulse bg-zinc-200 rounded-lg mx-3 z-999999"
						id="layer-analytics-graph"
					></div>

					{ /* Right column skeleton */ }
					<div className="grid grid-cols-2 gap-4 px-6 pb-6 overflow-auto animate-pulse">
						<div className="col-span-2 h-28 bg-zinc-200 rounded-2xl"></div>
						<div className="h-28 bg-zinc-200 rounded-2xl"></div>
						<div className="h-28 bg-zinc-200 rounded-2xl"></div>
					</div>
				</div>
			) }

			{ ! isLoading && ! isFetching && ! layerAnalyticsDataFetched?.individual_layers?.length && (
				<p className="text-center h-[350px] m-auto flex items-center justify-center">{ __( 'No data found', 'godam' ) }</p>
			) }

			{ ! isLoading && ! isFetching && layerAnalyticsDataFetched?.individual_layers?.length > 0 && (
				<div className="grid grid-cols-[3fr_3fr_2fr] h-[350px]">
					<div className="overflow-auto">
						<div className="divide-y px-6">
							{ layerAnalyticsDataFetched?.individual_layers?.map(
								( item, index ) => (
									<div
										key={ index }
										className="flex justify-between items-center"
									>
										<div>
											<p className="text-sm font-medium text-zinc-800">
												{ item.layer_name?.length > 0
													? item.layer_name
													: `${ activeTab } ${ __( 'Layer', 'godam' ) }` }
											</p>
											<p className="text-sm text-zinc-500">
												{ __( 'Position:', 'godam' ) }{ ' ' }
												<span className="font-medium text-black">
													{ item.timestamp.toFixed( 2 ) }
												</span>{ ' ' }
												{ metricsToShow.map( ( metric ) => (
													<span key={ metric }>
														{ ' • ' }
														{ labelMap[ metric ] || metric }:{ ' ' }
														<span className="font-medium text-black">
															{ item[ metric ] }
														</span>
													</span>
												) ) }
											</p>
										</div>
										<div className="text-right">
											<p
												className={ `text-lg font-semibold ${ getClickRateColor( item.conversion_rate ) } my-3` }
											>
												{ item.conversion_rate.toFixed( 2 ) }%
											</p>
											<p className="text-xs text-zinc-400">{ __( 'Click Rate', 'godam' ) }</p>
										</div>
									</div>
								),
							) }
						</div>
					</div>

					<div className="overflow-auto" id="layer-analytics-graph"></div>

					<div className="grid grid-cols-2 gap-4 px-6 pb-6 overflow-auto">
						{ /* Top card spans both columns */ }
						<div className="col-span-2 rounded-2xl p-6 bg-zinc-50 flex flex-col items-center justify-center">
							<p className="text-3xl font-bold text-green-600">
								{ layerAnalyticsDataFetched?.cumulative?.conversion_rate.toFixed( 2 ) }%
							</p>
							<p className="text-sm text-zinc-500 mt-1">{ __( 'Avg. Click Rate', 'godam' ) }</p>
						</div>

						{ metricsToShow.map( ( metric ) => (
							<div
								className="rounded-2xl p-6 bg-green-50 flex flex-col items-center justify-center"
								key={ metric }
							>
								<p className="text-2xl font-bold text-green-600">
									{ layerAnalyticsDataFetched?.cumulative[ metric ] }
								</p>
								<p className="text-sm text-zinc-500 mt-1 whitespace-nowrap">
									{ __( 'Total', 'godam' ) } { labelMap[ metric ] || metric }
								</p>
							</div>
						) ) }
					</div>
				</div>
			) }
		</>
	);
};

export default SingleLayerAnalyticsList;
