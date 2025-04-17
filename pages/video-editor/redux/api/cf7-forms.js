/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const contactForm7Api = createApi( {
	reducerPath: 'contactForm7Api',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			headers.set( 'X-WP-Nonce', window.godamRestRoute.nonce );
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		getCF7Forms: builder.query( {
			query: () => ( {
				url: '/contact-form-7/v1/contact-forms',
				method: 'GET',
			} ),
		} ),
	} ),
} );

export const {
	useGetCF7FormsQuery,
} = contactForm7Api;

