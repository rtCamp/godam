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
import { getAPIKeyErrorInfo, hasAPIKey } from '../godam/utils';
import {
	useFetchAnalyticsDataQuery,
	useFetchProcessedAnalyticsHistoryQuery,
} from './redux/api/analyticsApi';
import { calculateEngagementRate, calculatePlayRate, generateLineChart } from './helper';
import DOMPurify from 'isomorphic-dompurify';
import { main as renderVideoAnalyticsCharts } from './charts.js';
import DateRangePicker, { triggerLabelFor } from './components/DateRangePicker';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Button, Spinner, Icon } from '@wordpress/components';
import SingleMetrics from './SingleMetrics.js';
import PlaysVsViewers from './PlaysVsViewers.js';
import PlaybackPerformanceDashboard from './PlaybackPerformance.js';
import VideoLayerTimeline from './VideoLayerTimeline.js';
import videojs from 'video.js';
import { arrowLeft, info } from '@wordpress/icons';
import { ERROR_TYPE } from '../shared/enums';
import AnalyticsUnavailableNotice from '../shared/AnalyticsUnavailableNotice';
import { formatWatchTime } from '../utils/formatters';
import UpgradePlanAnalyticsBg from '../../assets/src/images/upgrade-plan-analytics-bg.webp';

const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

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
	const apiKeyError = getAPIKeyErrorInfo();
	const apiKeyErrorType = apiKeyError?.type || null;

	// Skip all analytics queries when there is no API key or there is a locally-known key error.
	const shouldSkipAnalytics = ! hasAPIKey || !! apiKeyErrorType;

	// Page-level date range. All Time by default. Drives the KPIs, geography
	// map and Views-by-Source (all from the ranged metrics query). The "Views
	// across the video" heatmap stays all-time (the microservice nulls
	// all_time_heatmap in range mode), so it reads the unranged query below.
	const [ range, setRange ] = useState( { startDate: null, endDate: null } );
	const rangeActive = Boolean( range.startDate && range.endDate );
	const rangeLabel = rangeActive ? triggerLabelFor( range ) : __( 'All time', 'godam' );

	// All-time query — feeds the always-all-time surfaces: the heatmap, the
	// video length used by the layer timeline, and the A/B comparison baseline.
	const {
		data: analyticsDataFetched,
		isLoading: isAnalyticsDataLoading,
		isError: isAnalyticsDataError,
	} = useFetchAnalyticsDataQuery(
		{ videoId: attachmentID, siteUrl },
		{ skip: ! attachmentID || shouldSkipAnalytics },
	);

	// Range-scoped query — feeds the KPIs, geography map and Views-by-Source
	// (via charts.js reading window.analyticsDataFetched). The date args are
	// omitted at All Time so this shares the all-time query's cache key (RTK
	// dedups — one request) and only forks into its own request once a range
	// is picked.
	const { data: rangedAnalyticsData } = useFetchAnalyticsDataQuery(
		{
			videoId: attachmentID,
			siteUrl,
			...( range.startDate ? { startDate: range.startDate } : {} ),
			...( range.endDate ? { endDate: range.endDate } : {} ),
		},
		{ skip: ! attachmentID || shouldSkipAnalytics },
	);

	// Connected, but the analytics backend is unreachable (server down) or returned
	// a microservice error. Gated on a valid key so it never shows for a
	// disconnected site — that case is handled by the onboarding overlay.
	const analyticsUnreachable = !! window.userData?.validApiKey && !! attachmentID && ! shouldSkipAnalytics && ( isAnalyticsDataError || analyticsDataFetched?.errorType === ERROR_TYPE.MICROSERVICE_ERROR );

	// charts.js (KPIs + geography + Views-by-Source) renders from this global.
	window.analyticsDataFetched = rangedAnalyticsData ?? analyticsDataFetched;

	// Skip secondary queries until the primary analytics call has returned without an error.
	// This prevents parallel requests being sent when the server rejects the API key.
	const shouldSkipSecondaryQueries = ! attachmentID || shouldSkipAnalytics || ! analyticsDataFetched || !! analyticsDataFetched?.errorType;

	// Processed analytics history feeds the "vs prev 7 days" trend badges +
	// sparklines, which are inherently a fixed last-7-days window (SingleMetrics
	// / PlaysVsViewers rebuild a today-6..today grid via ensureAll7Days). So it
	// stays pinned to `days: 7` and is NOT range-scoped — range-scoping it made
	// the badge read a false +0.00% for any range not overlapping the last 7
	// days. The KPI values re-scope via the range-scoped query above instead.
	const {
		data: processedAnalyticsHistory,
	} = useFetchProcessedAnalyticsHistoryQuery(
		{ videoId: attachmentID, siteUrl, days: 7 },
		{ skip: shouldSkipSecondaryQueries },
	);

	window.processedAnalyticsHistory = processedAnalyticsHistory;

	const {
		data: abTestComparisonAnalyticsDataFetched,
	} = useFetchAnalyticsDataQuery(
		{
			videoId: abTestComparisonAttachmentData?.id,
			siteUrl,
		},
		{ skip: ! abTestComparisonAttachmentData?.id || !! apiKeyErrorType || !! analyticsDataFetched?.errorType },
	);

	// Sync main analytics data. The onboarding overlay handles the disconnected
	// case, so on a key/backend error we just stop the loader; otherwise render.
	useEffect( () => {
		const loadingEl = document.getElementById( 'loading-analytics-animation' );
		if ( apiKeyErrorType !== null || analyticsDataFetched?.errorType || isAnalyticsDataError ) {
			if ( loadingEl ) {
				loadingEl.style.display = 'none';
			}
			return;
		}
		if ( analyticsDataFetched ) {
			setAnalyticsData( analyticsDataFetched );
		}
	}, [ analyticsDataFetched, apiKeyErrorType, isAnalyticsDataError ] );

	// Re-render the imperative charts (KPIs + geography + Views-by-Source) when
	// the range-scoped data changes. charts.js reads window.analyticsDataFetched
	// (set above during render) and is idempotent, so this safely re-scopes
	// those surfaces on every range change. The heatmap + video are React-driven
	// from the all-time query and are intentionally left untouched here.
	useEffect( () => {
		if ( ! rangedAnalyticsData || rangedAnalyticsData?.errorType || ! processedAnalyticsHistory ) {
			return;
		}
		renderVideoAnalyticsCharts();
	}, [ rangedAnalyticsData, processedAnalyticsHistory ] );

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
			fluid: false,
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

		let originalResizeHandler = null;

		if ( originalVideoEl ) {
			const originalVideo = videojs( 'original-analytics-video', videoOptions );

			// Set aspect ratio when metadata loads
			originalVideo.on( 'loadedmetadata', () => {
				const videoWidth = originalVideo.videoWidth();
				const videoHeight = originalVideo.videoHeight();

				if ( videoWidth && videoHeight ) {
					const aspectRatio = `${ videoWidth }:${ videoHeight }`;
					originalVideo.aspectRatio( aspectRatio );

					const container = originalVideoEl.closest( '.block' );
					if ( container ) {
						originalResizeHandler = () => {
							const parentWidth = container.parentElement?.offsetWidth || window.innerWidth;
							const maxWidth = Math.min( parentWidth - 40, 525 );
							const calculatedWidth = 320 * ( videoWidth / videoHeight );
							const finalWidth = Math.min( calculatedWidth, maxWidth );
							container.style.width = `${ finalWidth }px`;
							container.style.maxWidth = '100%';
						};

						originalResizeHandler();
						window.addEventListener( 'resize', originalResizeHandler );
					}
				}
			} );

			if ( isABTestCompleted && analyticsData ) {
				generateLineChart(
					JSON.parse( analyticsData?.all_time_heatmap ),
					'#performance-line-chart',
					originalVideo,
					'.performance-line-chart-tooltip',
					525,
					300,
				);
			}
		}

		const comparisonVideoEl = document.getElementById( 'comparison-analytics-video' );
		let comparisonResizeHandler = null;

		if ( comparisonVideoEl ) {
			const comparisonVideo = videojs( 'comparison-analytics-video', videoOptions );

			// Set aspect ratio when metadata loads
			comparisonVideo.on( 'loadedmetadata', () => {
				const videoWidth = comparisonVideo.videoWidth();
				const videoHeight = comparisonVideo.videoHeight();

				if ( videoWidth && videoHeight ) {
					const aspectRatio = `${ videoWidth }:${ videoHeight }`;
					comparisonVideo.aspectRatio( aspectRatio );

					const container = comparisonVideoEl.closest( '.block' );
					if ( container ) {
						comparisonResizeHandler = () => {
							const parentWidth = container.parentElement?.offsetWidth || window.innerWidth;
							const maxWidth = Math.min( parentWidth - 40, 525 );
							const calculatedWidth = 320 * ( videoWidth / videoHeight );
							const finalWidth = Math.min( calculatedWidth, maxWidth );
							container.style.width = `${ finalWidth }px`;
							container.style.maxWidth = '100%';
						};

						comparisonResizeHandler();
						window.addEventListener( 'resize', comparisonResizeHandler );
					}
				}
			} );

			if ( isABTestCompleted && abTestComparisonAnalyticsData ) {
				generateLineChart(
					JSON.parse( abTestComparisonAnalyticsData?.all_time_heatmap ),
					'#comparison-line-chart',
					comparisonVideo,
					'.comparison-line-chart-tooltip',
					525,
					300,
				);
			}
		}

		// Cleanup function to remove resize listeners
		return () => {
			if ( originalResizeHandler ) {
				window.removeEventListener( 'resize', originalResizeHandler );
			}
			if ( comparisonResizeHandler ) {
				window.removeEventListener( 'resize', comparisonResizeHandler );
			}
		};
	}, [ analyticsData, abTestComparisonAnalyticsData, attachmentData, abTestComparisonAttachmentData, isABTestCompleted, mediaLibraryAttachment ] );

	useEffect( () => {
		const analyticsVideoEl = document.getElementById( 'analytics-video' );

		if ( ! analyticsVideoEl ) {
			return;
		}

		const existingPlayer = videojs.getPlayer( 'analytics-video' );
		if ( existingPlayer ) {
			existingPlayer.dispose();
		}

		const player = videojs( 'analytics-video', {
			fluid: false,
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

		let resizeHandler = null;

		// When video metadata loads, get actual dimensions and set aspect ratio
		player.on( 'loadedmetadata', () => {
			const videoWidth = player.videoWidth();
			const videoHeight = player.videoHeight();

			if ( videoWidth && videoHeight ) {
				// Calculate aspect ratio
				const aspectRatio = `${ videoWidth }:${ videoHeight }`;
				player.aspectRatio( aspectRatio );

				const container = document.querySelector( '.video-container' );
				if ( container ) {
					// Function to update container width based on aspect ratio
					resizeHandler = () => {
						// Get available width (parent width or viewport width - padding)
						const parentWidth = container.parentElement?.offsetWidth || window.innerWidth;
						const maxWidth = Math.min( parentWidth - 40, 640 ); // 40px for padding
						const calculatedWidth = 360 * ( videoWidth / videoHeight );

						// Use the smaller of calculated width or available space
						const finalWidth = Math.min( calculatedWidth, maxWidth );
						container.style.width = `${ finalWidth }px`;
					};

					resizeHandler();

					// Update on window resize
					window.addEventListener( 'resize', resizeHandler );

					// Generate line chart after container is set
					if ( analyticsData?.all_time_heatmap ) {
						const heatmapData = JSON.parse( analyticsData.all_time_heatmap );
						generateLineChart(
							heatmapData,
							'#line-chart',
							player,
							'.line-chart-tooltip',
							640,
							300,
						);
					}
				}
			}
		} );

		// Add cleanup for when this specific effect unmounts
		return () => {
			if ( resizeHandler ) {
				window.removeEventListener( 'resize', resizeHandler );
			}
			if ( player ) {
				player.dispose();
			}
		};
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
			godamAnalyticsContext: true, // Flag to indicate this is from Analytics page
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
			const analyticsContainer = document.getElementById( 'root-video-analytics' );

			if ( analyticsContainer ) {
				if ( smallSize ) {
					analyticsContainer.style.overflow = 'hidden';
				} else {
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

			{ analyticsUnreachable && <AnalyticsUnavailableNotice area="analytics" /> }

			<div
				id="media-not-found-overlay"
				className={ `api-key-overlay api-key-overlay--upgrade ${ ! mediaNotFound ? 'hidden' : '' }` }
				style={ { backgroundImage: `url(${ UpgradePlanAnalyticsBg })` } }
			>
				<div className="api-key-message">
					<p>
						{ __( 'This media doesn\'t exist.', 'godam' ) }
						<a href="admin.php?page=rtgodam">
							{ __( 'Go to Dashboard', 'godam' ) }
						</a>
					</p>
				</div>
			</div>

			{ attachmentData && ! mediaNotFound && (
				<div id="analytics-content" className="hidden">
					<div>
						<div className="subheading-container flex flex-row max-md:flex-row-reverse pt-6">
							{ attachmentData?.title?.rendered
								? <div className="subheading">{ __( 'Analytics report of', 'godam' ) }{ ' ' }
									<span dangerouslySetInnerHTML={ {
										__html: DOMPurify.sanitize( attachmentData?.title?.rendered ),
									} }></span></div> : <div className="subheading">{ __( 'Analytics report', 'godam' ) }</div>
							}
							<Button className="godam-analytics-back-btn" icon={ arrowLeft } onClick={ () => window.location.href = 'admin.php?page=rtgodam_media_editor' }><span className="max-md:hidden">{ __( 'Back to Media Editor', 'godam' ) }</span></Button>

						</div>
					</div>

					{ /* Page-level FYI — analytics aren't real-time. */ }
					<div className="godam-analytics-fyi flex items-center gap-1.5 mx-10 mt-2 text-xs text-zinc-500">
						<Icon icon={ info } size={ 15 } />
						<span>
							{ __(
								'Heads up: analytics update periodically, so new activity may take up to 30 minutes to show here.',
								'godam',
							) }
						</span>
					</div>

					<div
						id="video-analytics-container"
						className="video-analytics-container hidden"
					>
						<div className="godam-analytics-stack">
							{ /* All Time Insights — existing KPIs grouped into the shared card. */ }
							<div className="godam-card godam-insights-card">
								<div className="godam-card__head">
									<h2>{ __( 'Insights', 'godam' ) }</h2>
									<DateRangePicker
										value={ range }
										onChange={ setRange }
										testIdPrefix="godam-video-insights-daterange"
									/>
								</div>
								<div className="analytics-info-container single-metrics-info-container flex max-lg:flex-row items-stretch flex-wrap justify-center lg:flex-nowrap">
									<SingleMetrics
										metricType={ 'engagement-rate' }
										label={ __( 'Average Engagement', 'godam' ) }
										tooltipText={ __(
											'Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)',
											'godam',
										) }
										processedAnalyticsHistory={ processedAnalyticsHistory }
										analyticsDataFetched={ rangedAnalyticsData }
										dataLabel={ rangeLabel }
									/>

									<SingleMetrics
										metricType={ 'play-rate' }
										label={ __( 'Play Rate', 'godam' ) }
										tooltipText={ __(
											'Play rate is the percentage of page visitors who clicked play. Play Rate = Total plays / Page loads',
											'godam',
										) }
										processedAnalyticsHistory={ processedAnalyticsHistory }
										analyticsDataFetched={ rangedAnalyticsData }
										dataLabel={ rangeLabel }
									/>

									<SingleMetrics
										metricType={ 'watch-time' }
										label={ __( 'Watch Time', 'godam' ) }
										tooltipText={ __(
											'Total time the video has been watched, aggregated across all plays',
											'godam',
										) }
										processedAnalyticsHistory={ processedAnalyticsHistory }
										analyticsDataFetched={ rangedAnalyticsData }
										dataLabel={ rangeLabel }
									/>

									<PlaysVsViewers
										plays={ rangedAnalyticsData?.plays ?? 0 }
										uniqueViewers={ rangedAnalyticsData?.unique_viewers ?? null }
										showRatio={ true }
										isLoading={ isAnalyticsDataLoading }
										processedAnalyticsHistory={ processedAnalyticsHistory }
									/>
								</div>
							</div>

							{ /* Views across the video — player with the per-second overlay.
							    The per-second distribution is an all-time snapshot (the
							    microservice has no range-scoped variant yet), so it stays
							    all-time and shows a note when a date range is active. */ }
							<div className="godam-card godam-video-card">
								<div className="godam-card__head">
									<h2>{ __( 'Views across the video', 'godam' ) }</h2>
									{ rangeActive && (
										<span
											className="godam-pill"
											title={ __( 'The per-second view distribution is aggregated across all time and is not affected by the selected date range.', 'godam' ) }
										>
											{ __( 'All time', 'godam' ) }
										</span>
									) }
								</div>
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
							</div>
						</div>
					</div>
					<VideoLayerTimeline
						attachmentID={ attachmentID }
						videoDuration={ analyticsData?.video_length || 0 }
					/>

					<div className="grid grid-cols-[4fr_2fr_2fr] gap-4 px-10 metrics-container">
						<PlaybackPerformanceDashboard
							attachmentID={ attachmentID }
							initialData={ processedAnalyticsHistory }
						/>
						<div
							className="godam-card country-heatmap-container text-center"
							id="country-heatmap-container"
						>
							{ /* The "Views by Location" heading + map are injected here by the map helper. */ }
							<div id="map-container"></div>
							<div id="table-container" className="px-12"></div>
						</div>
						<div className="godam-card posts-count-container lg:col-span-1">
							<div className="godam-card__head">
								<h2>{ __( 'Views by Source', 'godam' ) }</h2>
							</div>
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
												{ __( 'Start Test', 'godam' ) }
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
											<div className="flex gap-4 md:gap-12 w-full h-full pt-6 justify-center flex-col md:flex-row">
												<div className="block w-full md:w-[525px] max-w-full">
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
												<div className="w-px bg-gray-200 mx-4 divide-dashed hidden md:block"></div>
												<div className="block w-full md:w-[525px] max-w-full">
													<div className="relative">
														<RenderVideo
															attachmentData={ mediaLibraryAttachment }
															attachmentID={ mediaLibraryAttachment?.id }
															className="w-full object-fill comparison-video-container"
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
												<td>
													{ Number( analyticsData?.plays ?? 0 ).toLocaleString() }
												</td>
												<td>{ __( 'Views', 'godam' ) }</td>
												<td>
													{ Number( abTestComparisonAnalyticsData?.plays ?? 0 ).toLocaleString() }
												</td>
											</tr>
											<tr
												className={ highlightClass(
													engagementRate,
													comparisonEngagementRate,
												) }
											>
												<td>{ engagementRate }%</td>
												<td>{ __( 'Average Engagement', 'godam' ) }</td>
												<td>{ comparisonEngagementRate }%</td>
											</tr>
											<tr className={ highlightClass( plays, comparisonPlays ) }>
												<td>
													{ Number( plays ?? 0 ).toLocaleString() }
												</td>
												<td>{ __( 'Total Plays', 'godam' ) }</td>
												<td>
													{ Number( comparisonPlays ?? 0 ).toLocaleString() }
												</td>
											</tr>
											<tr
												className={ highlightClass( playRate, comparisonPlayRate ) }
											>
												<td>{ playRate }%</td>
												<td>{ __( 'Play Rate', 'godam' ) }</td>
												<td>{ comparisonPlayRate }%</td>
											</tr>
											<tr
												className={ highlightClass(
													analyticsData?.page_load,
													abTestComparisonAnalyticsData?.page_load,
												) }
											>
												<td>
													{ Number( analyticsData?.page_load ?? 0 ).toLocaleString() }
												</td>
												<td>{ __( 'Page Loads', 'godam' ) }</td>
												<td>
													{ Number( abTestComparisonAnalyticsData?.page_load ?? 0 ).toLocaleString() }
												</td>
											</tr>
											<tr
												className={ highlightClass(
													analyticsData?.play_time,
													abTestComparisonAnalyticsData?.play_time,
												) }
											>
												<td>
													{ formatWatchTime( analyticsData?.play_time ) }
												</td>
												<td>{ __( 'Play Time', 'godam' ) }</td>
												<td>
													{ formatWatchTime( abTestComparisonAnalyticsData?.play_time ) }
												</td>
											</tr>
											<tr
												className={ highlightClass(
													analyticsData?.video_length,
													abTestComparisonAnalyticsData?.video_length,
												) }
											>
												<td>
													{ formatWatchTime( analyticsData?.video_length ) }
												</td>
												<td>{ __( 'Video Length', 'godam' ) }</td>
												<td>
													{ formatWatchTime( abTestComparisonAnalyticsData?.video_length ) }
												</td>
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
