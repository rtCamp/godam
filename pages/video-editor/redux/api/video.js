/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const videosAPI = createApi( {
	reducerPath: 'videoAPI',
	baseQuery: fetchBaseQuery( {
		baseUrl: window.ajaxurl ? window.ajaxurl.replace( '/admin-ajax.php', '' ) : '/wp-admin', // Dynamically set the base URL
	} ),
	endpoints: ( builder ) => ( {

		getVideos: builder.mutation( {
			query: ( data ) => {
				const params = new URLSearchParams();
				params.append( 'action', 'query-attachments' );
				params.append( 'query[post_mime_type]', 'video' );
				params.append( 'query[posts_per_page]', '40' );
				params.append( 'query[orderby]', 'date' );
				params.append( 'query[order]', 'DESC' );

				if ( data?.page ) {
					params.append( 'query[paged]', data?.page );
				} else {
					params.append( 'query[paged]', '1' );
				}

				if ( data?.search ) {
					params.append( 'query[s]', data?.search );
				}

				return {
					url: 'admin-ajax.php',
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
					body: params.toString(),
				};
			},
			transformResponse: async ( response, meta ) => {
				const totalNumPage = meta.response.headers.get( 'x-wp-totalpages' );
				const data = await response;
				data.totalNumPage = totalNumPage;
				return data;
			},
		} ),
	} ),
} );

export const {
	useGetVideosMutation,
} = videosAPI;
