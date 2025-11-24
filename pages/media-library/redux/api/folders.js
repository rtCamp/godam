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
				// Detect current media type filter.
				const getCurrentMimeTypeFilter = () => {
					// Check URL parameters.
					const urlParams = new URLSearchParams( window.location.search );
					const postMimeType = urlParams.get( 'post_mime_type' );

					if ( postMimeType ) {
						return { media_type: postMimeType };
					}

					// Check for media library state (for AJAX requests).
					if ( typeof wp !== 'undefined' && wp.media && wp.media.frame ) {
						const collection = wp.media.frame.state().get( 'library' );
						if ( collection && collection.props ) {
							const mimeType = collection.props.get( 'type' );
							if ( mimeType && mimeType !== 'all' ) {
								return { media_type: mimeType };
							}
						}
					}

					return {};
				};

				const mimeTypeParams = getCurrentMimeTypeFilter();

				const result = await baseQuery( {
					url: 'wp/v2/media',
					params: {
						_fields: 'id',
						per_page: 1,
						...mimeTypeParams,
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
				// Detect current media type filter.
				const getCurrentMimeTypeFilter = () => {
					// Check URL parameters.
					const urlParams = new URLSearchParams( window.location.search );
					const postMimeType = urlParams.get( 'post_mime_type' );

					if ( postMimeType ) {
						return { post_mime_type: postMimeType };
					}

					// Check for media library state (for AJAX requests).
					if ( typeof wp !== 'undefined' && wp.media && wp.media.frame ) {
						const collection = wp.media.frame.state().get( 'library' );
						if ( collection && collection.props ) {
							const mimeType = collection.props.get( 'type' );
							if ( mimeType && mimeType !== 'all' ) {
								return { post_mime_type: mimeType };
							}
						}
					}

					return {};
				};

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

				// Detect current media type filter from URL or media library state.
				const getCurrentMimeTypeFilter = () => {
					// Check URL parameters.
					const urlParams = new URLSearchParams( window.location.search );
					const postMimeType = urlParams.get( 'post_mime_type' );

					if ( postMimeType ) {
						return { post_mime_type: postMimeType };
					}

					// Check for media library state (for AJAX requests).
					if ( typeof wp !== 'undefined' && wp.media && wp.media.frame ) {
						const collection = wp.media.frame.state().get( 'library' );
						if ( collection && collection.props ) {
							const mimeType = collection.props.get( 'type' );
							if ( mimeType && mimeType !== 'all' ) {
								return { post_mime_type: mimeType };
							}
						}
					}

					return {};
				};

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
						_fields: 'id,name',
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
