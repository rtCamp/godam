/**
 * External dependencies
 */
import React, { useState, useEffect } from 'react';
/**
 * Internal dependencies
 */
import './analytics.css';
import '../video-editor/style.scss';
import Video from '../video-editor/Video';

const Chart = ( { data, duration, width } ) => {
	// Calculate the adjuster and opacity once
	const adjuster = width / duration;
	const opacity = ( 100 / data.length ) / 100;

	return (
		<div id="chart" className="chart mt-6 h-24" style={ { width } }>
			{ data && data.map( ( ranges, rangeIndex ) =>
				ranges.map( ( range, index ) => (
					<div
						key={ `${ rangeIndex }-${ index }` }
						className="chart-bar"
						style={ {
							left: `${ range[ 0 ] * adjuster }px`,
							width: `${ ( range[ 1 ] - range[ 0 ] ) * adjuster }px`,
							opacity,
						} }
					/>
				) ),
			) }
		</div>
	);
};

const Analytics = ( { attachmentID } ) => {
	const [ analyticsData, setAnalyticsData ] = useState( null );
	const [ currentTime, setCurrentTime ] = useState( 0 );

	useEffect( () => {
		const fetchSettings = async () => {
			const url = `/wp-json/wp/v2/media/${ attachmentID }`;
			try {
				const analyticsResponse = await fetch( url, {
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.wpApiSettings.nonce,
					},
				} );

				const data = await analyticsResponse.json();

				setAnalyticsData( data );
			} catch ( error ) {
				console.error( 'Failed to fetch data:', error );
			}
		};

		fetchSettings();
	}, [ attachmentID ] );

	return (
		<div className="analytics-container flex flex-col items-center">
			<div className="video-info-container">
				<div className="analytics-info-container">
					<div className="analytics-info">
						<span>62%</span>
						<p>Average Engagement</p>
					</div>
					<hr />
					<div className="analytics-info">
						<span>104</span>
						<p>Total Plays</p>
					</div>
					<hr />
					<div className="analytics-info">
						<span>28%</span>
						<p>Play Rate</p>
					</div>
					<hr />
				</div>
				<Video
					currentTime={ currentTime }
					setCurrentTime={ setCurrentTime }
					attachmentID={ attachmentID }
					videoData={ window.videoData }
				/>
			</div>
			{ analyticsData && (
				<Chart
					data={ analyticsData.easydam_analytics }
					duration={ analyticsData.media_details.length || 1 }
					width={ analyticsData.media_details.width || 1 }
				/>
			) }
		</div>
	);
};

export default Analytics;
