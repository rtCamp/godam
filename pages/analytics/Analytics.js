/**
 * External dependencies
 */
import React, { useState, useEffect } from 'react';
/**
 * Internal dependencies
 */
import './analytics.css';
import '../video-editor/style.scss';
import VideoJS from './Video';
import axios from 'axios';
/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

const Chart = ( { data, duration, width } ) => {
	const updatedWidth = 640 < width ? 640 : width;
	const adjuster = updatedWidth / duration;
	const opacity = ( 100 / data.length ) / 100;

	return (
		<div id="chart" className="chart mt-6 h-24" style={ {
			width: updatedWidth,
			border: data && data.ranges ? 'none' : '1px solid #b7b4b4', // Add border if no data
		} }>
			{ data && data.ranges &&
			data.ranges.map( ( ranges, rangeIndex ) =>
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

	useEffect( () => {
		const url = `/wp-json/wp/v2/media/${ attachmentID }`;

		axios
			.get( url )
			.then( ( response ) => {
				const data = response.data;
				setAnalyticsData( data );
			} )
			.catch( ( error ) => {
				console.error( 'Failed to fetch data:', error );
			} );
	}, [ attachmentID ] );

	const metadata = analyticsData?.easydam_meta?.videoConfig
		? analyticsData.easydam_meta.videoConfig
		: {
			controls: true,
			autoplay: false,
			preload: 'auto',
			fluid: true,
			aspectRatio: '16:9',
		};

	return (
		<div className="analytics-container flex flex-col items-center">
			<div className="video-info-container">
				<div className="analytics-info-container">
					{ analyticsData?.title?.rendered && (
						<h1 className="mb-4">{ analyticsData?.title?.rendered }</h1>
					) }
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
				{ analyticsData && (
					<VideoJS
						options={ {
							...metadata,
							sources: [
								{
									src: analyticsData.source_url || '',
									type: analyticsData.mime_type || 'video/mp4',
								},
							],
						} }
					/>
				) }
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
