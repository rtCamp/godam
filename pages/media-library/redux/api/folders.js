/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const folderApi = createApi( {
	reducerPath: 'folderApi',
	baseQuery: fetchBaseQuery( { baseUrl: restURL } ),
	endpoints: ( builder ) => ( {
		getAllMediaCount: builder.query( {
			async queryFn( arg, api, extraOptions, baseQuery ) {
				const result = await baseQuery( {
					url: 'wp/v2/media',
					params: { _fields: 'id', per_page: 1 },
				} );
				if ( result.error ) {
					return { error: result.error };
				}

				const totalMediaCount = result.meta?.response?.headers.get( 'X-WP-Total' );

				return { data: totalMediaCount };
			},
		} ),
		getFolders: builder.query( {
			query: () => ( {
				url: 'wp/v2/media-folder',
				params: {
					_fields: 'id,name,parent,attachmentCount,meta',
					per_page: 100, // Note: 100 is the max per page. Implement pagination if total folders > 100
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
		bulkDeleteFolders: builder.mutation( {
			query: ( folderIds ) => ( {
				url: 'godam/v1/media-library/bulk-delete-folders',
				method: 'DELETE',
				body: { folder_ids: folderIds, force: true },
				headers: {
					'X-WP-Nonce': window.MediaLibrary.nonce,
					'Content-Type': 'application/json',
				},
			} ),
		} ),
		bulkLockFolders: builder.mutation( {
			query: ( { folderIds, lockedStatus } ) => ( {
				url: 'godam/v1/media-library/bulk-lock-folders',
				method: 'POST',
				body: {
					folder_ids: folderIds,
					locked_status: lockedStatus,
				},
				headers: {
					'X-WP-Nonce': window.MediaLibrary.nonce,
					'Content-Type': 'application/json',
				},
			} ),
		} ),
		bulkBookmarkFolders: builder.mutation( {
			query: ( { folderIds, bookmarkStatus } ) => ( {
				url: 'godam/v1/media-library/bulk-bookmark-folders',
				method: 'POST',
				body: {
					folder_ids: folderIds,
					bookmark_status: bookmarkStatus,
				},
				headers: {
					'X-WP-Nonce': window.MediaLibrary.nonce,
					'Content-Type': 'application/json',
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
	useGetAllMediaCountQuery,
	useGetFoldersQuery,
	useCreateFolderMutation,
	useUpdateFolderMutation,
	useDeleteFolderMutation,
	useBulkDeleteFoldersMutation,
	useBulkLockFoldersMutation,
	useBulkBookmarkFoldersMutation,
	useAssignFolderMutation,
	useDownloadZipMutation,
} = folderApi;
