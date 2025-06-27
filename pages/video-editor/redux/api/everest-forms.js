/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const everestFormsApi = createApi( {
	reducerPath: 'everestFormsApi',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			headers.set( 'X-WP-Nonce', window.godamRestRoute.nonce );
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		getEverestForms: builder.query( {
			query: () => ( {
				url: '/godam/v1/everest-forms',
				method: 'GET',
			} ),
		} ),
		getSingleEverestForm: builder.query( {
			query: ( formId ) => ( {
				url: `/godam/v1/everest-form`,
				params: {
					id: formId,
				},
				method: 'GET',
			} ),
		} ),
	} ),
} );

export const {
	useGetEverestFormsQuery,
	useGetSingleEverestFormQuery,
} = everestFormsApi;
