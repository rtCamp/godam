/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const videosAPI = createApi( {
	reducerPath: 'videoAPI',
	baseQuery: fetchBaseQuery( { baseUrl: '/wp-admin' } ),
	endpoints: ( builder ) => ( {

		getVideos: builder.mutation( {
			query: ( data ) => {
				const params = new URLSearchParams();
				params.append( 'action', 'query-attachments' );
				params.append( 'post_id', '0' );
				params.append( 'query[post_mime_type]', 'video' );
				params.append( 'query[posts_per_page]', '40' );
				params.append( 'query[orderby]', 'date' );
				params.append( 'query[order]', 'DESC' );

				if ( data.page ) {
					params.append( 'query[paged]', data.page );
				} else {
					params.append( 'query[paged]', '1' );
				}

				if ( data.search ) {
					params.append( 'query[s]', data.search );
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
		} ),
	} ),
} );

export const {
	useGetVideosMutation,
} = videosAPI;
