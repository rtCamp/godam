/**
 * External dependencies
 */
/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import React, { useEffect, useState } from 'react';
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

const Dashboard = () => {
	const [ topVideosPage, setTopVideosPage ] = useState( 1 );
	const siteUrl = window.location.origin;
	const adminUrl = window.videoData?.adminUrl;

	const { data: dashboardMetrics, isLoading: isDashboardMetricsLoading } = useFetchDashboardMetricsQuery( { siteUrl } );
	window.dashboardMetrics = dashboardMetrics;

	const { data: dashboardMetricsHistory, isLoading: isDashboardMetricsHistoryLoading } = useFetchDashboardMetricsHistoryQuery( { days: 60, siteUrl } );
	const {
		data: topVideosResponse,
		isLoading: isTopVideosLoading,
	} = useFetchTopVideosQuery( { siteUrl, page: topVideosPage, limit: 10 } );

	const topVideosData = topVideosResponse?.videos || [];
	const totalTopVideosPages = topVideosResponse?.totalPages || 1;

	useEffect( () => {
		if ( dashboardMetrics?.errorType === 'invalid_key' ) {
			const interval = setInterval( () => {
				const container = document.getElementById( 'dashboard-container' );
				const overlay = document.getElementById( 'api-key-overlay' );

				if ( container && overlay ) {
					container.classList.add( 'blurred' );
					container.classList.add( 'hidden' );
					overlay.classList.remove( 'hidden' );
					clearInterval( interval );
				}
			}, 100 );

			return () => clearInterval( interval );
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

	const calculatePercentage = ( used, total ) => {
		if ( total === 0 ) {
			return 0;
		}
		try {
			const result = ( used / total ) * 100;
			return result.toFixed( 2 );
		} catch ( error ) {
			return 0;
		}
	};

	useEffect( () => {
		const container = document.querySelector( '.top-media-container' );
		if ( container ) {
			container.scrollIntoView( { behavior: 'smooth' } );
		}
	}, [ topVideosPage ] );

	if ( isDashboardMetricsLoading || isDashboardMetricsHistoryLoading || isTopVideosLoading ) {
		return (
			<div id="loading-analytics-animation" className="progress-bar-wrapper">
				<div className="progress-bar-container">
					<div className="progress-bar">
						<div className="progress-bar-inner"></div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="godam-dashboard-container">
			<GodamHeader />
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

			<div id="dashboard-container">
				<h1>Dashboard</h1>

				<div className="flex-grow">
					<div className="analytics-info-container flex max-lg:flex-row items-stretch gap-4">

						<div className="analytics-info flex justify-between max-lg:flex-col border border-zinc-200 w-[150px]">
							<div className="analytics-single-info">
								<div className="flex justify-between items-center flex-row w-full">
									<div className="analytics-info-heading">
										<p className="text-xs text-[#525252]">{ __( 'Total Videos', 'godam' ) }</p>
										<Tooltip text={ __( 'Total number of videos uploaded on your site.', 'godam' ) } />
									</div>
								</div>
								<div className="flex flex-row justify-between gap-2 items-end">
									<div className="flex flex-col gap-3">
										<p
											id="total-videos"
											className="min-w-[90px] single-metrics-value"
										>
											{ dashboardMetrics?.total_videos ?? 0 }
										</p>
									</div>
								</div>
							</div>
						</div>

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

				<div>
					<div className="flex gap-4 flex-wrap">
						{ window?.userData?.storageBandwidthError ? (
							<p className="text-yellow-700 text-xs h-max">
								{ window?.userData?.storageBandwidthError }
							</p>
						) : (
							<>
								<div className="flex gap-3 items-center">
									<div className="circle-container">
										<div className="data text-xs">
											{ calculatePercentage(
												window?.userData?.bandwidth_used,
												window?.userData?.total_bandwidth,
											) }
											%
										</div>
										<div
											className={ `circle ${
												calculatePercentage(
													window?.userData?.bandwidth_used,
													window?.userData?.total_bandwidth,
												) > 90
													? 'red'
													: ''
											}` }
											style={ {
												'--percentage':
											calculatePercentage(
												window?.userData?.bandwidth_used,
												window?.userData?.total_bandwidth,
											) + '%',
											} }
										></div>
									</div>
									<div className="leading-6">
										<div className="easydam-settings-label text-base">
											{ __( 'BANDWIDTH', 'godam' ) }
										</div>
										<strong>{ __( 'Available: ', 'godam' ) }</strong>
										{ parseFloat(
											window?.userData?.total_bandwidth -
										window?.userData?.bandwidth_used,
										).toFixed( 2 ) }
										{ __( 'GB', 'godam' ) }
										<br />
										<strong>{ __( 'Used: ', 'godam' ) }</strong>
										{ parseFloat( window?.userData?.bandwidth_used ).toFixed( 2 ) }
										{ __( 'GB', 'godam' ) }
									</div>
								</div>
								<div className="flex gap-3 items-center">
									<div className="circle-container">
										<div className="data text-xs">
											{ calculatePercentage(
												window?.userData?.storage_used,
												window?.userData?.total_storage,
											) }
											%
										</div>
										<div
											className={ `circle ${
												calculatePercentage(
													window?.userData?.storage_used,
													window?.userData?.total_storage,
												) > 90
													? 'red'
													: ''
											}` }
											style={ {
												'--percentage':
											calculatePercentage(
												window?.userData?.storage_used,
												window?.userData?.total_storage,
											) + '%',
											} }
										></div>
									</div>
									<div className="leading-6">
										<div className="easydam-settings-label text-base">
											{ __( 'STORAGE', 'godam' ) }
										</div>
										<strong>{ __( 'Available: ', 'godam' ) }</strong>
										{ parseFloat(
											window?.userData?.total_storage -
										window?.userData?.storage_used,
										).toFixed( 2 ) }
										{ __( 'GB', 'godam' ) }
										<br />
										<strong>{ __( 'Used: ', 'godam' ) }</strong>
										{ parseFloat( window?.userData?.storage_used ).toFixed( 2 ) }
										{ __( 'GB', 'godam' ) }
									</div>
								</div>
							</>
						) }
					</div>
				</div>

				<div className="p-12 mx-auto">
					<div className="playback-country-container flex flex-wrap gap-4">
						<div className="playback-performance flex-grow basis-[60%]" id="global-analytics-container">
							<PlaybackPerformanceDashboard
								initialData={ dashboardMetricsHistory }
								mode="dashboard"
							/>
						</div>
						<div className="country-views flex-grow basis-[35%]">
							<div className="country-views-map" id="map-container"></div>
							<div className="country-views-table" id="table-container"></div>
						</div>
					</div>
				</div>

				<div className="top-media-container px-[20px]">
					<div className="flex justify-between pt-24">
						<h2>Top Videos</h2>
						<Button variant="primary" onClick={ handleExportCSV } className="export-button">
							<img src={ ExportBtn } alt="Export" className="export-icon" />
							Export
						</Button>
					</div>
					{ isTopVideosLoading ? (
						<div className="flex justify-center items-center min-h-[100px]">
							<div className="spinner-border animate-spin inline-block w-8 h-8 border-4 rounded-full text-blue-500 border-blue-500" role="status"></div>
						</div>
					) : (
						<table className="w-full pt-10">
							<tbody>
								<tr>
									<th>Name</th>
									<th>Size</th>
									<th>Play Rate</th>
									<th>Total Plays</th>
									<th>Total Watch Time</th>
									<th>Average Engagement</th>
								</tr>
								{ topVideosData?.map( ( item, index ) => (
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
								) ) }
							</tbody>
						</table>
					) }
					<div className="flex justify-end gap-4 mt-4">
						<Button
							isSecondary
							disabled={ topVideosPage === 1 }
							onClick={ () => setTopVideosPage( ( prev ) => Math.max( prev - 1, 1 ) ) }
						>
							Previous
						</Button>
						<Button
							isPrimary
							disabled={ topVideosPage >= totalTopVideosPages }
							onClick={ () => setTopVideosPage( ( prev ) => prev + 1 ) }
						>
							Next
						</Button>
					</div>
					<p className="text-sm text-gray-500">
						Page { topVideosPage } of { totalTopVideosPages }
					</p>
				</div>
			</div>
		</div>
	);
};

export default Dashboard;
