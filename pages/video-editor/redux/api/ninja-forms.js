/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const ninjaFormsApi = createApi( {
	reducerPath: 'ninjaFormsApi',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			headers.set( 'X-WP-Nonce', window.godamRestRoute.nonce );
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		getNinjaForms: builder.query( {
			query: () => ( {
				url: '/godam/v1/ninja-forms',
				method: 'GET',
			} ),
		} ),
		getSingleNinjaForm: builder.query( {
			query: ( formId ) => ( {
				url: `/godam/v1/ninja-form`,
				params: {
					id: formId,
				},
				method: 'GET',
			} ),
		} ),
	} ),
} );

export const {
	useGetNinjaFormsQuery,
	useGetSingleNinjaFormQuery,
} = ninjaFormsApi;
