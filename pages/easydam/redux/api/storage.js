/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const storageAPI = createApi( {
	reducerPath: 'storageApi',
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
		validateCredentials: builder.query( {
			query: () => ( {
				url: 'validate-credentials',
				method: 'GET',
				headers: {
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
		} ),
	} ),
} );

export const { useGetAWSSettingsQuery, useGetBucketsQuery, useSaveAWSSettingsMutation, useValidateCredentialsQuery } = storageAPI;
