/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const folderApi = createApi( {
	reducerPath: 'folderApi',
	baseQuery: fetchBaseQuery( { baseUrl: restURL } ),
	endpoints: ( builder ) => ( {
		getFolders: builder.query( {
			query: ( { page = 1, perPage = 100 } = {} ) => ( {
				url: 'godam/v1/media-library/media-folders',
				params: {
					page,
					per_page: perPage,
				},
				headers: {
					'X-WP-Nonce': window.MediaLibrary?.nonce || '',
				},
			} ),
			transformResponse: ( response, meta ) => {
				const total = parseInt( meta?.response?.headers.get( 'X-WP-Total' ) || '0', 10 );
				const totalPages = parseInt( meta?.response?.headers.get( 'X-WP-TotalPages' ) || '1', 10 );
				return {
					folders: response,
					total,
					totalPages,
				};
			},
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
				url: 'godam/v1/media-library/assign-folder',
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
		downloadZip: builder.mutation( {
			query: ( { folderId } ) => ( {
				url: `godam/v1/media-library/download-folder/${ folderId }`,
				method: 'POST',
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
	useDownloadZipMutation,
} = folderApi;
