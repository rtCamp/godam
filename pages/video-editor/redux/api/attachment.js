/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const attachmentAPI = createApi( {
	reducerPath: 'attachmentAPI',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
	} ),
	endpoints: ( builder ) => ( {
		getAttachmentMeta: builder.query( {
			query: ( id ) => ( {
				url: `/wp/v2/media/${ id }`,
				method: 'GET',
			} ),
		} ),
		saveAttachmentMeta: builder.mutation( {
			query: ( { id, data } ) => ( {
				url: `/wp/v2/media/${ id }`,
				method: 'POST',
				body: data,

				headers: {
					'X-WP-Nonce': window.videoData.nonce,
				},
			} ),
		} ),
	} ),
} );

export const {
	useGetAttachmentMetaQuery,
	useSaveAttachmentMetaMutation,
} = attachmentAPI;
