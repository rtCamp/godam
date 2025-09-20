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
import GodamHeader from '../godam/components/GoDAMHeader.jsx';
import {
	useFetchAnalyticsDataQuery,
	useFetchProcessedAnalyticsHistoryQuery,
} from './redux/api/analyticsApi';
import { calculateEngagementRate, calculatePlayRate, generateLineChart } from './helper';
import DOMPurify from 'isomorphic-dompurify';
import './charts.js';
import upgradePlanBackground from '../../assets/src/images/upgrade-plan-analytics-bg.png';
import InteractiveLayerAnalytics from './InteractiveLayerAnalytics.js';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Button, Spinner } from '@wordpress/components';
import SingleMetrics from './SingleMetrics.js';
import PlaybackPerformanceDashboard from './PlaybackPerformance.js';
import videojs from 'video.js';
import { arrowLeft } from '@wordpress/icons';

const adminUrl =
  window.videoData?.adminUrl;
const restURL = window.godamRestRoute.url || '';

const RenderVideo = ( { attachmentID, attachmentData, className, videoId } ) => {
	const getMimiType = ( mime ) => {
		if ( mime === 'video/quicktime' ) {
			return 'video/mp4';
		}

		return mime;
	};

	return (
		<video id={ videoId } className={ `video-js ${ className }` } data-id={ attachmentID }>
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
	const [ mediaLibraryAttachment, setMediaLibraryAttachment ] = useState( null );
	const [ mediaNotFound, setMediaNotFound ] = useState( false );

	// RTK Query hooks
	const siteUrl = window.location.origin;
	const {
		data: analyticsDataFetched,
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
	} = useFetchAnalyticsDataQuery(
		{
			videoId: abTestComparisonAttachmentData?.id,
			siteUrl,
		},
		{ skip: ! abTestComparisonAttachmentData?.id },
	);

	// Sync main analytics data
	useEffect( () => {
		const loadingEl = document.getElementById( 'loading-analytics-animation' );
		const container = document.getElementById( 'video-analytics-container' );
		const overlay = document.getElementById( 'api-key-overlay' );

		const shouldShowOverlay =
			analyticsDataFetched?.errorType === 'invalid_key' ||
			analyticsDataFetched?.errorType === 'missing_key' ||
			analyticsDataFetched?.errorType === 'microservice_error';

		if ( shouldShowOverlay ) {
			if ( loadingEl ) {
				loadingEl.style.display = 'none';
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
			const loadingEl = document.getElementById( 'loading-analytics-animation' );

			axios
				.get( url )
				.then( ( response ) => {
					const data = response.data;
					setAttachmentData( data );
					setMediaNotFound( false );
				} )
				.catch( ( error ) => {
					if ( error.response?.data?.code === 'rest_post_invalid_id' ) {
						setMediaNotFound( true );
						if ( loadingEl ) {
							loadingEl.style.display = 'none';
						}
					}
				} );
		}
	}, [ attachmentID ] );

	async function startABTesting() {
		setIsABResultsLoading( true );
		setIsABTestCompleted( false );
		setAbTestComparisonAttachmentData( mediaLibraryAttachment );
	}

	useEffect( () => {
		const originalVideoEl = document.getElementById( 'original-analytics-video' );

		const videoOptions = {
			fluid: true,
			mute: true,
			controls: false,
			// VHS (HLS/DASH) initial configuration to prefer a ~14 Mbps start.
			// This only affects the initial bandwidth guess; VHS will continue to measure actual throughput and adapt.
			html5: {
				vhs: {
					bandwidth: 14_000_000, // Pretend network can do ~14 Mbps at startup
					bandwidthVariance: 1.0, // allow renditions close to estimate
					limitRenditionByPlayerDimensions: false, // don't cap by video element size
				},
			},
		};

		if ( originalVideoEl && analyticsData ) {
			const originalVideo = videojs( 'original-analytics-video', videoOptions );

			generateLineChart(
				JSON.parse( analyticsData?.all_time_heatmap ),
				'#performance-line-chart',
				originalVideo,
				'.performance-line-chart-tooltip',
				525,
				300,
			);
		}

		const comparisonVideoEl = document.getElementById( 'comparison-analytics-video' );

		if ( comparisonVideoEl && abTestComparisonAnalyticsData ) {
			const comparisonVideo = videojs( 'comparison-analytics-video', videoOptions );

			generateLineChart(
				JSON.parse( abTestComparisonAnalyticsData?.all_time_heatmap ),
				'#comparison-line-chart',
				comparisonVideo,
				'.comparison-line-chart-tooltip',
				525,
				300,
			);
		}
	}, [ analyticsData, abTestComparisonAnalyticsData ] );

	useEffect( () => {
		const analyticsVideoEl = document.getElementById( 'analytics-video' );

		if ( ! analyticsVideoEl ) {
			return;
		}

		const existingPlayer = videojs.getPlayer( 'analytics-video' );
		if ( existingPlayer ) {
			existingPlayer.dispose();
		}

		videojs( 'analytics-video', {
			aspectRatio: '16:9',
			// VHS (HLS/DASH) initial configuration to prefer a ~14 Mbps start.
			// This only affects the initial bandwidth guess; VHS will continue to measure actual throughput and adapt.
			html5: {
				vhs: {
					bandwidth: 14_000_000, // Pretend network can do ~14 Mbps at startup
					bandwidthVariance: 1.0, // allow renditions close to estimate
					limitRenditionByPlayerDimensions: false, // don't cap by video element size
				},
			},
		} );
	}, [ analyticsData ] );

	const openVideoUploader = () => {
		const fileFrame = wp.media( {
			title: __( 'Select Video to Perform Performance Comparison Testing', 'godam' ),
			button: {
				text: __( 'Use this Video', 'godam' ),
			},
			library: {
				type: 'video',
			},
			frame: 'select',
			multiple: false,
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();

			setAbComparisonUrl( attachment.url );

			const url = window.pathJoin( [ restURL, `/wp/v2/media/${ attachment?.id }` ] );

			axios.get( url ).then( ( response ) => {
				const data = response.data;
				setMediaLibraryAttachment( data );
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

	useEffect( () => {
		const handleResize = () => {
			const smallSize = window.innerWidth <= 1024;
			const responsiveOverlay = document.getElementById( 'screen-size-overlay' );
			const analyticsContainer = document.getElementById( 'root-video-analytics' );

			if ( responsiveOverlay && analyticsContainer ) {
				if ( smallSize ) {
					responsiveOverlay.classList.remove( 'hidden' );
					analyticsContainer.style.overflow = 'hidden';
				} else {
					responsiveOverlay.classList.add( 'hidden' );
					analyticsContainer.style.overflow = 'auto';
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
		<div className="godam-analytics-container">
			<GodamHeader />

			<div id="loading-analytics-animation" className="progress-bar-wrapper">
				<div className="progress-bar-container">
					<div className="progress-bar">
						<div className="progress-bar-inner"></div>
					</div>
				</div>
			</div>

			<div id="media-not-found-overlay" className={ `api-key-overlay ${ ! mediaNotFound ? 'hidden' : '' }` }>
				<div className="api-key-message">
					<p>
						{ __( 'This media doesn\'t exist. ', 'godam' ) }
						<a href="admin.php?page=rtgodam">
							{ __( 'Go to Dashboard', 'godam' ) }
						</a>
					</p>
				</div>
			</div>

			<div
				id="api-key-overlay"
				className="api-key-overlay hidden"
				style={
					analyticsDataFetched?.errorType === 'invalid_key' || analyticsDataFetched?.errorType === 'missing_key'
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
					{ analyticsDataFetched?.errorType === 'invalid_key' || analyticsDataFetched?.errorType === 'missing_key'
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
								{ analyticsDataFetched?.message + ' ' || __(
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

			<div id="screen-size-overlay" className="screen-size-overlay hidden">
				<div className="screen-size-message">
					<p>{ __( 'You need to use desktop to access this feature. ', 'godam' ) }</p>
				</div>
			</div>

			{ attachmentData && ! mediaNotFound && (
				<div id="analytics-content" className="hidden">
					<div>
						<div className="subheading-container pt-6">
							{ attachmentData?.title?.rendered
								? <div className="subheading">{ __( 'Analytics report of ', 'godam' ) }
									<span dangerouslySetInnerHTML={ {
										__html: DOMPurify.sanitize( attachmentData?.title?.rendered ),
									} }></span></div> : <div className="subheading">{ __( 'Analytics report', 'godam' ) }</div>
							}
							<Button className="godam-analytics-back-btn" icon={ arrowLeft } onClick={ () => window.location.href = 'admin.php?page=rtgodam_video_editor' }>{ __( 'Back to Video Editor', 'godam' ) }</Button>

						</div>
					</div>

					<div
						id="video-analytics-container"
						className="video-analytics-container hidden"
					>
						<div>
							<div className="flex gap-10 items-center max-lg:flex-col">
								<div className="flex-grow">
									<div className="w-[350px] analytics-info-container max-lg:flex-row flex-col items-center">
										<SingleMetrics
											metricType={ 'engagement-rate' }
											label={ __( 'Average Engagement', 'godam' ) }
											tooltipText={ __(
												'Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)',
												'godam',
											) }
											processedAnalyticsHistory={ processedAnalyticsHistory }
											analyticsDataFetched={ analyticsDataFetched }
										/>

										<SingleMetrics
											metricType={ 'plays' }
											label={ __( 'Total Plays', 'godam' ) }
											tooltipText={ __(
												'Plays represent the total number of times the video has been viewed',
												'godam',
											) }
											processedAnalyticsHistory={ processedAnalyticsHistory }
											analyticsDataFetched={ analyticsDataFetched }
										/>

										<SingleMetrics
											metricType={ 'play-rate' }
											label={ __( 'Play Rate', 'godam' ) }
											tooltipText={ __(
												'Play rate is the percentage of page visitors who clicked play. Play Rate = Total plays / Page loads',
												'godam',
											) }
											processedAnalyticsHistory={ processedAnalyticsHistory }
											analyticsDataFetched={ analyticsDataFetched }
										/>

										<SingleMetrics
											metricType={ 'watch-time' }
											label={ __( 'Watch Time', 'godam' ) }
											tooltipText={ __(
												'Total time the video has been watched, aggregated across all plays',
												'godam',
											) }
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
												videoId={ 'analytics-video' }
											/>
											<div className="video-chart-container">
												<div id="chart-container">
													<svg id="line-chart" width="640" height="300"></svg>
													<div className="line-chart-tooltip"></div>
												</div>
											</div>
										</div>
										<div className="video-container">
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					<InteractiveLayerAnalytics attachmentID={ attachmentID } />

					<div className="grid grid-cols-[4fr_2fr_2fr] gap-4 px-10 metrics-container">
						<PlaybackPerformanceDashboard
							attachmentID={ attachmentID }
							initialData={ processedAnalyticsHistory }
						/>
						<div
							className="country-heatmap-container text-center bg-white border border-zinc-200 rounded p-4"
							id="country-heatmap-container"
						>
							<div id="map-container"></div>
							<div id="table-container" className="px-12"></div>
						</div>
						<div className="posts-count-container lg:col-span-1 bg-white border border-zinc-200 rounded p-4">
							<h2 className="text-base font-medium text-zinc-700 mb-2">
								{ __( 'Views by Post Source', 'godam' ) }
							</h2>
							<div id="post-views-count-chart" className="text-center"></div>
							<div className="legend" id="legend"></div>
							<div className="total-views" id="total-views"></div>
						</div>
					</div>

					<div className="px-10 py-6">
						<div>
							<h3 className="text-base font-semibold">
								{ __( 'Performance Comparison', 'godam' ) }
							</h3>
						</div>
						<div className="border border-gray-200 bg-white rounded-xl">
							{ attachmentData && mediaLibraryAttachment && (
								<div className="flex gap-4 bg-zinc-100 justify-between py-4 [padding-left:22px] [padding-right:22px] rounded-xl items-center performance-status-container">
									{ ( () => {
										if ( ! isABTestCompleted ) {
											if ( isABResultsLoading ) {
												return (
													<p className="flex items-center">
														{ __( 'In Progress', 'godam' ) }
														<div className="mt-0"><Spinner /></div>
													</p>
												);
											}
											return __(
												'Initiate the test comparison to generate analytical insights.',
												'godam',
											);
										}
										return __(
											'The test is complete! Review results to identify the best-performing video.',
											'godam',
										);
									} )() }
									{ ! isABResultsLoading && ! isABTestCompleted && (
										<div>
											<Button
												variant="primary"
												onClick={ () => startABTesting() }
												className="godam-button"
											>
												{ __( 'Start Test ', 'godam' ) }
											</Button>
										</div>
									) }

									{ isABTestCompleted && (
										<div className="flex gap-3">
											<Button
												variant="primary"
												onClick={ () => {
													setMediaLibraryAttachment( null );
													setAbTestComparisonAttachmentData( null );
													setAbComparisonUrl( '' );
													setAbTestComparisonAnalyticsData( null );
													setIsABTestCompleted( false );
													openVideoUploader();
												} }
												className="godam-button"
											>
												{ __( 'Choose Video', 'godam' ) }
											</Button>
										</div>
									) }
								</div>
							) }
							<div className="p-6">
								<div className="flex w-full overflow-scroll">
									<div className="flex-1">
										{ abTestComparisonUrl.length === 0 && (
											<div className="flex justify-center items-center flex-1 h-[280px] gap-6 flex-col">
												<p>
													{ __(
														'Test this video against others to see which performs better.',
														'godam',
													) }
												</p>
												<Button
													onClick={ openVideoUploader }
													variant="primary"
													className="ml-2 godam-button"
													aria-label={ __(
														'Upload or Replace CTA Image',
														'godam',
													) }
												>
													{ __( 'Choose', 'godam' ) }
												</Button>
											</div>
										) }

										{ ! mediaLibraryAttachment &&
											abTestComparisonUrl.length > 0 && (
											<div className="flex justify-center items-center flex-col pt-4 w-full flex-1 border-2 border-solid h-[280px]">
												<Spinner />
											</div>
										) }
										{ mediaLibraryAttachment && (
											<div className="flex gap-12 w-full h-full pt-6 justify-center">
												<div className="block w-[525px] h-[350px]">
													<div className="relative">
														<RenderVideo
															attachmentData={ attachmentData }
															attachmentID={ attachmentID }
															className="w-full object-fill comparison-video-container"
															videoId={ 'original-analytics-video' }
														/>
														<div className="original-video-chart-container relative">
															<div id="original-chart-container">
																<svg id="performance-line-chart" width="525" height="320"></svg>
																<div className="performance-line-chart-tooltip"></div>
															</div>
														</div>
													</div>
													<div>
														<h4 className="text-center m-0 mt-6">{ attachmentData?.title?.rendered }</h4>
													</div>
												</div>
												<div className="w-px bg-gray-200 mx-4 divide-dashed"></div>
												<div className="block w-[525px] h-[350px]">
													<div className="relative">
														<RenderVideo
															attachmentData={ mediaLibraryAttachment }
															attachmentID={ mediaLibraryAttachment?.id }
															className="w-full h-[320px] object-fill comparison-video-container"
															videoId={ 'comparison-analytics-video' }
														/>
														<div className="original-video-chart-container relative">
															<div id="comparison-chart-container">
																<svg id="comparison-line-chart" width="525" height="320"></svg>
																<div className="comparison-line-chart-tooltip"></div>
															</div>
														</div>
													</div>
													<div>
														<h4 className="text-center m-0 mt-6">
															{ mediaLibraryAttachment?.title?.rendered }
														</h4>
													</div>
												</div>
											</div>
										) }
									</div>
								</div>

								{ analyticsData && abTestComparisonAnalyticsData && (
									<table className="w-full ab-testing-table rounded-xl">
										<tbody>
											<tr
												className={ highlightClass(
													analyticsData?.plays,
													abTestComparisonAnalyticsData?.plays ?? 0,
												) }
											>
												<td>{ analyticsData?.plays }</td>
												<td>{ __( 'Views', 'godam' ) }</td>
												<td>{ abTestComparisonAnalyticsData?.plays ?? 0 }</td>
											</tr>
											<tr
												className={ highlightClass(
													engagementRate,
													comparisonEngagementRate,
												) }
											>
												<td>{ engagementRate }</td>
												<td>{ __( 'Average Engagement', 'godam' ) }</td>
												<td>{ comparisonEngagementRate }</td>
											</tr>
											<tr className={ highlightClass( plays, comparisonPlays ) }>
												<td>{ plays }</td>
												<td>{ __( 'Total Plays', 'godam' ) }</td>
												<td>{ comparisonPlays }</td>
											</tr>
											<tr
												className={ highlightClass( playRate, comparisonPlayRate ) }
											>
												<td>{ playRate }</td>
												<td>{ __( 'Play Rate', 'godam' ) }</td>
												<td>{ comparisonPlayRate }</td>
											</tr>
											<tr
												className={ highlightClass(
													analyticsData?.page_load,
													abTestComparisonAnalyticsData?.page_load,
												) }
											>
												<td>{ analyticsData?.page_load }</td>
												<td>{ __( 'Page Loads', 'godam' ) }</td>
												<td>{ abTestComparisonAnalyticsData?.page_load }</td>
											</tr>
											<tr
												className={ highlightClass(
													analyticsData?.play_time,
													abTestComparisonAnalyticsData?.play_time,
												) }
											>
												<td>{ analyticsData?.play_time?.toFixed( 2 ) }s</td>
												<td>{ __( 'Play Time', 'godam' ) }</td>
												<td>
													{ abTestComparisonAnalyticsData?.play_time?.toFixed( 2 ) }
													s
												</td>
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
					</div>
				</div>
			) }
		</div>
	);
};

export default Analytics;
