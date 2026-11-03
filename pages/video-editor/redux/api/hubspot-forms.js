/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

export const hubspotFormsApi = createApi( {
	reducerPath: 'hubspotFormsApi',
	baseQuery: fetchBaseQuery( {
		baseUrl: window.pathJoin( [ restURL, '/godam/v1/' ] ),
		prepareHeaders: ( headers ) => {
			const nonce = window.godamRestRoute?.nonce || window.wpApiSettings?.nonce;
			if ( nonce ) {
				headers.set( 'X-WP-Nonce', nonce );
			}
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		getHubspotForms: builder.query( {
			query: () => ( {
				url: 'hubspot-forms',
				method: 'GET',
			} ),
		} ),
	} ),
} );

export const { useGetHubspotFormsQuery } = hubspotFormsApi;
