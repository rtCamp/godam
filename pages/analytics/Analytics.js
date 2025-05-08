/**
 * External dependencies
 */
import React, { useState, useEffect } from 'react';
import 'video.js/dist/video-js.css';

/**
 * Internal dependencies
 */
import '../video-editor/style.scss';
import axios from 'axios';
import GodamHeader from '../godam/GodamHeader';
import {
	useFetchAnalyticsDataQuery,
	useFetchProcessedAnalyticsHistoryQuery,
} from './redux/api/analyticsApi';
import { calculateEngagementRate, calculatePlayRate } from './helper';
import DOMPurify from 'isomorphic-dompurify';
import './charts.js';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Button, Spinner } from '@wordpress/components';
import SingleMetrics from './SingleMetrics.js';
import PlaybackPerformanceDashboard from './PlaybackPerformance.js';

const adminUrl =
  window.videoData?.adminUrl;
const restURL = window.godamRestRoute.url || '';

const RenderVideo = ( { attachmentID, attachmentData, className } ) => {
	const getMimiType = ( mime ) => {
		if ( mime === 'video/quicktime' ) {
			return 'video/mp4';
		}

		return mime;
	};

	return (
		<video id="analytics-video" className={ `video-js ${ className }` } data-id={ attachmentID }>
			<source
				src={ attachmentData.source_url || '' }
				type={ getMimiType( attachmentData.mime_type ) || 'video/mp4' }
			/>
			{ attachmentData?.meta?.rtgodam_transcoded_url && (
				<source
					src={ attachmentData?.meta?.rtgodam_transcoded_url || '' }
					type={
						attachmentData?.meta?.rtgodam_transcoded_url.endsWith( '.mpd' )
							? 'application/dash+xml'
							: ''
					}
				/>
			) }
		</video>
	);
};

