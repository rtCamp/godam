/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const settingsApi = createApi( {
	reducerPath: 'settingsApi',
	baseQuery: fetchBaseQuery( { baseUrl: '/wp-json/easydam/v1/settings/' } ),
	endpoints: ( builder ) => ( {
		getAWSSettings: builder.query( {
			query: () => ( {
				url: 'aws',
				headers: {
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
		} ),
		getBuckets: builder.query( {
			query: () => ( {
				url: 'get-buckets',
				headers: {
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
		} ),
		saveAWSSettings: builder.mutation( {
			query: ( settings ) => ( {
				url: 'aws',
				method: 'POST',
				headers: {
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
				body: settings,
			} ),
		} ),
		validateSettings: builder.query( {
			query: () => ( {
				url: 'validate-settings',
				method: 'GET',
				headers: {
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
		} ),
	} ),
} );

export const { useGetAWSSettingsQuery, useGetBucketsQuery, useSaveAWSSettingsMutation } = settingsApi;
