/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const generalAPI = createApi( {
	reducerPath: 'generalAPI',
	baseQuery: fetchBaseQuery( { baseUrl: '/wp-json/godam/v1/settings/' } ),
	endpoints: ( builder ) => ( {
		getSubscriptionPlans: builder.query( {
			query: () => ( {
				url: 'subscription-plans',
				headers: {
					'Content-Type': 'application/json',
				},
			} ),
			transformResponse: ( response ) => {
				if ( response?.data ) {
					return {
						...response,
						data: response.data.sort( ( a, b ) => a.cost - b.cost ),
					};
				}
				return response;
			},
		} ),
	} ),
} );

export const { useGetSubscriptionPlansQuery } = generalAPI;
