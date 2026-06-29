/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';
const restNonce = window.godamRestRoute?.nonce || window.wpApiSettings?.nonce || window.videoData?.nonce || '';

/**
 * REST-backed collection for the Video Editor list view.
 *
 * Server paginates/sorts/filters/searches via WP_Query; the component drives
 * an infinite scroll by bumping `page`, so this is modelled as a mutation
 * (imperative, uncached) — mirroring the legacy `query-attachments` slice it
 * replaces.
 */
export const videoEditorAPI = createApi( {
	reducerPath: 'videoEditorAPI',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			if ( restNonce ) {
				headers.set( 'X-WP-Nonce', restNonce );
			}
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		getVideoEditorVideos: builder.mutation( {
			query: ( { page = 1, perPage = 20, search = '', orderby = 'date', order = 'desc', filter = 'all' } = {} ) => ( {
				url: 'godam/v1/video-editor/videos',
				method: 'GET',
				params: {
					page,
					per_page: perPage,
					search,
					orderby,
					order,
					filter,
				},
			} ),
			transformResponse: ( response ) => ( {
				items: response?.items || [],
				paginationInfo: {
					totalItems: Number( response?.total ) || 0,
					totalPages: Number( response?.totalPages ) || 0,
				},
			} ),
		} ),
	} ),
} );

export const {
	useGetVideoEditorVideosMutation,
} = videoEditorAPI;
