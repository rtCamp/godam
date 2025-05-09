/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const pollsAPI = createApi( {
	reducerPath: 'pollsAPI',
	baseQuery: fetchBaseQuery( {
		baseUrl: window.pathJoin( [ restURL, '/godam/v1/' ] ),
	} ),
	endpoints: ( builder ) => ( {
		getPolls: builder.query( {
			query: () => ( {
				url: 'polls',
				method: 'GET',
			} ),
		} ),
		getPoll: builder.query( {
			query: ( id ) => ( {
				url: `poll/${ id }`,
				method: 'GET',
			} ),
		} ),
	} ),
} );

export const {
	useGetPollsQuery,
	useGetPollQuery,
} = pollsAPI;
