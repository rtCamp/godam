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
import { fetchAnalyticsData, calculateEngagementRate, calculatePlayRate } from './helper';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Button, Icon, Spinner } from '@wordpress/components';

const adminUrl =
  window.videoData?.adminUrl || '/wp-admin/admin.php?page=rtgodam';
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

	console.log( analyticsData );

	// useEffect( () => {
	async function startABTesting() {
		setIsABResultsLoading( true );
		const siteUrl = window.location.origin;
		setAnalyticsData( await fetchAnalyticsData( attachmentID, siteUrl ) );
		if ( abTestComparisonAttachmentData ) {
			// console.log('executed', abTestComparisonAnalyticsData)
			setAbTestComparisonAnalyticsData(
				await fetchAnalyticsData( abTestComparisonAttachmentData?.id, siteUrl ),
			);
		}
		setIsABResultsLoading( false );
	}

	// }, [ attachmentID, abTestComparisonUrl, abTestComparisonAttachmentData ] );

	const openVideoUploader = () => {
		// Force media library tab only
		const originalPostId = wp.media.model.settings.post.id;
		wp.media.model.settings.post.id = 0; // Prevent upload tab

		const fileFrame = wp.media( {
			title: 'Select Video to Perform A/B testing',
			button: {
				text: 'Use this Video',
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

			// Restore post ID
			wp.media.model.settings.post.id = originalPostId;
		} );

		fileFrame.open();
	};

	const engagementRate = analyticsData ? calculateEngagementRate(
		analyticsData?.plays,
		analyticsData?.video_length,
		analyticsData?.play_time,
	) : '';

	const comparisonEngagementRate =
		abTestComparisonAnalyticsData ? calculateEngagementRate(
			abTestComparisonAnalyticsData?.plays,
			abTestComparisonAnalyticsData?.video_length,
			abTestComparisonAnalyticsData?.play_time,
		) : '';

	const playRate = analyticsData ? calculatePlayRate(
		analyticsData?.plays,
		analyticsData?.video_length,
		analyticsData?.play_time,
	) : '';

	const comparisonPlayRate = abTestComparisonAnalyticsData ? calculatePlayRate(
		abTestComparisonAnalyticsData?.plays,
		abTestComparisonAnalyticsData?.video_length,
		abTestComparisonAnalyticsData?.play_time,
	) : '';

	const plays = analyticsData?.plays;

	const comparisonPlays = abTestComparisonAnalyticsData?.plays;

	console.log( comparisonEngagementRate, comparisonPlayRate, comparisonPlays );

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
				<>
					<div className="p-10 flex gap-3 items-center">
						<h2 className="text-2xl m-0 capitalize">
							{ attachmentData?.title?.rendered }
						</h2>
						<span className="h-[26px] px-2 bg-white flex items-center rounded-sm">
							{ attachmentData?.media_details?.length_formatted }
						</span>
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
													<Tooltip text="Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)" />
												</div>
												<p
													id="engagement-rate"
													className="min-w-[90px] engagement-rate"
												>
													0%
												</p>
											</div>
										</div>
										<div className="analytics-info flex justify-between  max-lg:flex-col">
											<div className="analytics-single-info">
												<div className="analytics-info-heading">
													<p>{ __( 'Total Plays', 'godam' ) }</p>
													<Tooltip text="Plays represent the total number of times the video has been viewed" />
												</div>
												<p
													id="total-plays"
													className="min-w-[90px] engagement-rate"
												>
													0
												</p>
											</div>
										</div>
										<div className="analytics-info flex justify-between  max-lg:flex-col">
											<div className="analytics-single-info">
												<div className="analytics-info-heading">
													<p>{ __( 'Play Rate', 'godam' ) }</p>
													<Tooltip text="Play rate is the percentage of page visitors who clicked play. Play Rate = Total plays / Page loads" />
												</div>
												<p
													id="play-rate"
													className="min-w-[90px] engagement-rate"
												>
													0%
												</p>
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
													<div className="tooltip"></div>
												</div>
											</div>
										</div>
										<div className="video-container">
											<div id="heatmap-container" className="mt-4">
												<h3 className="text-md mb-2 flex gap-2">
													{ __( 'Heatmap', 'godam' ) }
													<Tooltip text="Heatmap visualizes per-second view density, identifying peaks of plays, skipped sections, and audience drop-offs. Darker areas indicate higher engagement" />
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
							{ /* <h3 className="text-md font-semibold text-gray-700 mb-8">
								{ __( 'Geographical Heatmap', 'godam' ) }
							</h3> */ }
							<svg id="metrics-chart" width="900" height="500"></svg>
						</div>
						<div
							className="country-heatmap-container text-center"
							id="country-heatmap-container"
						>
							{ /* <h3 className="text-md font-semibold text-gray-700 mb-2">
								{ __( 'Geographical Heatmap', 'godam' ) }
							</h3> */ }
							{ /* <svg id="country-heatmap"></svg> */ }
							<div id="map-container"></div>
							<div id="table-container" className="px-12"></div>
						</div>
					</div>

					<div className="posts-count-container">
						<h2>Video Views by Post Source</h2>
						<div id="post-views-count-chart" className="text-center"></div>
						<div className="legend" id="legend"></div>
						<div className="total-views" id="total-views"></div>
					</div>

					<div className="px-10 py-28">
						<div className="flex justify-between">
							<h3>A/B Testing</h3>
							{ attachmentData && abTestComparisonAttachmentData && (
								<div className="flex gap-4">
									<Button variant="secondary" onClick={ () => {
										setAbTestComparisonAttachmentData( null );
										setAbComparisonUrl( '' );
										setAbTestComparisonAnalyticsData( null );
									} }>
										Remove
									</Button>
									<Button variant="primary" onClick={ () => startABTesting() }>
										Start A/B Test
									</Button>
								</div>
							) }
						</div>
						<div className="flex justify-center w-full">
							<div className="flex-1 border-2 border-solid flex justify-center items-center flex-col pt-4">
								<RenderVideo
									attachmentData={ attachmentData }
									attachmentID={ attachmentID }
									className="w-full h-full"
								/>
								<div>
									<h4>{ attachmentData?.title?.rendered }</h4>
									<p className="text-center">0 unique vis</p>
								</div>
							</div>
							<div className="flex-1 border-2 border-solid">
								{ abTestComparisonUrl.length === 0 && (
									<div className="flex justify-center items-center h-full flex-1 border-2 border-solid">
										<Button
											onClick={ openVideoUploader }
											variant="primary"
											className="ml-2"
											aria-label="Upload or Replace CTA Image"
										>
											Select Video
										</Button>
										{ /* { abTestComparisonAttachmentData && (
											<p>
												No analytics present for this video! Choose another
												video.
											</p>
										) } */ }
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
											className="w-full h-full"
										/>
										<div>
											<h4>{ abTestComparisonAttachmentData?.title?.rendered }</h4>
											<p className="text-center">0 unique views</p>
										</div>
									</div>
								) }
							</div>
						</div>
						{ analyticsData && abTestComparisonAnalyticsData && (
							<table className="w-full ab-testing-table">
								<tr
									className={ `${ engagementRate > comparisonEngagementRate ? 'leftGreater' : 'rightGreater' }` }
								>
									<td>{ engagementRate }</td>
									<td>Average Engagement</td>
									<td>{ comparisonEngagementRate }</td>
								</tr>
								<tr
									className={ `${ plays > comparisonPlays ? 'leftGreater' : 'rightGreater' }` }
								>
									<td>{ plays }</td>
									<td>Total Plays</td>
									<td>{ comparisonPlays }</td>
								</tr>
								<tr
									className={ `${ playRate > comparisonPlayRate ? 'leftGreater' : 'rightGreater' }` }
								>
									<td>{ playRate }</td>
									<td>Play Rate</td>
									<td>{ comparisonPlayRate }</td>
								</tr>
							</table>
						) }
						{
							isABResultsLoading && (
								<div className="text-center p-20">
									<Spinner />
								</div>
							)
						}
					</div>
				</>
			) }
		</div>
	);
};

export default Analytics;
