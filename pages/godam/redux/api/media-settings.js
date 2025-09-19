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
			query: ( data ) => {
				// Remove isChanged flag and wrap in settings object as expected by backend
				const { isChanged, ...settingsData } = data;
				return {
					url: 'godam-settings',
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.wpApiSettings.nonce,
					},
					body: { settings: settingsData },
				};
			},
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
	} ),
} );

export const {
	useVerifyAPIKeyMutation,
	useDeactivateAPIKeyMutation,
	useGetMediaSettingsQuery,
	useSaveMediaSettingsMutation,
} = generalAPI;