const Analytics = ( { attachmentID } ) => {
	const [ attachmentData, setAttachmentData ] = useState( null );
	const [ analyticsData, setAnalyticsData ] = useState( null );
	const [ abTestComparisonUrl, setAbComparisonUrl ] = useState( '' );
	const [ abTestComparisonAttachmentData, setAbTestComparisonAttachmentData ] = useState( null );
	const [ abTestComparisonAnalyticsData, setAbTestComparisonAnalyticsData ] =
		useState( null );
	const [ isABResultsLoading, setIsABResultsLoading ] = useState( false );
	const [ isABTestCompleted, setIsABTestCompleted ] = useState( false );

	// RTK Query hooks
	const siteUrl = window.location.origin;
	const {
		data: analyticsDataFetched,
		refetch,
	} = useFetchAnalyticsDataQuery(
		{ videoId: attachmentID, siteUrl },
		{ skip: ! attachmentID },
	);

	window.analyticsDataFetched = analyticsDataFetched;

	// Query for last 30 days of processed analytics history
	const {
		data: processedAnalyticsHistory,
	} = useFetchProcessedAnalyticsHistoryQuery(
		{ videoId: attachmentID, siteUrl, days: 7 },
		{ skip: ! attachmentID },
	);

	window.processedAnalyticsHistory = processedAnalyticsHistory;

	const {
		data: abTestComparisonAnalyticsDataFetched,
		refetch: refetchAB,
	} = useFetchAnalyticsDataQuery(
		{
			videoId: abTestComparisonAttachmentData?.id,
			siteUrl,
		},
		{ skip: ! abTestComparisonAttachmentData?.id },
	);

	// Sync main analytics data
	useEffect( () => {
		if ( analyticsDataFetched?.errorType === 'invalid_key' ) {
			const loadingEl = document.getElementById( 'loading-analytics-animation' );
			const container = document.getElementById( 'video-analytics-container' );
			const overlay = document.getElementById( 'api-key-overlay' );
			if ( loadingEl ) {
				loadingEl.style.display = 'none';
			}
			if ( container ) {
				container.classList.remove( 'hidden' );
			}
			if ( container ) {
				container.classList.add( 'blurred' );
			}
			if ( overlay ) {
				overlay.classList.remove( 'hidden' );
			}
		} else if ( analyticsDataFetched ) {
			setAnalyticsData( analyticsDataFetched );
		}
	}, [ analyticsDataFetched ] );

	// Sync A/B test comparison data
	useEffect( () => {
		if ( abTestComparisonAnalyticsDataFetched ) {
			setAbTestComparisonAnalyticsData( abTestComparisonAnalyticsDataFetched );
			setIsABResultsLoading( false );
			setIsABTestCompleted( true );
		}
	}, [ abTestComparisonAnalyticsDataFetched ] );

	useEffect( () => {
		if ( attachmentID ) {
			const url = window.pathJoin( [ restURL, `/wp/v2/media/${ attachmentID }` ] );

			axios
				.get( url )
				.then( ( response ) => {
					const data = response.data;
					setAttachmentData( data );
				} );
		}
	}, [ attachmentID ] );

	// useEffect( () => {
	// 	const performanceHistory = ( processedAnalyticsHistory || [] ).map(
	// 		( entry ) => {
	// 			const {
	// 				date,
	// 				page_load: dailyPageLoad,
	// 				play_time: dailyPlayTime,
	// 				video_length: dailyVideoLength,
	// 				plays: dailyPlays,
	// 			} = entry;

	// 			const dailyEngagementRate =
	//       dailyPlays && dailyVideoLength ? ( dailyPlayTime / ( dailyPlays * dailyVideoLength ) ) * 100 : 0;

	// 			const dailyPlayRate = dailyPageLoad
	// 				? ( dailyPlays / dailyPageLoad ) * 100
	// 				: 0;

	// 			return {
	// 				date,
	// 				engagement_rate: +dailyEngagementRate.toFixed( 2 ),
	// 				play_rate: +dailyPlayRate.toFixed( 2 ),
	// 				watch_time: +dailyPlayTime.toFixed( 2 ),
	// 			};
	// 		},
	// 	);

	// 	setTimeMetricsChartData( performanceHistory );
	// }, [ processedAnalyticsHistory ] );

	async function startABTesting() {
		setIsABResultsLoading( true );
		setIsABTestCompleted( false );
		await refetch();
		if ( abTestComparisonAttachmentData ) {
			await refetchAB();
		}
	}

	const openVideoUploader = () => {
		const fileFrame = wp.media( {
			title: __( 'Select Video to Perform A/B testing', 'godam' ),
			button: {
				text: __( 'Use this Video', 'godam' ),
			},
			library: {
				type: 'video',
			},
			multiple: false,
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();

			setAbComparisonUrl( attachment.url );

			const url = window.pathJoin( [ restURL, `/wp/v2/media/${ attachment?.id }` ] );

			axios.get( url ).then( ( response ) => {
				const data = response.data;
				setAbTestComparisonAttachmentData( data );
			} );
		} );

		fileFrame.open();
	};

	const engagementRate = calculateEngagementRate(
		analyticsData?.plays,
		analyticsData?.video_length,
		analyticsData?.play_time,
	);

	const comparisonEngagementRate = calculateEngagementRate(
		abTestComparisonAnalyticsData?.plays,
		abTestComparisonAnalyticsData?.video_length,
		abTestComparisonAnalyticsData?.play_time,
	);

	const playRate = calculatePlayRate(
		analyticsData?.page_load,
		analyticsData?.plays,
	);

	const comparisonPlayRate = calculatePlayRate(
		abTestComparisonAnalyticsData?.page_load,
		abTestComparisonAnalyticsData?.plays,
	);

	const plays = analyticsData?.plays;

	const comparisonPlays = abTestComparisonAnalyticsData?.plays;

	const highlightClass = ( a, b ) => {
		if ( a > b ) {
			return 'left-greater';
		}
		if ( a < b ) {
			return 'right-greater';
		}
		return 'left-greater right-greater';
	};

	// const timeMetricsChartData = ( processedAnalyticsHistory || [] ).map(
	// 	( entry ) => {
	// 		const {
	// 			date,
	// 			page_load: dailyPageLoad,
	// 			play_time: dailyPlayTime,
	// 			video_length: dailyVideoLength,
	// 			plays: dailyPlays,
	// 		} = entry;

	// 		const dailyEngagementRate =
	//     dailyPlays && dailyVideoLength
	//     	? ( dailyPlayTime / ( dailyPlays * dailyVideoLength ) ) * 100
	//     	: 0;

	// 		const dailyPlayRate = dailyPageLoad
	// 			? ( dailyPlays / dailyPageLoad ) * 100
	// 			: 0;

	// 		return {
	// 			date,
	// 			engagement_rate: +dailyEngagementRate.toFixed( 2 ),
	// 			play_rate: +dailyPlayRate.toFixed( 2 ),
	// 			watch_time: +dailyPlayTime.toFixed( 2 ),
	// 		};
	// 	},
	// );

	return (
		<div className="godam-analytics-container">
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
						{ __( ' to access the Analytics feature', 'godam' ) }
					</p>
				</div>
			</div>

			{ attachmentData && (
				<div id="analytics-content" className="hidden">
					<div className="p-10 flex gap-3 items-center">
						<h2 className="text-2xl m-0 capitalize" dangerouslySetInnerHTML={ { __html: DOMPurify.sanitize( attachmentData?.title?.rendered ) } }>
						</h2>
						{ attachmentData?.media_details?.length_formatted &&
							<span className="h-[26px] px-2 bg-white flex items-center rounded-sm">
								{ attachmentData?.media_details?.length_formatted }
							</span>
						}
					</div>

					<div className="subheading-container">
						<div className="subheading">{ __( 'Overview', 'godam' ) }</div>
					</div>
					<div
						id="video-analytics-container"
						className="video-analytics-container hidden"
					>
						<div className="overflow-auto">
							<div className="flex gap-10 items-start max-lg:flex-col">
								<div className="min-w-[350px] max-w-[350px] flex-grow">
									<div className="analytics-info-container max-lg:flex-row flex-col">
										<SingleMetrics
											metricType={ 'engagement-rate' }
											label={ __( 'Average Engagement', 'godam' ) }
											tooltipText={ __( 'Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)', 'godam' ) }
											processedAnalyticsHistory={ processedAnalyticsHistory }
											analyticsDataFetched={ analyticsDataFetched }
										/>

										<SingleMetrics
											metricType={ 'plays' }
											label={ __( 'Total Plays', 'godam' ) }
											tooltipText={ __( 'Plays represent the total number of times the video has been viewed', 'godam' ) }
											processedAnalyticsHistory={ processedAnalyticsHistory }
											analyticsDataFetched={ analyticsDataFetched }
										/>

										<SingleMetrics
											metricType={ 'play-rate' }
											label={ __( 'Play Rate', 'godam' ) }
											tooltipText={ __( 'Play rate is the percentage of page visitors who clicked play. Play Rate = Total plays / Page loads', 'godam' ) }
											processedAnalyticsHistory={ processedAnalyticsHistory }
											analyticsDataFetched={ analyticsDataFetched }
										/>

										<SingleMetrics
											metricType={ 'watch-time' }
											label={ __( 'Watch Time', 'godam' ) }
											tooltipText={ __( 'Total time the video has been watched, aggregated across all plays', 'godam' ) }
											processedAnalyticsHistory={ processedAnalyticsHistory }
											analyticsDataFetched={ analyticsDataFetched }
										/>
									</div>
								</div>
								<div className="min-w-[750px]">
									<div>
										<div className="video-container">
											<RenderVideo
												attachmentData={ attachmentData }
												attachmentID={ attachmentID }
											/>
											<div className="video-chart-container">
												<div id="chart-container">
													<svg id="line-chart" width="640" height="300"></svg>
													<div className="line-chart-tooltip"></div>
												</div>
											</div>
										</div>
										<div className="video-container">
											{ /* <div id="heatmap-container" className="mt-4">
												<h3 className="text-md mb-2 flex gap-2">
													{ __( 'Heatmap', 'godam' ) }
													<Tooltip text={ __( 'Heatmap visualizes per-second view density, identifying peaks of plays, skipped sections, and audience drop-offs. Darker areas indicate higher engagement', 'godam' ) } />
												</h3>
												<svg id="heatmap" width="640" height="100"></svg>
												<div className="heatmap-tooltip"></div>
											</div> */ }
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div className="grid grid-cols-[3fr_1fr_1fr] gap-4">
						{ /* <div className="text-center bg-white border border-zinc-200 rounded p-4">
							<h3 className="text-base font-medium text-zinc-700 mb-2">{ __( 'Playback Performance', 'godam' ) }</h3>
							<svg id="metrics-chart"></svg>
						</div> */ }
						<PlaybackPerformanceDashboard attachmentID={ attachmentID } initialData={ processedAnalyticsHistory } />
						<div
							className="country-heatmap-container text-center bg-white border border-zinc-200 rounded p-4"
							id="country-heatmap-container"
						>
							<h3 className="text-base font-medium text-zinc-700 mb-2">{ __( 'Geographical Heatmap', 'godam' ) }</h3>
							<div id="map-container"></div>
							<div id="table-container" className="px-12"></div>
						</div>
						<div className="posts-count-container lg:col-span-1 bg-white border border-zinc-200 rounded p-4">
							<h2 className="text-base font-medium text-zinc-700 mb-2">{ __( 'Views by Post Source', 'godam' ) }</h2>
							<div id="post-views-count-chart" className="text-center"></div>
							<div className="legend" id="legend"></div>
							<div className="total-views" id="total-views"></div>
						</div>
					</div>

					<div className="px-10 py-28">
						<div>
							<h3>{ __( 'Performance Comparison', 'godam' ) }</h3>
							<div>
								{ attachmentData && abTestComparisonAttachmentData && (
									<div className="flex gap-4 bg-zinc-100 justify-between py-4 [padding-left:22px] [padding-right:22px] rounded-xl mb-6 items-center">
										{ ( () => {
											if ( ! isABTestCompleted ) {
												if ( isABResultsLoading ) {
													return (
														<p>
															{ __( 'In Progress', 'godam' ) }
															<Spinner />
														</p>
													);
												}
												return __( 'Initiate the test comparison to generate analytical insights.', 'godam' );
											}
											return __( 'The test is complete! Review results to identify the best-performing video.', 'godam' );
										} )() }
										{ ! isABResultsLoading && ! isABTestCompleted && (
											<div className="flex gap-3">
												<Button variant="secondary" onClick={ () => {
													setAbTestComparisonAttachmentData( null );
													setAbComparisonUrl( '' );
													setAbTestComparisonAnalyticsData( null );
												} }>
													{ __( 'Remove', 'godam' ) }
												</Button>
												<Button variant="primary" onClick={ () => startABTesting() }>
													{ __( 'Start Test ', 'godam' ) }
												</Button>
											</div>
										) }

										{
											isABTestCompleted && (
												<div className="flex gap-3">
													<Button variant="secondary" onClick={ () => {
														setAbTestComparisonAnalyticsData( null );
														startABTesting();
													} }>
														{ __( 'Restart Test ', 'godam' ) }
													</Button>
													<Button variant="primary" onClick={ () => {
														setAbTestComparisonAttachmentData( null );
														setAbComparisonUrl( '' );
														setAbTestComparisonAnalyticsData( null );
														openVideoUploader();
													} }>
														{ __( 'Choose Video', 'godam' ) }
													</Button>
												</div>
											)
										}
									</div>
								) }
							</div>
						</div>
						<div className="flex justify-center w-full">
							<div className="flex-1 flex justify-center items-center flex-col pt-4 [border-top-left-radius:12px] [border-top-right-radius:0px] [border-bottom-left-radius:12px] [border-bottom-right-radius:0px]">
								<RenderVideo
									attachmentData={ attachmentData }
									attachmentID={ attachmentID }
									className="w-full h-full max-h-[300px] object-fill"
								/>
								<div>
									<h4>{ attachmentData?.title?.rendered }</h4>
								</div>
							</div>
							<div className="flex-1">
								{ abTestComparisonUrl.length === 0 && (
									<div className="flex justify-center items-center h-full flex-1 [border-top-left-radius:0px] [border-top-right-radius:12px] [border-bottom-left-radius:0px] [border-bottom-right-radius:12px]">
										<Button
											onClick={ openVideoUploader }
											variant="primary"
											className="ml-2"
											aria-label={ __( 'Upload or Replace CTA Image', 'godam' ) }
										>
											{ __( 'Select Video', 'godam' ) }
										</Button>
									</div>
								) }

								{ ! abTestComparisonAttachmentData &&
									abTestComparisonUrl.length > 0 &&
									(
										<div className="flex justify-center items-center flex-col pt-4 h-full w-full flex-1 border-2 border-solid">
											<Spinner />
										</div>
									) }
								{ abTestComparisonAttachmentData && (
									<div className="flex justify-center items-center flex-col pt-4 h-full w-full flex-1">

										<RenderVideo
											attachmentData={ abTestComparisonAttachmentData }
											attachmentID={ abTestComparisonAttachmentData?.id }
											className="w-full h-full max-h-[300px] object-fill"
										/>
										<div>
											<h4>{ abTestComparisonAttachmentData?.title?.rendered }</h4>
										</div>
									</div>
								) }
							</div>
						</div>
						{
							analyticsData && abTestComparisonAnalyticsData && (
								<table className="w-full ab-testing-table rounded-xl">
									<tbody>
										<tr className={ highlightClass( analyticsData?.plays, abTestComparisonAnalyticsData?.plays ?? 0 ) }>
											<td>{ analyticsData?.plays }</td>
											<td>{ __( 'Views', 'godam' ) }</td>
											<td>{ abTestComparisonAnalyticsData?.plays ?? 0 }</td>
										</tr>
										<tr className={ highlightClass( engagementRate, comparisonEngagementRate ) }>
											<td>{ engagementRate }</td>
											<td>{ __( 'Average Engagement', 'godam' ) }</td>
											<td>{ comparisonEngagementRate }</td>
										</tr>
										<tr className={ highlightClass( plays, comparisonPlays ) }>
											<td>{ plays }</td>
											<td>{ __( 'Total Plays', 'godam' ) }</td>
											<td>{ comparisonPlays }</td>
										</tr>
										<tr className={ highlightClass( playRate, comparisonPlayRate ) }>
											<td>{ playRate }</td>
											<td>{ __( 'Play Rate', 'godam' ) }</td>
											<td>{ comparisonPlayRate }</td>
										</tr>
										<tr className={ highlightClass( analyticsData?.page_load, abTestComparisonAnalyticsData?.page_load ) }>
											<td>{ analyticsData?.page_load }</td>
											<td>{ __( 'Page Loads', 'godam' ) }</td>
											<td>{ abTestComparisonAnalyticsData?.page_load }</td>
										</tr>
										<tr className={ highlightClass( analyticsData?.play_time, abTestComparisonAnalyticsData?.play_time ) }>
											<td>{ analyticsData?.play_time?.toFixed( 2 ) }s</td>
											<td>{ __( 'Play Time', 'godam' ) }</td>
											<td>{ abTestComparisonAnalyticsData?.play_time?.toFixed( 2 ) }s</td>
										</tr>
										<tr>
											<td>{ analyticsData?.video_length }s</td>
											<td>{ __( 'Video Length', 'godam' ) }</td>
											<td>{ abTestComparisonAnalyticsData?.video_length }s</td>
										</tr>
									</tbody>
								</table>
							) }
					</div>
				</div>
			) }
		</div>
	);
};

export default Analytics;
