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

				const sampleCountryData = {
					USA: 120,
					India: 95,
					'United Kingdom': 45,
					Germany: 30,
					Canada: 25,
					Australia: 20,
					France: 18,
					Brazil: 15,
					Japan: 10,
					'South Africa': 8,
				};

				return {
					...response.data,
					country_views: sampleCountryData,
				};
			},
		} ),
	} ),
} );

export const { useFetchAnalyticsDataQuery } = analyticsApi;
