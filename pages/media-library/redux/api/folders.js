/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Internal dependencies
 */
import { getCurrentMimeTypeFilter } from '../../data/utilities';

const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

/**
 * Poll a folder-ZIP build job until it finishes.
 *
 * The download endpoint now returns a job id immediately and builds the archive in the
 * background (so large folders no longer time out the request). This polls the status
 * endpoint until the job is `completed` or `failed`, or the timeout is reached.
 *
 * @param {string} jobId                      The job id returned by the downloadZip mutation.
 * @param {Object} [options]                  Polling options.
 * @param {number} [options.intervalMs=2000]  Delay between polls.
 * @param {number} [options.timeoutMs=180000] Give up after this long.
 * @return {Promise<Object>} Resolves with { status, zip_url, zip_name, message }.
 */
export async function pollZipJobStatus( jobId, { intervalMs = 2000, timeoutMs = 180000 } = {} ) {
	const url = `${ restURL }godam/v1/media-library/download-folder-status/${ jobId }`;
	const start = Date.now();

	while ( Date.now() - start < timeoutMs ) {
		try {
			const res = await fetch( url, {
				headers: { 'X-WP-Nonce': window.MediaLibrary.nonce },
			} );
			const json = await res.json();
			const data = json?.data || {};

			if ( data.status === 'completed' || data.status === 'failed' ) {
				return data;
			}
		} catch ( e ) {
			// Transient network error — keep polling until the timeout.
		}

		await new Promise( ( resolve ) => setTimeout( resolve, intervalMs ) );
	}

	return { status: 'failed', message: 'Timed out while preparing the ZIP file.' };
}

export const folderApi = createApi( {
	reducerPath: 'folderApi',
	baseQuery: fetchBaseQuery( { baseUrl: restURL } ),
	endpoints: ( builder ) => ( {
		getAllMediaCount: builder.query( {
			async queryFn( arg, api, extraOptions, baseQuery ) {
				const mimeTypeParams = getCurrentMimeTypeFilter( 'media_type' );

				const result = await baseQuery( {
					url: 'wp/v2/media',
					params: {
						_fields: 'id',
						per_page: 1,
						...mimeTypeParams,
					},
					// Send the REST nonce so the count runs as the current user (matching the
					// grid). Without it the request is anonymous and only counts public media,
					// undercounting when private/pending attachments exist.
					headers: {
						'X-WP-Nonce': window.MediaLibrary.nonce,
					},
				} );

				if ( result.error ) {
					return { error: result.error };
				}

				const totalMediaCount = parseInt( result.meta?.response?.headers.get( 'X-WP-Total' ) || '0', 10 );

				return { data: totalMediaCount };
			},
		} ),
		getCategoryMediaCount: builder.query( {
			query: ( { folderId } ) => {
				const mimeTypeParams = getCurrentMimeTypeFilter();

				return {
					url: `godam/v1/media-library/category-count/${ folderId }`,
					params: mimeTypeParams,
					headers: {
						'X-WP-Nonce': window.MediaLibrary.nonce,
					},
				};
			},
		} ),
		getFolders: builder.query( {
			query: ( options = {} ) => {
				const isSpecial = options.bookmark || options.locked;

				const mimeTypeParams = getCurrentMimeTypeFilter();

				const params = {
					_fields: 'id,name,parent,attachmentCount,meta',
					per_page: isSpecial ? 100 : 20,
					...( options.bookmark ? { bookmark: true } : {} ),
					...( options.locked ? { locked: true } : {} ),
					...( options.page ? { page: options.page } : {} ),
					...mimeTypeParams,
				};

				return {
					url: 'godam/v1/media-library/media-folders',
					params,
					headers: {
						'X-WP-Nonce': window.MediaLibrary.nonce,
					},
				};
			},
			transformResponse: ( responseData, meta ) => {
				// Extract headers from meta.response.headers
				const headers = meta.response.headers;
				const totalItems = headers.get( 'X-Wp-Total' ) || headers.get( 'x-wp-total' );
				const totalPages = headers.get( 'X-Wp-Totalpages' ) || headers.get( 'x-wp-totalpages' );

				return {
					data: responseData, // Your original response data
					total: totalItems ? parseInt( totalItems, 10 ) : 0,
					totalPages: totalPages ? parseInt( totalPages, 10 ) : 0,
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
		searchFolders: builder.query( {
			async queryFn( { searchTerm, page = 1, perPage = 10 }, api, extraOptions, baseQuery ) {
				const result = await baseQuery( {
					url: `wp/v2/media-folder`,
					params: {
						search: searchTerm,
						page,
						per_page: perPage,
						// Include parent + meta so a folder selected from search keeps its
						// lock/bookmark state. With only id,name the selected folder lost its
						// meta, defeating the locked-folder checks downstream.
						_fields: 'id,name,parent,meta',
					},
					headers: {
						'X-WP-Nonce': window.MediaLibrary.nonce,
					},
				} );

				if ( result.error ) {
					return { error: result.error };
				}

				const totalPages = parseInt(
					result.meta?.response?.headers.get( 'X-WP-Totalpages' ) || '0',
					10,
				);

				return {
					data: {
						items: result.data,
						totalPages,
						currentPage: page,
					},
				};
			},
		} ),
	} ),
} );

export const {
	useGetAllMediaCountQuery,
	useGetCategoryMediaCountQuery,
	useGetFoldersQuery,
	useCreateFolderMutation,
	useUpdateFolderMutation,
	useDeleteFolderMutation,
	useBulkDeleteFoldersMutation,
	useBulkLockFoldersMutation,
	useBulkBookmarkFoldersMutation,
	useAssignFolderMutation,
	useDownloadZipMutation,
	useSearchFoldersQuery,
} = folderApi;
