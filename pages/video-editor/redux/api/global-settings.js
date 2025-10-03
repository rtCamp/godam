/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Construct the REST URL properly, handling missing or empty godamRestRoute
const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json';
const cleanRestURL = restURL.replace( /\/$/, '' ); // Remove trailing slash

export const globalSettingsAPI = createApi( {
	reducerPath: 'globalSettingsAPI',
	baseQuery: fetchBaseQuery( {
		baseUrl: `${ cleanRestURL }/godam/v1/settings/`,
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
