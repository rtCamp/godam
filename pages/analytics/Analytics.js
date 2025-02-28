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

const Analytics = ( { attachmentID } ) => {
	const [ analyticsData, setAnalyticsData ] = useState( null );

	const adminUrl = window.videoData?.adminUrl || '/wp-admin/admin.php?page=godam';

	useEffect( () => {
		if ( attachmentID ) {
			const url = `/wp-json/wp/v2/media/${ attachmentID }`;

			axios
				.get( url )
				.then( ( response ) => {
					const data = response.data;
					setAnalyticsData( data );
				} )
				.catch( ( error ) => {
					console.log( error );
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

			<div id="license-overlay" className="license-overlay hidden">
				<div className="license-message">
					<p>
						{ __( 'Please ', 'godam' ) }
						<a href={ adminUrl } target="_blank" rel="noopener noreferrer">
							{ __( 'activate your license', 'godam' ) }
						</a>
						{ __( ' to access the Analytics feature', 'godam' ) }
					</p>
				</div>
			</div>

			{ analyticsData && (
				<div id="video-analytics-container" className="video-analytics-container hidden">
					<div className="overflow-auto">
						<div className="flex gap-8 items-start">
							<div className="min-w-[350px] max-w-[350px] flex-grow">
								<h2 className="text-lg m-0 mb-2">{ __( 'Analytics', 'godam' ) }</h2>

								<div className="analytics-info-container border-t border-gray-500">
									<div className="analytics-info flex justify-between">
										<p>
											{ __( 'Average Engagement', 'godam' ) }
											<Tooltip text="Video engagement rate is the percentage of video watched. Average Engagement = Total time played / (Total plays x Video length)" />
										</p>
										<span id="engagement-rate" className="min-w-[90px]">0%</span>
									</div>
									<hr />
									<div className="analytics-info flex justify-between">
										<p>
											{ __( 'Total Plays', 'godam' ) }
											<Tooltip text="Plays represent the total number of times the video has been viewed" />
										</p>
										<span id="total-plays" className="min-w-[90px]">0</span>
									</div>
									<hr />
									<div className="analytics-info flex justify-between">
										<p>
											{ __( 'Play Rate', 'godam' ) }
											<Tooltip text="Play rate is the percentage of page visitors who clicked play. Play Rate = Total plays / Page loads" />
										</p>
										<span id="play-rate" className="min-w-[90px]">0%</span>
									</div>
									<hr />
								</div>
							</div>
							<div className="min-w-[750px]">
								<h2 className="text-lg m-0 mb-2 min-w-[640px]">{ analyticsData?.title?.rendered }</h2>

								<div>
									<div className="video-container">
										<video
											id="analytics-video"
											className="video-js"
											data-id={ attachmentID }
										>
											{
												analyticsData?.meta?._rt_transcoded_url && (
													<source src={ analyticsData?.meta?._rt_transcoded_url || '' } type={ analyticsData?.meta?._rt_transcoded_url.endsWith( '.mpd' ) ? 'application/dash+xml' : '' } />
												)
											}
											<source src={ analyticsData.source_url || '' } type={ getMimiType( analyticsData.mime_type ) || 'video/mp4' } />
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
											<h3 className="text-md font-semibold text-gray-700 mb-2">
												{ __( 'Heatmap Analysis', 'godam' ) }
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
			) }
		</div>
	);
};

export default Analytics;
