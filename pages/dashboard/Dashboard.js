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
import { generateMetricsOverTime } from '../analytics/helper';
import DefaultThumbnail from '../../assets/src/images/video-thumbnail-default.png';
import DownArrow from '../../assets/src/images/down-arrow.svg';
import TopArrow from '../../assets/src/images/up-arrow.svg';
import Tooltip from '../analytics/Tooltip.js';
import '../analytics/charts.js';

const Dashboard = () => {
	const [ topMediaList, setTopMediaList ] = useState( [] );
	const [ recentVideos, setRecentVideos ] = useState( [] );

	useEffect( () => {
		const mediaList = [
			{
				media_id: 55,
				plays: 5,
				page_load: 5,
				play_time: 5,
				video_length: 14,
				title: 'Video 1',
				size: '50MB',
				embedded_locations: [ 'www.google.com', 'https://rtcamp.com' ],
			},
			{
				media_id: 36,
				plays: 5,
				page_load: 5,
				play_time: 5,
				video_length: 14,
				title: 'Video 2',
				size: '50MB',
				embedded_locations: [ 'www.google.com', 'https://rtcamp.com' ],
			},
			{
				media_id: 32,
				plays: 5,
				page_load: 5,
				play_time: 5,
				video_length: 14,
				title: 'Video 3',
				size: '50MB',
				embedded_locations: [ 'www.google.com', 'https://rtcamp.com' ],
			},
			{
				media_id: 31,
				plays: 5,
				page_load: 5,
				play_time: 5,
				video_length: 14,
				title: 'Video 4',
				size: '50MB',
				embedded_locations: [],
			},
		];

		setTopMediaList( mediaList );
	}, [] );

	useEffect( () => {
		const timeMeticsChartData = [
			{
				date: '2025-04-02',
				engagement_rate: 47.8,
				play_rate: 64.3,
				watch_time: 132,
			},
			{
				date: '2025-04-01',
				engagement_rate: 45.2,
				play_rate: 60.1,
				watch_time: 120,
			},
			{
				date: '2025-03-31',
				engagement_rate: 46.5,
				play_rate: 62.7,
				watch_time: 125,
			},
			{
				date: '2025-03-30',
				engagement_rate: 44.9,
				play_rate: 59.8,
				watch_time: 118,
			},
			{
				date: '2025-03-29',
				engagement_rate: 42.3,
				play_rate: 58.4,
				watch_time: 114,
			},
			{
				date: '2025-03-28',
				engagement_rate: 43.7,
				play_rate: 61.2,
				watch_time: 124,
			},
			{
				date: '2025-03-27',
				engagement_rate: 48.6,
				play_rate: 65.0,
				watch_time: 138,
			},
			// Last 7 days complete here
			{
				date: '2025-03-26',
				engagement_rate: 44.1,
				play_rate: 59.6,
				watch_time: 121,
			},
			{
				date: '2025-03-25',
				engagement_rate: 41.5,
				play_rate: 57.8,
				watch_time: 112,
			},
			{
				date: '2025-03-24',
				engagement_rate: 45.9,
				play_rate: 62.5,
				watch_time: 126,
			},
			{
				date: '2025-03-23',
				engagement_rate: 51.2,
				play_rate: 67.8,
				watch_time: 145,
			},
			{
				date: '2025-03-22',
				engagement_rate: 49.7,
				play_rate: 66.1,
				watch_time: 141,
			},
			{
				date: '2025-03-21',
				engagement_rate: 47.3,
				play_rate: 63.4,
				watch_time: 130,
			},
			{
				date: '2025-03-20',
				engagement_rate: 45.8,
				play_rate: 61.9,
				watch_time: 128,
			},
			// Last 14 days complete here
			{
				date: '2025-03-19',
				engagement_rate: 42.6,
				play_rate: 58.1,
				watch_time: 115,
			},
			{
				date: '2025-03-18',
				engagement_rate: 44.5,
				play_rate: 60.5,
				watch_time: 122,
			},
			{
				date: '2025-03-17',
				engagement_rate: 46.8,
				play_rate: 63.0,
				watch_time: 131,
			},
			{
				date: '2025-03-16',
				engagement_rate: 48.9,
				play_rate: 64.7,
				watch_time: 135,
			},
			{
				date: '2025-03-15',
				engagement_rate: 52.3,
				play_rate: 68.4,
				watch_time: 147,
			},
			{
				date: '2025-03-14',
				engagement_rate: 50.6,
				play_rate: 67.1,
				watch_time: 143,
			},
			{
				date: '2025-03-13',
				engagement_rate: 47.5,
				play_rate: 63.8,
				watch_time: 133,
			},
			{
				date: '2025-03-12',
				engagement_rate: 45.0,
				play_rate: 60.9,
				watch_time: 123,
			},
			{
				date: '2025-03-11',
				engagement_rate: 43.2,
				play_rate: 59.2,
				watch_time: 119,
			},
			{
				date: '2025-03-10',
				engagement_rate: 41.8,
				play_rate: 58.6,
				watch_time: 116,
			},
			{
				date: '2025-03-09',
				engagement_rate: 44.3,
				play_rate: 61.4,
				watch_time: 127,
			},
			{
				date: '2025-03-08',
				engagement_rate: 46.2,
				play_rate: 62.0,
				watch_time: 129,
			},
			{
				date: '2025-03-07',
				engagement_rate: 48.3,
				play_rate: 64.2,
				watch_time: 136,
			},
			{
				date: '2025-03-06',
				engagement_rate: 50.1,
				play_rate: 66.7,
				watch_time: 140,
			},
			// Last 28 days complete here (also covers the 30-day option)
			{
				date: '2025-03-05',
				engagement_rate: 47.9,
				play_rate: 64.0,
				watch_time: 134,
			},
			{
				date: '2025-03-04',
				engagement_rate: 45.3,
				play_rate: 61.5,
				watch_time: 125,
			},
			// Additional data for 30 days
			{
				date: '2025-03-03',
				engagement_rate: 43.8,
				play_rate: 60.3,
				watch_time: 122,
			},
			{
				date: '2025-03-02',
				engagement_rate: 42.1,
				play_rate: 57.5,
				watch_time: 113,
			},
			// 30 days complete here
			{
				date: '2025-03-01',
				engagement_rate: 44.0,
				play_rate: 59.5,
				watch_time: 120,
			},
			{
				date: '2025-02-28',
				engagement_rate: 41.0,
				play_rate: 56.8,
				watch_time: 110,
			},
			{
				date: '2025-02-27',
				engagement_rate: 43.5,
				play_rate: 59.9,
				watch_time: 121,
			},
			{
				date: '2025-02-26',
				engagement_rate: 45.7,
				play_rate: 61.8,
				watch_time: 127,
			},
			{
				date: '2025-02-25',
				engagement_rate: 48.0,
				play_rate: 64.5,
				watch_time: 134,
			},
			{
				date: '2025-02-24',
				engagement_rate: 50.8,
				play_rate: 67.3,
				watch_time: 144,
			},
			{
				date: '2025-02-23',
				engagement_rate: 49.2,
				play_rate: 65.9,
				watch_time: 139,
			},
			{
				date: '2025-02-22',
				engagement_rate: 46.7,
				play_rate: 62.9,
				watch_time: 130,
			},
			{
				date: '2025-02-21',
				engagement_rate: 44.4,
				play_rate: 60.7,
				watch_time: 123,
			},
			{
				date: '2025-02-20',
				engagement_rate: 42.9,
				play_rate: 58.7,
				watch_time: 117,
			},
			{
				date: '2025-02-19',
				engagement_rate: 40.7,
				play_rate: 57.0,
				watch_time: 111,
			},
			{
				date: '2025-02-18',
				engagement_rate: 43.3,
				play_rate: 59.3,
				watch_time: 120,
			},
			{
				date: '2025-02-17',
				engagement_rate: 45.4,
				play_rate: 61.6,
				watch_time: 126,
			},
			{
				date: '2025-02-16',
				engagement_rate: 47.6,
				play_rate: 63.5,
				watch_time: 132,
			},
			{
				date: '2025-02-15',
				engagement_rate: 49.5,
				play_rate: 66.0,
				watch_time: 140,
			},
			{
				date: '2025-02-14',
				engagement_rate: 51.7,
				play_rate: 68.5,
				watch_time: 148,
			},
			{
				date: '2025-02-13',
				engagement_rate: 48.7,
				play_rate: 65.3,
				watch_time: 137,
			},
			{
				date: '2025-02-12',
				engagement_rate: 45.6,
				play_rate: 62.4,
				watch_time: 128,
			},
			{
				date: '2025-02-11',
				engagement_rate: 42.4,
				play_rate: 59.0,
				watch_time: 119,
			},
			{
				date: '2025-02-10',
				engagement_rate: 40.0,
				play_rate: 56.5,
				watch_time: 109,
			},
			{
				date: '2025-02-09',
				engagement_rate: 41.3,
				play_rate: 57.3,
				watch_time: 112,
			},
			{
				date: '2025-02-08',
				engagement_rate: 43.9,
				play_rate: 60.0,
				watch_time: 122,
			},
			{
				date: '2025-02-07',
				engagement_rate: 46.1,
				play_rate: 62.3,
				watch_time: 129,
			},
			{
				date: '2025-02-06',
				engagement_rate: 48.4,
				play_rate: 64.8,
				watch_time: 136,
			},
			{
				date: '2025-02-05',
				engagement_rate: 50.9,
				play_rate: 67.6,
				watch_time: 146,
			},
			{
				date: '2025-02-04',
				engagement_rate: 49.9,
				play_rate: 66.5,
				watch_time: 142,
			},
			{
				date: '2025-02-03',
				engagement_rate: 47.2,
				play_rate: 63.6,
				watch_time: 131,
			},
			{
				date: '2025-02-02',
				engagement_rate: 44.6,
				play_rate: 60.4,
				watch_time: 124,
			},
			{
				date: '2025-02-01',
				engagement_rate: 42.0,
				play_rate: 58.0,
				watch_time: 115,
			},
			// Complete 60-day dataset
		];
		generateMetricsOverTime( timeMeticsChartData, '#global-analytics-container' );
	}, [] );

	const handleExportCSV = () => {
		const headers = [
			'Title',
			'Media ID',
			'Embedded locations',
			'Size',
			'Play Rate',
			'Total Plays',
			'Watch Time',
			'Engagement Rate',
		];

		const rows = topMediaList.map( ( item ) => {
			const id = item.media_id;
			const locations = item.embedded_locations?.length
				? item.embedded_locations.join( '\n' ) // split by newline for CSV
				: 'No locations found!';
			return [
				'N/A',
				id,
				locations,
				item.size || '0',
				'0%',
				item.plays || '0',
				5,
				'0%',
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

	return (
		<div>
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
					<div className="analytics-stats">
						<img src={ DownArrow } height={ 20 } width={ 20 } alt="Stats dropped indicating icon" />
						<p>{ __( '-0.91% this week', 'godam' ) }</p>
					</div>
				</div>

				<div className="analytics-single-info">
					<p id="engagement-rate" className="min-w-[90px] text-[2rem] font-black mb-0 mt-0">
						54%
					</p>
					<div className="analytics-info-heading">
						<p>{ __( 'Average Engagement', 'godam' ) }</p>
						<Tooltip text="Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)" />
					</div>
					<div className="analytics-stats">
						<img src={ DownArrow } height={ 20 } width={ 20 } alt="Stats dropped indicating icon" />
						<p>{ __( '-0.91% this week', 'godam' ) }</p>
					</div>
				</div>

				<div className="analytics-single-info">
					<p id="engagement-rate" className="min-w-[90px] text-[2rem] font-black mb-0 mt-0">
						543,25
					</p>
					<div className="analytics-info-heading">
						<p>{ __( 'Plays', 'godam' ) }</p>
						<Tooltip text="Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)" />
					</div>
					<div className="analytics-stats">
						<img src={ TopArrow } height={ 20 } width={ 20 } alt="Stats dropped indicating icon" />
						<p>{ __( '+0.91% this week', 'godam' ) }</p>
					</div>
				</div>

				<div className="analytics-single-info">
					<p id="engagement-rate" className="min-w-[90px] text-[2rem] font-black mb-0 mt-0">
						45%
					</p>
					<div className="analytics-info-heading">
						<p>{ __( 'Play rate', 'godam' ) }</p>
						<Tooltip text="Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)" />
					</div>
					<div className="analytics-stats">
						<img src={ TopArrow } height={ 20 } width={ 20 } alt="Stats dropped indicating icon" />
						<p>{ __( '+0.91% this week', 'godam' ) }</p>
					</div>
				</div>

				<div className="analytics-single-info">
					<p id="watch-time" className="min-w-[90px] text-[2rem] font-black mb-0 mt-0">
						1234
					</p>
					<div className="analytics-info-heading">
						<p>{ __( 'Watch Time', 'godam' ) }</p>
						<Tooltip text="Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)" />
					</div>
					<div className="analytics-stats">
						<img src={ DownArrow } height={ 20 } width={ 20 } alt="Stats dropped indicating icon" />
						<p>{ __( '-0.91% this week', 'godam' ) }</p>
					</div>
				</div>

				<div className="analytics-single-info">
					<p id="watch-time" className="min-w-[90px] text-[2rem] font-black mb-0 mt-0">
						1234
					</p>
					<div className="analytics-info-heading">
						<p>{ __( 'Unique Views', 'godam' ) }</p>
						<Tooltip text="Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)" />
					</div>
					<div className="analytics-stats">
						<img src={ TopArrow } height={ 20 } width={ 20 } alt="Stats dropped indicating icon" />
						<p>{ __( '+0.91% this week', 'godam' ) }</p>
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

			<div className="top-media-container px-[20px]">
				<div className="flex justify-between pt-24">
					<h2>Top Media</h2>
					<Button variant="primary" onClick={ handleExportCSV }>
						Export
					</Button>
				</div>
				<table className="w-full pt-10">
					<tr>
						<th>Video</th>
						<th>Embedded Locations</th>
						<th>Size</th>
						<th>Play Rate</th>
						<th>Total Plays</th>
						<th>Total Watch Time</th>
						<th>Average Engagement</th>
						<th>View Analytics</th>
					</tr>
					{ topMediaList?.map( ( item, index ) => (
						<tr key={ index }>
							<td className="flex gap-6">
								<img
									src={ DefaultThumbnail }
									height={ 100 }
									width={ 190 }
									alt="Video thumbnail"
								/>
								<p className="w-full max-w-40 text-left flex-1">
									{ item.title }
								</p>
							</td>
							<td>
								{ item.embedded_locations?.length > 0 ? (
									item.embedded_locations?.map( ( location, key ) => (
										<a key={ key } href={ location }>
											{ location }
											<br />
										</a>
									) )
								) : (
									<p>No locations found!</p>
								) }
							</td>
							<td>{ item.size }</td>
							<td>5%</td>
							<td>5</td>
							<td>{ item.plays }</td>
							<td>10%</td>
							<td>
								<p>
									View
								</p>
							</td>
						</tr>
					) ) }
				</table>
			</div>
		</div>
	);
};

export default Dashboard;
