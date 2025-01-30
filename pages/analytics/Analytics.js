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
/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

const Analytics = ( { attachmentID } ) => {
	const [ analyticsData, setAnalyticsData ] = useState( null );

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
	}, [] );

	return (
		<>
			<div id="loading-analytics-animation" className="progress-bar-wrapper">
				<div className="progress-bar-container">
					<div className="progress-bar">
						<div className="progress-bar-inner"></div>
					</div>
				</div>
			</div>

			{ analyticsData && (
				<div id="video-analytics-container" className="video-analytics-container hidden">
					<div className="overflow-auto">

						<div className="flex gap-8 items-start">
							<div className="min-w-[350px] max-w-[350px] flex-grow">
								<h2 className="text-lg m-0 mb-2">{ __( 'Analytics', 'transcoder' ) }</h2>

								<div className="analytics-info-container border-t border-gray-500">
									<div className="analytics-info">
										<span id="engagement-rate">0%</span>
										<p>{ __( 'Average Engagement', 'transcoder' ) }</p>
									</div>
									<hr />
									<div className="analytics-info">
										<span id="total-plays">0</span>
										<p>{ __( 'Total Plays', 'transcoder' ) }</p>
									</div>
									<hr />
									<div className="analytics-info">
										<span id="play-rate">0%</span>
										<p>{ __( 'Play Rate', 'transcoder' ) }</p>
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
											<source src={ analyticsData.source_url || '' } type={ analyticsData.mime_type || 'video/mp4' } />
										</video>
										<div className="video-chart-container">
											<div id="chart-container">
												<svg id="line-chart" width="640" height="300"></svg>
												<div className="tooltip"></div>
											</div>
										</div>
									</div>
									<div className="video-container">
										<div id="heatmap-container">
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
		</>
	);
};

export default Analytics;
