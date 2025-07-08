/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * REST URL for the WP site.
 */
const restURL = window.godamRestRoute.url || '';

/**
 * Create API for the forminator forms.
 */
export const forminatorFormsApi = createApi( {
	reducerPath: 'forminatorFormsApi',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			headers.set( 'X-WP-Nonce', window.godamRestRoute.nonce );
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		getForminatorForms: builder.query( {
			query: () => ( {
				url: '/godam/v1/forminator-forms',
				method: 'GET',
			} ),
		} ),
		getSingleForminatorForm: builder.query( {
			query: ( formId ) => ( {
				url: `/godam/v1/forminator-form`,
				params: {
					id: formId,
				},
				method: 'GET',
			} ),
		} ),
	} ),
} );

export const { useGetForminatorFormsQuery, useGetSingleForminatorFormQuery } = forminatorFormsApi;
