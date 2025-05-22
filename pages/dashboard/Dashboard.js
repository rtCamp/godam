/**
 * External dependencies
 */
/**
 * WordPress dependencies
 */
import React, { useEffect, useState, useRef } from 'react';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { generateCountryHeatmap } from '../analytics/helper';
import DefaultThumbnail from '../../assets/src/images/video-thumbnail-default.png';
import ExportBtn from '../../assets/src/images/export.svg';
import Tooltip from '../analytics/Tooltip.js';
import { useFetchDashboardMetricsQuery, useFetchDashboardMetricsHistoryQuery, useFetchTopVideosQuery } from './redux/api/dashboardAnalyticsApi';
import GodamHeader from '../godam/components/GoDAMHeader.jsx';
import SingleMetrics from '../analytics/SingleMetrics';
import PlaybackPerformanceDashboard from '../analytics/PlaybackPerformance';
import { generateUsageDonutChart } from './components/ChartsDashboard.js';
import MarketingCarousel from './components/MarketingCarousel.jsx';
import chevronLeft from '../../assets/src/images/chevron-left.svg';
import chevronRight from '../../assets/src/images/chevron-right.svg';

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
		if ( dashboardMetrics?.errorType === 'invalid_key' ) {
			const loadingEl = document.getElementById( 'loading-analytics-animation' );
			const container = document.getElementById( 'dashboard-container' );
			const overlay = document.getElementById( 'api-key-overlay' );

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
					generateCountryHeatmap(
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
				`Video ID: ${ item.video_id }`,
				item.title || `Video ID: ${ item.video_id }`,
				( item.video_size ? item.video_size.toFixed( 2 ) : 0 ) + ' MB',,
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

				generateUsageDonutChart(
					'#bandwidth-donut-chart',
					window.userData.bandwidth_used ?? 0,
					window.userData.total_bandwidth ?? 0,
					'bandwidth',
				);

				generateUsageDonutChart(
					'#storage-donut-chart',
					window.userData.storage_used ?? 0,
					window.userData.total_storage ?? 0,
					'storage',
				);
			}
		}, 100 );

		return () => clearInterval( checkExist );
	}, [] );

	useEffect( () => {
		const handleResize = () => {
			const smallSize = window.innerWidth <= 1024;
			const responsiveOverlay = document.getElementById( 'screen-size-overlay' );
			const dashboardContainer = document.getElementById( 'root-video-dashboard' );

			if ( responsiveOverlay && dashboardContainer ) {
				if ( smallSize ) {
					responsiveOverlay.classList.remove( 'hidden' );
					dashboardContainer.style.overflow = 'hidden';
				} else {
					responsiveOverlay.classList.add( 'hidden' );
					dashboardContainer.style.overflow = 'auto';
				}
			}
		};

		// Initial check
		handleResize();

		// Add listener
		window.addEventListener( 'resize', handleResize );

		// Cleanup
		return () => window.removeEventListener( 'resize', handleResize );
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

			<div id="api-key-overlay" className="api-key-overlay hidden">
				<div className="api-key-message">
					<p>
						{ __( 'Please ', 'godam' ) }
						<a href={ adminUrl } target="_blank" rel="noopener noreferrer">
							{ __( 'activate your API key', 'godam' ) }
						</a>
						{ __( ' to access the Dashboard feature', 'godam' ) }
					</p>
				</div>
			</div>

			<div id="screen-size-overlay" className="screen-size-overlay hidden">
				<div className="screen-size-message">
					<p>{ __( 'You need to use desktop to access this feature. ', 'godam' ) }</p>
				</div>
			</div>

			<div id="dashboard-container" className="dashboard-container">
				<div className="flex-grow">
					<div className="analytics-info-container single-metrics-info-container flex max-lg:flex-row items-stretch">

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

				<div className="flex flex-wrap gap-3 py-4">
					<div className="dashboard-donut-container bg-white border border-zinc-200 p-2">
						<div className="flex items-center gap-1 mb-1">
							<h2 className="text-sm font-medium text-zinc-600 m-0">
								{ __( 'Bandwidth Usage', 'godam' ) }
							</h2>
							<Tooltip text={ __( 'Bandwidth used for all media delivery. This resets monthly.', 'godam' ) } />
						</div>
						<div id="bandwidth-donut-chart"></div>
					</div>

					<div className="dashboard-donut-container bg-white border border-zinc-200 p-2">
						<div className="flex items-center gap-1 mb-1">
							<h2 className="text-sm font-medium text-zinc-600 m-0">
								{ __( 'Storage Usage', 'godam' ) }
							</h2>
							<Tooltip text={ __( 'Storage space consumed by all uploaded media files. Storage is a one-time allocation.', 'godam' ) } />
						</div>
						<div id="storage-donut-chart"></div>
					</div>
					<MarketingCarousel />
				</div>

				<div className="mx-auto">
					<div className="playback-country-container flex flex-wrap">
						<div className="playback-performance flex-1 min-w-[600px]" id="global-analytics-container">
							<PlaybackPerformanceDashboard
								initialData={ dashboardMetricsHistory }
								mode="dashboard"
							/>
						</div>
						<div className="country-views flex-1 min-w-[300px]">
							<div className="country-views-map" id="map-container"></div>
							<div className="country-views-table" id="table-container"></div>
						</div>
					</div>
				</div>

				<div className="top-media-container">
					<div className="flex justify-between pt-8">
						<h2>Top Videos</h2>
						<button onClick={ handleExportCSV } className="export-button">
							<img src={ ExportBtn } alt="Export" className="export-icon" />
							Export
						</button>
					</div>
					<div className="table-container">
						<table className="w-full">
							<tbody>
								<tr>
									<th>Name</th>
									<th>Size</th>
									<th>Play Rate</th>
									<th>Total Plays</th>
									<th>Total Watch Time</th>
									<th>Average Engagement</th>
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
													<a className="thumbnail-link" href={ `admin.php?page=rtgodam_analytics&id=${ item.video_id }` }>
														<img
															src={ item.thumbnail_url || DefaultThumbnail }
															alt={ item.title || 'Video thumbnail' }
														/>
													</a>
													<a className="title-link" href={ `admin.php?page=rtgodam_analytics&id=${ item.video_id }` }>
														<div className="w-full max-w-40 text-left flex-1">
															<p className="font-semibold">{ item.title || `Video ID: ${ item.video_id }` }</p>
														</div>
													</a>
												</div>
											</td>
											<td>
												{ item.video_size ? `${ item.video_size.toFixed( 2 ) } MB` : '0 MB' }
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
							</tbody>
						</table>
					</div>
					<div className="flex items-center justify-between mt-4">
						<p className="text-sm text-gray-500">
							Page { topVideosPage } of { totalTopVideosPages }
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
								<span>Previous</span>
							</button>
							<button
								className="next-btn flex items-center gap-1"
								disabled={ topVideosPage >= totalTopVideosPages }
								onClick={ () => setTopVideosPage( ( prev ) => prev + 1 ) }
							>
								<span>Next</span>
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
