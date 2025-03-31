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
		verifyLicenseKey: builder.mutation( {
			query: ( licenseKey ) => ( {
				url: 'verify-license',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
				body: { license_key: licenseKey },
			} ),
		} ),
		deactiveLicenseKey: builder.mutation( {
			query: () => ( {
				url: 'deactivate-license',
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
	useVerifyLicenseKeyMutation,
	useDeactiveLicenseKeyMutation,
	useGetMediaSettingsQuery,
	useSaveMediaSettingsMutation,
} = generalAPI;
