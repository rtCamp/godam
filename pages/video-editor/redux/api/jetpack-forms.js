/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const jetpackFormsApi = createApi( {
	reducerPath: 'jetpackFormsApi',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			headers.set( 'X-WP-Nonce', window.godamRestRoute.nonce );
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		getJetpackForms: builder.query( {
			query: () => ( {
				url: '/godam/v1/jetpack-forms',
				method: 'GET',
			} ),
		} ),
		getSingleJetpackForm: builder.query( {
			query: ( { id, theme } ) => ( {
				url: `/godam/v1/jetpack-form`,
				params: {
					id,
					theme,
				},
				method: 'GET',
			} ),
		} ),
	} ),
} );

export const {
	useGetJetpackFormsQuery,
	useGetSingleJetpackFormQuery,
} = jetpackFormsApi;
