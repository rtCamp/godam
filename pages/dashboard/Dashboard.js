/**
 * External dependencies
 */
import React, { useEffect, useState, useRef } from 'react';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */

import CountryHeatmapChart from '../analytics/charts/CountryHeatmapChart.js';
import DefaultThumbnail from '../../assets/src/images/video-thumbnail-default.png';
import ExportBtn from '../../assets/src/images/export.svg';
import { useFetchDashboardMetricsQuery, useFetchDashboardMetricsHistoryQuery, useFetchTopVideosQuery } from './redux/api/dashboardAnalyticsApi';
import GodamHeader from '../godam/components/GoDAMHeader.jsx';
import SingleMetrics from '../analytics/SingleMetrics';
import PlaybackPerformanceDashboard from '../analytics/PlaybackPerformance';
import chevronLeft from '../../assets/src/images/chevron-left.svg';
import chevronRight from '../../assets/src/images/chevron-right.svg';
import upgradePlanBackground from '../../assets/src/images/upgrade-plan-dashboard-bg.png';

const Dashboard = () => {
	const [ topVideosPage, setTopVideosPage ] = useState( 1 );
	const siteUrl = window.location.origin;
	const adminUrl = window.videoData?.adminUrl;

	const { data: dashboardMetrics, isLoading: isDashboardMetricsLoading } = useFetchDashboardMetricsQuery( { siteUrl } );
	window.dashboardMetrics = dashboardMetrics;

	const { data: dashboardMetricsHistory } = useFetchDashboardMetricsHistoryQuery( { days: 60, siteUrl } );
	const {
		data: topVideosResponse,
		isFetching: isTopVideosFetching,
	} = useFetchTopVideosQuery( { siteUrl, page: topVideosPage, limit: 10 } );

	const topVideosData = topVideosResponse?.videos || [];
	const totalTopVideosPages = topVideosResponse?.totalPages || 1;

	useEffect( () => {
		const loadingEl = document.getElementById( 'loading-analytics-animation' );
		const container = document.getElementById( 'dashboard-container' );
		const overlay = document.getElementById( 'api-key-overlay' );

		const shouldShowOverlay =
			dashboardMetrics?.errorType === 'invalid_key' ||
			dashboardMetrics?.errorType === 'missing_key' ||
			dashboardMetrics?.errorType === 'microservice_error';

		if ( shouldShowOverlay ) {
			if ( loadingEl ) {
				loadingEl.style.display = 'none';
			}
			if ( container ) {
				container.classList.add( 'hidden' );
				container.classList.add( 'blurred' );
			}
			if ( overlay ) {
				overlay.classList.remove( 'hidden' );
			}
		}
	}, [ dashboardMetrics ] );

	useEffect( () => {
		if (
			! isDashboardMetricsLoading &&
			dashboardMetrics?.country_views
		) {
			const interval = setInterval( () => {
				const mapContainer = document.querySelector( '#map-container' );
				const tableContainer = document.querySelector( '#table-container' );
				if ( mapContainer && tableContainer ) {
					clearInterval( interval );

					new CountryHeatmapChart(
						dashboardMetrics.country_views,
						'#map-container',
						'#table-container',
					);
				}
			}, 100 );

			return () => clearInterval( interval );
		}
	}, [ isDashboardMetricsLoading, dashboardMetrics ] );

	const handleExportCSV = () => {
		const headers = [
			'Title',
			'Media ID',
			'Size',
			'Play Rate',
			'Total Plays',
			'Watch Time',
			'Engagement Rate',
		];

		const rows = topVideosData?.map( ( item ) => {
			return [
				item.title || item.video_id,
				`ID: ${ item.video_id }`,
				( item.video_size ? item.video_size.toFixed( 2 ) : 0 ) + ' MB',
				( ( item.plays / ( item.plays + 5 ) ) * 100 ).toFixed( 2 ) + '%',
				item.plays,
				item.play_time?.toFixed( 2 ) + 's',
				( ( item.play_time / ( item.plays * item.video_length ) ) * 100 ).toFixed( 2 ) + '%',
			];
		} );

		const csvContent = [
			headers.join( ',' ),
			...rows.map( ( row ) =>
				row
					.map( ( value ) => {
						if (
							typeof value === 'string' &&
							( value.includes( ',' ) || value.includes( '\n' ) )
						) {
							return `"${ value.replace( /"/g, '""' ) }"`; // escape double quotes
						}
						return value;
					} )
					.join( ',' ),
			),
		].join( '\n' );

		// Trigger download
		const blob = new Blob( [ csvContent ], { type: 'text/csv;charset=utf-8;' } );
		const url = URL.createObjectURL( blob );
		const link = document.createElement( 'a' );
		link.setAttribute( 'href', url );
		link.setAttribute( 'download', 'godam-video-analytics.csv' );
		link.style.display = 'none';
		document.body.appendChild( link );
		link.click();
		document.body.removeChild( link );
	};

	const isFirstLoadRef = useRef( true );

	useEffect( () => {
		if ( isFirstLoadRef.current ) {
			isFirstLoadRef.current = false;
			return;
		}

		const container = document.querySelector( '.top-media-container' );
		if ( container ) {
			container.scrollIntoView( { behavior: 'smooth' } );
		}
	}, [ topVideosPage ] );

	useEffect( () => {
		const checkExist = setInterval( () => {
			const bandwidthEl = document.querySelector( '#bandwidth-donut-chart' );
			const storageEl = document.querySelector( '#storage-donut-chart' );

			if ( bandwidthEl && storageEl && window?.userData ) {
				clearInterval( checkExist );
			}
		}, 100 );

		return () => clearInterval( checkExist );
	}, [] );

	return (
		<div className="godam-dashboard-container">
			<GodamHeader />

			<div id="loading-analytics-animation" className="progress-bar-wrapper">
				<div className="progress-bar-container">
					<div className="progress-bar">
						<div className="progress-bar-inner"></div>
					</div>
				</div>
			</div>

			<div
				id="api-key-overlay"
				className="api-key-overlay hidden"
				style={
					dashboardMetrics?.errorType === 'invalid_key' || dashboardMetrics?.errorType === 'missing_key'
						? {
							backgroundImage: `url(${ upgradePlanBackground })`,
							backgroundSize: '100% calc(100% - 32px)',
							backgroundRepeat: 'no-repeat',
							backgroundPosition: 'center 32px',
						}
						: {}
				}
			>
				<div className="api-key-message">
					{ dashboardMetrics?.errorType === 'invalid_key' || dashboardMetrics?.errorType === 'missing_key'
						? <div className="api-key-overlay-banner">
							<p className="api-key-overlay-banner-header">
								{ __(
									'Upgrade to unlock the media performance report.',
									'godam',
								) }

								<a href={ `https://godam.io/pricing?utm_campaign=buy-plan&utm_source=${ window?.location?.host || '' }&utm_medium=plugin&utm_content=analytics` } className="components-button godam-button is-primary" target="_blank" rel="noopener noreferrer">{ __( 'Buy Plan', 'godam' ) }</a>
							</p>

							<p className="api-key-overlay-banner-footer">
								{ __( 'If you already have a premium plan, connect your ' ) }
								<a href={ adminUrl } target="_blank" rel="noopener noreferrer">
									{ __( 'API in the settings', 'godam' ) }
								</a>
							</p>
						</div>
						:	<div className="api-key-overlay-banner">
							<p>
								{ dashboardMetrics?.message + ' ' || __(
									'An unknown error occurred. Please check your plugin settings.',
									'godam',
								) }
							</p>
							<a href={ adminUrl } target="_blank" rel="noopener noreferrer">
								{ __( 'Go to plugin settings', 'godam' ) }
							</a>
						</div>
					}
				</div>
			</div>

			<div id="dashboard-container" className="dashboard-container">
				<div className="flex-grow">
					<div className="analytics-info-container single-metrics-info-container flex max-lg:flex-row items-stretch flex-wrap justify-center lg:flex-nowrap">

						<SingleMetrics
							mode="dashboard"
							metricType="total-videos"
							label={ __( 'Active Videos', 'godam' ) }
							tooltipText={ __(
								'Number of unique videos that received user interactions each day, such as views or plays.',
								'godam',
							) }
							processedAnalyticsHistory={ dashboardMetricsHistory }
							analyticsDataFetched={ {
								total_videos: dashboardMetrics?.total_videos ?? 0,
							} }
						/>

						<SingleMetrics
							mode="dashboard"
							metricType={ 'plays' }
							label={ __( 'Total Plays', 'godam' ) }
							tooltipText={ __(
								'Plays represent the total number of times the video has been viewed',
								'godam',
							) }
							processedAnalyticsHistory={ dashboardMetricsHistory }
							analyticsDataFetched={ dashboardMetrics }
						/>

						<SingleMetrics
							mode="dashboard"
							metricType={ 'play-rate' }
							label={ __( 'Play Rate', 'godam' ) }
							tooltipText={ __(
								'Play rate is the percentage of page visitors who clicked play. Play Rate = Total plays / Page loads',
								'godam',
							) }
							processedAnalyticsHistory={ dashboardMetricsHistory }
							analyticsDataFetched={ dashboardMetrics }
						/>

						<SingleMetrics
							mode="dashboard"
							metricType={ 'watch-time' }
							label={ __( 'Watch Time', 'godam' ) }
							tooltipText={ __(
								'Total time the video has been watched, aggregated across all plays',
								'godam',
							) }
							processedAnalyticsHistory={ dashboardMetricsHistory }
							analyticsDataFetched={ dashboardMetrics }
						/>
					</div>
				</div>

				<div className="mx-auto py-4">
					<div className="playback-country-container flex flex-wrap">
						<div className="playback-performance min-w-full lg:min-w-[600px]" id="global-analytics-container">
							<PlaybackPerformanceDashboard
								initialData={ dashboardMetricsHistory }
								mode="dashboard"
							/>
						</div>
						<div className="country-views min-w-full md:min-w-[300px]">
							<div className="country-views-map" id="map-container"></div>
							<div className="country-views-table" id="table-container"></div>
						</div>
					</div>
				</div>

				<div className="top-media-container">
					<div className="flex justify-between pt-4">
						<h2>{ __( 'Top Videos', 'godam' ) }</h2>
						<button onClick={ handleExportCSV } className="export-button">
							<img src={ ExportBtn } alt="Export" className="export-icon" />
							{ __( 'Export', 'godam' ) }
						</button>
					</div>
					<div className="table-container overflow-x-auto">
						<table className="w-full">
							<tbody>
								<tr>
									<th>{ __( 'Name', 'godam' ) }</th>
									<th>{ __( 'Size', 'godam' ) }</th>
									<th>{ __( 'Play Rate', 'godam' ) }</th>
									<th>{ __( 'Total Plays', 'godam' ) }</th>
									<th>{ __( 'Total Watch Time', 'godam' ) }</th>
									<th>{ __( 'Average Engagement', 'godam' ) }</th>
								</tr>
								{ isTopVideosFetching ? (
									<tr>
										<td colSpan="6">
											<div className="space-y-4 mt-3">
												<div className="skeleton h-4 w-full"></div>
												<div className="skeleton h-4 w-full"></div>
												<div className="skeleton h-4 w-full"></div>
											</div>
										</td>
									</tr>
								) : (
									topVideosData?.map( ( item, index ) => (
										<tr key={ index }>
											<td>
												<div className="video-info">
													{ item.exists ? (
														<>
															<a className="thumbnail-link" href={ `admin.php?page=rtgodam_analytics&id=${ item.video_id }` }>
																<img
																	src={ item.thumbnail_url || DefaultThumbnail }
																	alt={ item.title || __( 'Video thumbnail', 'godam' ) }
																/>
															</a>
															<a className="title-link" href={ `admin.php?page=rtgodam_analytics&id=${ item.video_id }` }>
																<div className="w-full max-w-40 text-left flex-1">
																	<p className="font-semibold">{ item.title || `Video ID: ${ item.video_id }` }</p>
																</div>
															</a>
														</>
													) : (
														<>
															<div className="thumbnail-link">
																<img
																	src={ DefaultThumbnail }
																	alt={ item.title || __( 'Video thumbnail', 'godam' ) }
																/>
															</div>
															<div className="title-link">
																<div className="w-full max-w-40 text-left flex-1">
																	<p className="font-semibold">{ item.title }</p>
																</div>
															</div>
														</>
													) }
												</div>
											</td>
											<td>
												{ item.video_size ? `${ item.video_size.toFixed( 2 ) } MB` : '' }
											</td>
											<td>
												{ item.plays > 0 && item.page_load > 0
													? ( ( item.plays / item.page_load ) * 100 ).toFixed( 2 ) + '%'
													: '0%' }
											</td>
											<td>{ item.plays ?? '-' }</td>
											<td>{ item.play_time?.toFixed( 2 ) ?? '-' }s</td>
											<td>
												{ item.plays > 0 && item.video_length > 0
													? ( ( item.play_time / ( item.plays * item.video_length ) ) * 100 ).toFixed( 2 ) + '%'
													: '-' }
											</td>
										</tr>
									) )
								) }
								{ topVideosData.length === 0 && (
									<tr>
										<td colSpan="6" className="text-center py-4 text-lg">
											{ __( 'No videos found.', 'godam' ) }
										</td>
									</tr>
								) }
							</tbody>

						</table>
					</div>
					<div className="flex items-center justify-between mt-4">
						<p className="text-sm text-gray-500">
							{
								/* translators: %1$d is the current page number, %2$d is the total number of pages */
								sprintf( __( 'Page %1$d of %2$d', 'godam' ), topVideosPage, totalTopVideosPages )
							}
						</p>
						<div className="flex items-center gap-4">
							<button
								className="previous-btn flex items-center gap-1"
								disabled={ topVideosPage === 1 }
								onClick={ () => setTopVideosPage( ( prev ) => Math.max( prev - 1, 1 ) ) }
							>
								<img
									src={ chevronLeft }
									alt="Previous"
									className={ `w-4 h-4 chevron-icon ${ topVideosPage === 1 ? 'icon-disabled' : '' }` }
								/>
								<span>{ __( 'Previous', 'godam' ) }</span>
							</button>
							<button
								className="next-btn flex items-center gap-1"
								disabled={ topVideosPage >= totalTopVideosPages }
								onClick={ () => setTopVideosPage( ( prev ) => prev + 1 ) }
							>
								<span>{ __( 'Next', 'godam' ) }</span>
								<img
									src={ chevronRight }
									alt="Next"
									className={ `w-4 h-4 chevron-icon ${ topVideosPage >= totalTopVideosPages ? 'icon-disabled' : '' }` }
								/>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Dashboard;
