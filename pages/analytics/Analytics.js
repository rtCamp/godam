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
		<div className="video-analytics-container">
			<div className="overflow-auto">

				<div className="flex gap-8 items-start">
					<div className="w-[30%]">
						<h2 className="text-lg m-0 mb-2 w-[30%]">{ __( 'Analytics', 'transcoder' ) }</h2>

						<div className="analytics-info-container border-t border-gray-500">
							<div className="analytics-info">
								<span>62%</span>
								<p>{ __( 'Average Engagement', 'transcoder' ) }</p>
							</div>
							<hr />
							<div className="analytics-info">
								<span>104</span>
								<p>{ __( 'Total Plays', 'transcoder' ) }</p>
							</div>
							<hr />
							<div className="analytics-info">
								<span>28%</span>
								<p>{ __( 'Play Rate', 'transcoder' ) }</p>
							</div>
							<hr />
						</div>
					</div>
					<div className="w-[70%] min-w-[640px]">
						<h2 className="text-lg m-0 mb-2 w-[70%] min-w-[640px]">{ analyticsData?.title?.rendered }</h2>
						{ analyticsData && (
							<div>
								<div className="video-container">
									<video
										id="analytics-video"
										className="video-js"
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
										<svg id="heatmap" width="800" height="100"></svg>
										<div className="heatmap-tooltip"></div>
									</div>
								</div>
							</div>
						) }
					</div>
				</div>
			</div>
		</div>
	);
};

export default Analytics;
