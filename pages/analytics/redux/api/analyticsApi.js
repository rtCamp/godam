/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

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
				// The WP proxy wraps microservice 4xx as 200 + errorType so
				// RTK Query doesn't trip on benign "no data" cases. Surface
				// errors as a soft object instead of throwing — the UI
				// renders a state-specific empty/error panel either way.
				if ( response.status === 'error' ) {
					return {
						errorType: response.errorType || 'unknown_error',
						message: response.message,
						layer_analytics: null,
					};
				}
				return {
					errorType: null,
					message: null,
					layer_analytics: response.layer_analytics || null,
				};
			},
		} ),
	} ),
} );

export const {
	useFetchAnalyticsDataQuery,
	useFetchProcessedAnalyticsHistoryQuery,
	useFetchProcessedLayerAnalyticsQuery,
} = analyticsApi;
