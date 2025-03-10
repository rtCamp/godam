/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const generalAPI = createApi( {
	reducerPath: 'generalAPI',
	baseQuery: fetchBaseQuery( { baseUrl: '/wp-json/godam/v1/settings/' } ),
	endpoints: ( builder ) => ( {
		getSubscriptionPlans: builder.query( {
			query: () => ( {
				url: 'subscription-plans',
				headers: {
					'Content-Type': 'application/json',
				},
			} ),
			transformResponse: ( response ) => {
				if ( response?.data ) {
					return {
						...response,
						data: response.data.sort( ( a, b ) => a.cost - b.cost ),
					};
				}
				return response;
			},
		} ),
		getMediaSettings: builder.query( {
			query: () => ( {
				url: 'easydam-settings',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
		} ),
		saveMediaSettings: builder.mutation( {
			query: ( data ) => ( {
				url: 'easydam-settings',
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
	useGetSubscriptionPlansQuery,
	useVerifyLicenseKeyMutation,
	useDeactiveLicenseKeyMutation,
	useGetMediaSettingsQuery,
	useSaveMediaSettingsMutation,
} = generalAPI;
