/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * REST URL for the WP site.
 */
const restURL = window.godamRestRoute.url || '';

/**
 * Create API for the HubSpot forms.
 */
export const hubSpotFormsApi = createApi( {
	reducerPath: 'hubSpotFormsApi',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			headers.set( 'X-WP-Nonce', window.godamRestRoute.nonce );
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		getHubSpotForms: builder.query( {
			query: ( id ) => ( {
				url: `/godam/v1/hubspot-forms?id=${ id }`,
				method: 'GET',
			} ),
		} ),
	} ),
} );

export const { useGetHubSpotFormsQuery } = hubSpotFormsApi;
