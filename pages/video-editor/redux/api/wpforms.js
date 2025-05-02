/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const wpFormsApi = createApi( {
	reducerPath: 'wpFormsApi',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			headers.set( 'X-WP-Nonce', window.godamRestRoute.nonce );
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		getWPForms: builder.query( {
			query: () => ( {
				url: '/wpforms/v1/forms',
				method: 'GET',
			} ),
		} ),
		getSingleWPForm: builder.query( {
			query: ( formId ) => ( {
				url: `/godam/v1/wpform`,
				params: {
					id: formId,
				},
				method: 'GET',
			} ),
		} ),
	} ),
} );

export const {
	useGetWPFormsQuery,
	useGetSingleWPFormQuery,
} = wpFormsApi;

