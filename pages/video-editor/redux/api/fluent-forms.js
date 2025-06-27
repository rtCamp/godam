/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const fluentFormsApi = createApi( {
	reducerPath: 'fluentFormsApi',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			headers.set( 'X-WP-Nonce', window.godamRestRoute.nonce );
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		getFluentForms: builder.query( {
			query: () => ( {
				url: '/godam/v1/fluent-forms',
				method: 'GET',
			} ),
		} ),
		getSingleFluentForm: builder.query( {
			query: ( formId ) => ( {
				url: `/godam/v1/fluent-form`,
				params: {
					id: formId,
				},
				method: 'GET',
			} ),
		} ),
	} ),
} );

export const {
	useGetFluentFormsQuery,
	useGetSingleFluentFormQuery,
} = fluentFormsApi;
