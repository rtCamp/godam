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
import { generateMetricsOverTime, generateCountryHeatmap } from '../analytics/helper';
import DefaultThumbnail from '../../assets/src/images/video-thumbnail-default.png';
import DownArrow from '../../assets/src/images/down-arrow.svg';
import TopArrow from '../../assets/src/images/up-arrow.svg';
import Tooltip from '../analytics/Tooltip.js';
import { useFetchDashboardMetricsQuery, useFetchDashboardMetricsHistoryQuery, useFetchTopVideosQuery } from './redux/api/dashboardAnalyticsApi';

const Dashboard = () => {
	const [ recentVideos, setRecentVideos ] = useState( [] );
	const [ topVideosPage, setTopVideosPage ] = useState( 1 );
	const siteUrl = window.location.origin;
	const adminUrl = window.videoData?.adminUrl;

	const { data: dashboardMetrics, isLoading: isDashboardMetricsLoading } = useFetchDashboardMetricsQuery( { siteUrl } );
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
			! isDashboardMetricsHistoryLoading &&
			dashboardMetricsHistory &&
			dashboardMetricsHistory.length > 0
		) {
			const transformedData = dashboardMetricsHistory.map( ( item ) => ( {
				date: item.date,
				engagement_rate: item.avg_engagement,
				play_rate: item.play_rate * 100,
				watch_time: item.watch_time,
			} ) );

			// Poll for the container to exist in the DOM
			const interval = setInterval( () => {
				const container = document.querySelector( '#global-analytics-container' );
				if ( container ) {
					clearInterval( interval );
					generateMetricsOverTime( transformedData, '#global-analytics-container' );
				}
			}, 100 );

			return () => clearInterval( interval );
		}
	}, [ isDashboardMetricsHistoryLoading, dashboardMetricsHistory ] );

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
				item.video_id,
				'0',
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
		const fetchRecentVideos = async () => {
			// Calculate date 7 days ago
			const date = new Date();
			date.setDate( date.getDate() - 7 );
			const isoDate = date.toISOString(); // e.g., "2025-04-01T12:00:00.000Z"

			const url = `/wp-json/wp/v2/media?media_type=video&after=${ isoDate }&per_page=100`;

			try {
				const response = await fetch( url );
				const data = await response.json();
				setRecentVideos( data ); // if using state
			} catch ( error ) {
			}
		};

		fetchRecentVideos();
	}, [] );

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

				<div className="analytics-info">
					<div className="analytics-single-info">
						<p id="total-videos" className="min-w-[90px] text-[2rem] font-black mb-0 mt-0">
							45
						</p>
						<div className="analytics-info-heading">
							<p>{ __( 'Total Videos', 'godam' ) }</p>
							<Tooltip text="Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)" />
						</div>
					</div>

					<div className="analytics-single-info">
						<p id="dashboard-engagement-rate" className="min-w-[90px] text-[2rem] font-black mb-0 mt-0">
							{ dashboardMetrics?.avg_engagement?.toFixed( 2 ) || 0 }%
						</p>
						<div className="analytics-info-heading">
							<p>{ __( 'Average Engagement', 'godam' ) }</p>
							<Tooltip text="Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)" />
						</div>
						<div className="analytics-stats">
							<img
								src={ dashboardMetrics?.avg_engagement_change >= 0 ? TopArrow : DownArrow }
								height={ 20 }
								width={ 20 }
								alt="Engagement change arrow"
							/>
							<p>{ dashboardMetrics?.avg_engagement_change !== null ? `${ dashboardMetrics?.avg_engagement_change > 0 ? '+' : '' }${ dashboardMetrics?.avg_engagement_change }% this week` : '-' }</p>
						</div>
					</div>

					<div className="analytics-single-info">
						<p id="dashboard-plays" className="min-w-[90px] text-[2rem] font-black mb-0 mt-0">
							{ dashboardMetrics?.plays || 0 }
						</p>
						<div className="analytics-info-heading">
							<p>{ __( 'Plays', 'godam' ) }</p>
							<Tooltip text="Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)" />
						</div>
						<div className="analytics-stats">
							<img
								src={ dashboardMetrics?.views_change >= 0 ? TopArrow : DownArrow }
								height={ 20 }
								width={ 20 }
								alt="Engagement change arrow"
							/>
							<p>{ dashboardMetrics?.views_change !== null ? `${ dashboardMetrics?.views_change > 0 ? '+' : '' }${ dashboardMetrics?.views_change }% this week` : '-' }</p>
						</div>
					</div>

					<div className="analytics-single-info">
						<p id="dashboard-play-rate" className="min-w-[90px] text-[2rem] font-black mb-0 mt-0">
							{ ( ( dashboardMetrics?.plays || 0 ) / ( dashboardMetrics?.page_load || 1 ) * 100 ).toFixed( 2 ) }%
						</p>
						<div className="analytics-info-heading">
							<p>{ __( 'Play rate', 'godam' ) }</p>
							<Tooltip text="Play rate is the percentage of viewers who visit the page that play the video" />
						</div>
						<div className="analytics-stats">
							<img
								src={ dashboardMetrics?.play_rate_change >= 0 ? TopArrow : DownArrow }
								height={ 20 }
								width={ 20 }
								alt="Engagement change arrow"
							/>
							<p>{ dashboardMetrics?.play_rate_change !== null ? `${ dashboardMetrics?.play_rate_change > 0 ? '+' : '' }${ dashboardMetrics?.play_rate_change }% this week` : '-' }</p>
						</div>
					</div>

					<div className="analytics-single-info">
						<p id="dashboard-watch-time" className="min-w-[90px] text-[2rem] font-black mb-0 mt-0">
							{ dashboardMetrics?.play_time?.toFixed( 2 ) || 0 }s
						</p>
						<div className="analytics-info-heading">
							<p>{ __( 'Watch Time', 'godam' ) }</p>
							<Tooltip text="Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)" />
						</div>
						<div className="analytics-stats">
							<img
								src={ dashboardMetrics?.watch_time_change >= 0 ? TopArrow : DownArrow }
								height={ 20 }
								width={ 20 }
								alt="Engagement change arrow"
							/>
							<p>{ dashboardMetrics?.watch_time_change !== null ? `${ dashboardMetrics?.watch_time_change > 0 ? '+' : '' }${ dashboardMetrics?.watch_time_change }% this week` : '-' }</p>
						</div>
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
					{
						recentVideos && (
							<div className="bg-white p-12">
								<div className="flex justify-between">
									<div>
										<h2>Latest Videos</h2>
										<p>Videos from last 7 days</p>
									</div>
									<Button variant="primary" onClick={ () => window.location.href = '/wp-admin/upload.php' }>View All</Button>
								</div>
								<div className="flex gap-6 max-w-[1194px] overflow-scroll">
									{
										recentVideos.map( ( video, index ) => (
											<div key={ index }>
												<img
													src={ video.meta?.rtgodam_media_video_thumbnail || DefaultThumbnail }
													height={ 100 }
													width={ 190 }
													alt="Video thumbnail"
												/>
												<p>{ video.title?.rendered }</p>
												<a href={ `admin.php?page=rtgodam_analytics&id=${ video.id }` } className="text-blue-500">View Analytics</a><br />
												<a href={ `/wp-admin/upload.php?item=${ video.id }` } className="text-blue-500">View Video</a>
											</div>
										) )
									}
								</div>
							</div>
						)
					}
				</div>

				<div id="global-analytics-container" className="p-12 mx-auto"></div>
				<div className="p-12 mx-auto">
					<h2>Views by Country</h2>
					<div id="map-container" className="mb-10"></div>
					<div id="table-container"></div>
				</div>

				<div className="top-media-container px-[20px]">
					<div className="flex justify-between pt-24">
						<h2>Top Media</h2>
						<Button variant="primary" onClick={ handleExportCSV }>
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
									<th>Video</th>
									<th>Size</th>
									<th>Play Rate</th>
									<th>Total Plays</th>
									<th>Total Watch Time</th>
									<th>Average Engagement</th>
									<th>View Analytics</th>
								</tr>
								{ topVideosData?.map( ( item, index ) => (
									<tr key={ index }>
										<td>
											<div className="flex gap-6 items-center">
												<img
													src={ DefaultThumbnail }
													height={ 100 }
													width={ 190 }
													alt="Video thumbnail"
												/>
												<div className="w-full max-w-40 text-left flex-1">
													<p>{ `Video ID: ${ item.video_id }` }</p>
												</div>
											</div>
										</td>
										<td>0 MB</td> { /* Placeholder, can replace later */ }
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
										<td>
											<a
												href={ `admin.php?page=rtgodam_analytics&id=${ item.video_id }` }
												className="text-blue-500"
											>
												View
											</a>
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
