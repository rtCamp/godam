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
				if (
					response.status === 'error' &&
					response.message.includes( 'Invalid or unverified API key' )
				) {
					return { errorType: 'invalid_key' };
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
	} ),
} );

export const { useFetchAnalyticsDataQuery, useFetchProcessedAnalyticsHistoryQuery } = analyticsApi;
