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
				headers: {
					'X-WP-Nonce': window.videoData.nonce,
				},
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
		getResolvedAttachment: builder.query( {
			query: ( id ) => ( {
				url: `/godam/v1/media-library/attachment-by-id/${ id }`,
				method: 'GET',
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
	useGetResolvedAttachmentQuery,
} = attachmentAPI;
