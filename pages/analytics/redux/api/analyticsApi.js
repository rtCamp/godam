/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const analyticsApi = createApi( {
	reducerPath: 'analyticsApi',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			headers.set( 'Content-Type', 'application/json' );
			headers.set( 'X-WP-Nonce', window.wpApiSettings.nonce );
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		fetchAnalyticsData: builder.query( {
			query: ( { videoId, siteUrl } ) => ( {
				url: 'godam/v1/analytics/fetch',
				params: {
					video_id: videoId,
					site_url: siteUrl,
				},
			} ),
			transformResponse: ( response ) => {
				if ( response.status === 'error' ) {
					return {
						errorType: response.errorType || 'unknown_error',
						message: response.message,
					};
				}

				if ( response.status !== 'success' ) {
					throw new Error( response.message );
				}

				return response.data;
			},
		} ),
		fetchProcessedAnalyticsHistory: builder.query( {
			query: ( { days, videoId, siteUrl } ) => ( {
				url: 'godam/v1/analytics/history',
				params: {
					days,
					video_id: videoId,
					site_url: siteUrl,
				},
			} ),
			transformResponse: ( response ) => {
				if ( response.status === 'error' ) {
					throw new Error( response.message );
				}
				return response.processed_analytics || [];
			},
		} ),
		fetchProcessedLayerAnalytics: builder.query( {
			query: ( { layerType, days, siteUrl, videoId } ) => ( {
				url: 'godam/v1/analytics/layer-analytics',
				params: {
					layer_type: layerType,
					days,
					site_url: siteUrl,
					video_id: videoId,
				},
			} ),
			transformResponse: ( response ) => {
				if ( response.status === 'error' ) {
					throw new Error( response.message );
				}
				return response.layer_analytics || [];
			},
		} ),

	} ),
} );

export const {
	useFetchAnalyticsDataQuery,
	useFetchProcessedAnalyticsHistoryQuery,
	useFetchProcessedLayerAnalyticsQuery,
} = analyticsApi;
