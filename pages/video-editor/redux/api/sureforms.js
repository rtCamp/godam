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
export const sureformsApi = createApi( {
	reducerPath: 'sureFormsApi',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			headers.set( 'X-WP-Nonce', window.godamRestRoute.nonce );
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		getSureforms: builder.query( {
			query: () => ( {
				url: '/godam/v1/sureforms',
				method: 'GET',
			} ),
		} ),
		getSingleSureform: builder.query( {
			query: ( formId ) => ( {
				url: `/godam/v1/sureform`,
				params: {
					id: formId,
				},
				method: 'GET',
			} ),
		} ),
	} ),
} );

export const {
	useGetSureformsQuery,
	useGetSingleSureformQuery,
} = sureformsApi;

