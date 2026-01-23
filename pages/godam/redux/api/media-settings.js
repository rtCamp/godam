/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const generalAPI = createApi( {
	reducerPath: 'generalAPI',
	baseQuery: fetchBaseQuery( { baseUrl: window.pathJoin( [ restURL, '/godam/v1/settings/' ] ) } ),
	endpoints: ( builder ) => ( {
		getMediaSettings: builder.query( {
			query: () => ( {
				url: 'godam-settings',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
		} ),
		saveMediaSettings: builder.mutation( {
			query: ( data ) => ( {
				url: 'godam-settings',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
				body: data,
			} ),
		} ),
		verifyAPIKey: builder.mutation( {
			query: ( apiKey ) => ( {
				url: 'verify-api-key',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
				body: { api_key: apiKey },
			} ),
		} ),
		deactivateAPIKey: builder.mutation( {
			query: () => ( {
				url: 'deactivate-api-key',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
		} ),
		refreshAPIKeyStatus: builder.mutation( {
			query: () => ( {
				url: 'refresh-api-key-status',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
		} ),
	} ),
} );

export const {
	useVerifyAPIKeyMutation,
	useDeactivateAPIKeyMutation,
	useRefreshAPIKeyStatusMutation,
	useGetMediaSettingsQuery,
	useSaveMediaSettingsMutation,
} = generalAPI;
