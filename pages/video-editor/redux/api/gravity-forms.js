/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const gravityFormsAPI = createApi( {
	reducerPath: 'gravityFormsAPI',
	baseQuery: fetchBaseQuery( {
		baseUrl: window.pathJoin( [ restURL, '/godam/v1/' ] ),
	} ),
	endpoints: ( builder ) => ( {
		getForms: builder.query( {
			query: () => ( {
				url: 'gforms',
				params: {
					fields: 'id,title,description',
				},
				method: 'GET',
			} ),
		} ),
	} ),
} );

export const {
	useGetFormsQuery,
} = gravityFormsAPI;
