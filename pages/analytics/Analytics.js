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

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

const adminUrl =
  window.videoData?.adminUrl;
const restURL = window.godamRestRoute.url || '';

const Analytics = ( { attachmentID } ) => {
	const [ analyticsData, setAnalyticsData ] = useState( null );

	useEffect( () => {
		if ( attachmentID ) {
			const url = window.pathJoin( [ restURL, `/wp/v2/media/${ attachmentID }` ] );

			axios
				.get( url )
				.then( ( response ) => {
					const data = response.data;
					setAnalyticsData( data );
				} );
		}
	}, [ attachmentID ] );

	const getMimiType = ( mime ) => {
		if ( mime === 'video/quicktime' ) {
			return 'video/mp4';
		}

		return mime;
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

			{ analyticsData && (
				<>
					<div className="p-10 flex gap-3 items-center">
						<h2 className="text-2xl m-0 capitalize">{ analyticsData?.title?.rendered }</h2>
					</div>

					<div className="subheading-container">
						<div className="subheading">{ __( 'Overview', 'godam' ) }</div>
					</div>
					<div id="video-analytics-container" className="video-analytics-container hidden">
						<div className="overflow-auto">
							<div className="flex gap-10 items-start max-lg:flex-col">
								<div className="min-w-[350px] max-w-[350px] flex-grow">

									<div className="analytics-info-container max-lg:flex-row flex-col">
										<div className="analytics-info flex justify-between max-lg:flex-col">
											<div className="analytics-single-info">
												<div className="analytics-info-heading">
													<p>
														{ __( 'Average Engagement', 'godam' ) }
													</p>
													<Tooltip text="Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)" />
												</div>
												<p id="engagement-rate" className="min-w-[90px] engagement-rate">0%</p>
											</div>
										</div>
										<div className="analytics-info flex justify-between  max-lg:flex-col">
											<div className="analytics-single-info">
												<div className="analytics-info-heading">
													<p>
														{ __( 'Total Plays', 'godam' ) }
													</p>
													<Tooltip text="Plays represent the total number of times the video has been viewed" />
												</div>
												<p id="total-plays" className="min-w-[90px] engagement-rate">0</p>
											</div>
										</div>
										<div className="analytics-info flex justify-between  max-lg:flex-col">
											<div className="analytics-single-info">
												<div className="analytics-info-heading">
													<p>
														{ __( 'Play Rate', 'godam' ) }
													</p>
													<Tooltip text="Play rate is the percentage of page visitors who clicked play. Play Rate = Total plays / Page loads" />
												</div>
												<p id="play-rate" className="min-w-[90px] engagement-rate">0%</p>
											</div>
										</div>
									</div>
								</div>
								<div className="min-w-[750px]">

									<div>
										<div className="video-container">
											<video
												id="analytics-video"
												className="video-js"
												data-id={ attachmentID }
											>
												<source src={ analyticsData.source_url || '' } type={ getMimiType( analyticsData.mime_type ) || 'video/mp4' } />
												{
													analyticsData?.meta?.rtgodam_transcoded_url && (
														<source src={ analyticsData?.meta?.rtgodam_transcoded_url || '' } type={ analyticsData?.meta?.rtgodam_transcoded_url.endsWith( '.mpd' ) ? 'application/dash+xml' : '' } />
													)
												}
											</video>
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
				</>
			) }
		</div>
	);
};

export default Analytics;
