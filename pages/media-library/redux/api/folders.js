/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const folderApi = createApi( {
	reducerPath: 'folderApi',
	baseQuery: fetchBaseQuery( { baseUrl: '/wp-json/' } ),
	endpoints: ( builder ) => ( {
		getFolders: builder.query( {
			query: () => ( {
				url: 'wp/v2/media-folder',
				params: {
					_fields: 'id,name,parent',
				},
			} ),
		} ),
		createFolder: builder.mutation( {
			query: ( data ) => ( {
				url: 'wp/v2/media-folder',
				method: 'POST',
				body: data,
				headers: {
					'X-WP-Nonce': window.MediaLibrary.nonce,
				},
			} ),
		} ),
		updateFolder: builder.mutation( {
			query: ( data ) => ( {
				url: `wp/v2/media-folder/${ data.id }`,
				method: 'POST',
				body: data,
				headers: {
					'X-WP-Nonce': window.MediaLibrary.nonce,
				},
			} ),
		} ),
		deleteFolder: builder.mutation( {
			query: ( id ) => ( {
				url: `wp/v2/media-folder/${ id }`,
				params: {
					force: true,
				},
				method: 'DELETE',
				headers: {
					'X-WP-Nonce': window.MediaLibrary.nonce,
				},
			} ),
		} ),
		assignFolder: builder.mutation( {
			query: ( { attachmentIds, folderTermId } ) => ( {
				url: 'easydam/v1/media-library/assign-folder',
				method: 'POST',
				body: {
					attachment_ids: attachmentIds,
					folder_term_id: folderTermId,
				},
				headers: {
					'X-WP-Nonce': window.MediaLibrary.nonce,
				},
			} ),
		} ),
	} ),
} );

export const {
	useGetFoldersQuery,
	useCreateFolderMutation,
	useUpdateFolderMutation,
	useDeleteFolderMutation,
	useAssignFolderMutation,
} = folderApi;
