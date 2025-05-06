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
import Tooltip from './Tooltip';
import {
	useFetchAnalyticsDataQuery,
	useFetchProcessedAnalyticsHistoryQuery,
} from './redux/api/analyticsApi';
import { calculateEngagementRate, calculatePlayRate } from './helper';
import DOMPurify from 'isomorphic-dompurify';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Button, Spinner } from '@wordpress/components';

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

	// Query for last 60 days of processed analytics history
	const {
		data: processedAnalyticsHistory,
	} = useFetchProcessedAnalyticsHistoryQuery(
		{ videoId: attachmentID, siteUrl, days: 60 },
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

	async function startABTesting() {
		setIsABResultsLoading( true );
		await refetch();
		if ( abTestComparisonAttachmentData ) {
			await refetchAB();
		}
		setIsABResultsLoading( false );
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
										<div className="analytics-info flex justify-between max-lg:flex-col">
											<div className="analytics-single-info">
												<div className="analytics-info-heading">
													<p>{ __( 'Average Engagement', 'godam' ) }</p>
													<Tooltip text={ __( 'Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)', 'godam' ) } />
												</div>
												<p
													id="engagement-rate"
													className="min-w-[90px] engagement-rate"
												>
													0%
												</p>
												<p id="avg-engagement-change" className="metric-change">+0% this week</p>
											</div>
										</div>
										<div className="analytics-info flex justify-between  max-lg:flex-col">
											<div className="analytics-single-info">
												<div className="analytics-info-heading">
													<p>{ __( 'Total Plays', 'godam' ) }</p>
													<Tooltip text={ __( 'Plays represent the total number of times the video has been viewed', 'godam' ) } />
												</div>
												<p
													id="total-plays"
													className="min-w-[90px] engagement-rate"
												>
													0
												</p>
												<p id="views-change" className="metric-change">{ __( '+0% this week', 'godam' ) }</p>
											</div>
										</div>
										<div className="analytics-info flex justify-between  max-lg:flex-col">
											<div className="analytics-single-info">
												<div className="analytics-info-heading">
													<p>{ __( 'Play Rate', 'godam' ) }</p>
													<Tooltip text={ __( 'Play rate is the percentage of page visitors who clicked play. Play Rate = Total plays / Page loads', 'godam' ) } />
												</div>
												<p
													id="play-rate"
													className="min-w-[90px] engagement-rate"
												>
													0%
												</p>
												<p id="play-rate-change" className="metric-change">+0% this week</p>
											</div>
										</div>
										<div className="analytics-info flex justify-between  max-lg:flex-col">
											<div className="analytics-single-info">
												<div className="analytics-info-heading">
													<p>{ __( 'Watch Time', 'godam' ) }</p>
													<Tooltip text={ __( 'Total time the video has been watched, aggregated across all plays.', 'godam' ) } />
												</div>
												<p id="watch-time" className="min-w-[90px] engagement-rate">0s</p>
												<p id="watch-time-change" className="metric-change">{ __( '+0% this week', 'godam' ) }</p>
											</div>
										</div>
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
											<div id="heatmap-container" className="mt-4">
												<h3 className="text-md mb-2 flex gap-2">
													{ __( 'Heatmap', 'godam' ) }
													<Tooltip text={ __( 'Heatmap visualizes per-second view density, identifying peaks of plays, skipped sections, and audience drop-offs. Darker areas indicate higher engagement', 'godam' ) } />
												</h3>
												<svg id="heatmap" width="640" height="100"></svg>
												<div className="heatmap-tooltip"></div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div>
						<div className="text-center">
							<h3 className="text-md mb-4">{ __( 'Time Series Overview', 'godam' ) }</h3>
							<svg id="metrics-chart" width="900" height="500"></svg>
						</div>
						<div
							className="country-heatmap-container text-center"
							id="country-heatmap-container"
						>
							<h3 className="text-md mb-4">{ __( 'Geographical Heatmap', 'godam' ) }</h3>
							<div id="map-container"></div>
							<div id="table-container" className="px-12"></div>
						</div>
					</div>

					<div className="posts-count-container">
						<h2>{ __( 'Video Views by Post Source', 'godam' ) }</h2>
						<div id="post-views-count-chart" className="text-center"></div>
						<div className="legend" id="legend"></div>
						<div className="total-views" id="total-views"></div>
					</div>

					<div className="px-10 py-28">
						<div className="flex justify-between">
							<h3>{ __( 'Video Comparison', 'godam' ) }</h3>
							{ attachmentData && abTestComparisonAttachmentData && (
								<div className="flex gap-4">
									<Button variant="secondary" onClick={ () => {
										setAbTestComparisonAttachmentData( null );
										setAbComparisonUrl( '' );
										setAbTestComparisonAnalyticsData( null );
									} }>
										{ __( 'Remove', 'godam' ) }
									</Button>
									<Button variant="primary" onClick={ () => startABTesting() }>
										{ __( 'Start Comparison Test', 'godam' ) }
									</Button>
								</div>
							) }
						</div>
						<div className="flex justify-center w-full">
							<div className="flex-1 border-2 border-solid flex justify-center items-center flex-col pt-4">
								<RenderVideo
									attachmentData={ attachmentData }
									attachmentID={ attachmentID }
									className="w-full h-full max-h-[300px]"
								/>
								<div>
									<h4>{ attachmentData?.title?.rendered }</h4>
									<p className="text-center">
										{ analyticsData?.plays ?? 0 } views
									</p>
								</div>
							</div>
							<div className="flex-1 border-2 border-solid">
								{ abTestComparisonUrl.length === 0 && (
									<div className="flex justify-center items-center h-full flex-1 border-2 border-solid">
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
									<div className="flex justify-center items-center flex-col pt-4 h-full w-full flex-1 border-2 border-solid">

										<RenderVideo
											attachmentData={ abTestComparisonAttachmentData }
											attachmentID={ abTestComparisonAttachmentData?.id }
											className="w-full h-full max-h-[300px]"
										/>
										<div>
											<h4>{ abTestComparisonAttachmentData?.title?.rendered }</h4>
											<p className="text-center">
												{ abTestComparisonAnalyticsData?.plays ?? 0 } views
											</p>
										</div>
									</div>
								) }
							</div>
						</div>
						{ isABResultsLoading ? (
							<div className="flex justify-center items-center py-20">
								<Spinner />
							</div>
						) : (
							analyticsData && abTestComparisonAnalyticsData && (
								<table className="w-full ab-testing-table">
									<tbody>
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
							) ) }
					</div>
				</div>
			) }
		</div>
	);
};

export default Analytics;
