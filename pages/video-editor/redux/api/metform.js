/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * REST URL for the WP site.
 */
const restURL = window.godamRestRoute.url || '';

/**
 * Create API for the sure forms.
 */
export const metformApi = createApi( {
	reducerPath: 'metFormApi',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			headers.set( 'X-WP-Nonce', window.godamRestRoute.nonce );
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		getMetforms: builder.query( {
			query: () => ( {
				url: '/godam/v1/metforms',
				method: 'GET',
			} ),
		} ),
		getSingleMetform: builder.query( {
			query: ( formId ) => ( {
				url: `/godam/v1/metform`,
				params: {
					id: formId,
				},
				method: 'GET',
			} ),
		} ),
	} ),
} );

export const {
	useGetMetformsQuery,
	useGetSingleMetformQuery,
} = metformApi;

