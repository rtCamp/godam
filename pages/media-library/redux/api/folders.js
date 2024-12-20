/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const folderApi = createApi( {
	reducerPath: 'folderApi',
	baseQuery: fetchBaseQuery( { baseUrl: '/wp-json/wp/v2/' } ),
	endpoints: ( builder ) => ( {
		getFolders: builder.query( {
			query: () => ( {
				url: 'media-folder',
				params: {
					_fields: 'id,name,parent',
				},
			} ),
		} ),
		createFolder: builder.mutation( {
			query: ( data ) => ( {
				url: 'media-folder',
				method: 'POST',
				body: data,
				headers: {
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
		} ),
		updateFolder: builder.mutation( {
			query: ( data ) => ( {
				url: `media-folder/${ data.id }`,
				method: 'POST',
				body: data,
				headers: {
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
		} ),
		deleteFolder: builder.mutation( {
			query: ( id ) => ( {
				url: `media-folder/${ id }`,
				params: {
					force: true,
				},
				method: 'DELETE',
				headers: {
					'X-WP-Nonce': window.wpApiSettings.nonce,
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
} = folderApi;
