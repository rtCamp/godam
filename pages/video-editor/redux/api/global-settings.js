/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const globalSettingsAPI = createApi( {
	reducerPath: 'globalSettingsAPI',
	baseQuery: fetchBaseQuery( {
		baseUrl: `${restURL}/godam/v1/settings/`,
	} ),
	endpoints: ( builder ) => ( {
		getGlobalSettings: builder.query( {
			query: () => ( {
				url: 'godam-settings',
				method: 'GET',
				headers: {
					'X-WP-Nonce': window.videoData.nonce,
				},
			} ),
		} ),
	} ),
} );

export const {
	useGetGlobalSettingsQuery,
} = globalSettingsAPI;
