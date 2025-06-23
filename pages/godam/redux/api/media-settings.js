/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Internal dependencies
 */
import { setMediaSettings, resetChanges } from '../slice/media-settings.js';
import { VideoCustomCSSTemplate } from '../../components/VideoCustomCSSTemplate';

const restURL = window.godamRestRoute.url || '';

export const generalAPI = createApi( {
	reducerPath: 'generalAPI',
	baseQuery: fetchBaseQuery( { baseUrl: window.pathJoin( [ restURL, '/godam/v1/settings/' ] ) } ),
	endpoints: ( builder ) => ( {
		getMediaSettings: builder.query( {
			query: () => ( {
				url: 'godam-settings',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
			async onQueryStarted( arg, { dispatch, queryFulfilled } ) {
				try {
					const { data } = await queryFulfilled;
					dispatch( setMediaSettings( data ) );
					dispatch( setMediaSettings( {
						video: data.video || initialState.settings.video,
						general: data.general || initialState.settings.general,
						video_player: {
							custom_css: data.video_player?.custom_css?.trim() ? data.video_player.custom_css : initialState.settings.video_player.custom_css,
						},
					} ) );
				} catch {}
			},
		} ),
		saveMediaSettings: builder.mutation( {
			query: ( data ) => ( {
				url: 'godam-settings',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
				body: data,
			} ),
			async onQueryStarted( arg, { dispatch, queryFulfilled } ) {
				try {
					const { data } = await queryFulfilled;
					if ( data?.status === 'success' ) {
						const category = Object.keys( arg.settings )[ 0 ];
						dispatch( resetChanges( { category } ) );
					}
				} catch {}
			},
		} ),
		verifyAPIKey: builder.mutation( {
			query: ( apiKey ) => ( {
				url: 'verify-api-key',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
				body: { api_key: apiKey },
			} ),
		} ),
		deactivateAPIKey: builder.mutation( {
			query: () => ( {
				url: 'deactivate-api-key',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} ),
		} ),
	} ),
} );

export const {
	useVerifyAPIKeyMutation,
	useDeactivateAPIKeyMutation,
	useGetMediaSettingsQuery,
	useSaveMediaSettingsMutation,
} = generalAPI;

const initialState = {
	settings: {
		video: {
			video_quality: [],
			video_compress_quality: 100,
			video_thumbnails: 5,
			overwrite_thumbnails: false,
			watermark: false,
			use_watermark_image: false,
			watermark_text: '',
			watermark_url: '',
		},
		general: {
			enable_folder_organization: true,
			brand_color: '#000000',
			brand_image: '',
		},
		video_player: {
			custom_css: VideoCustomCSSTemplate,
		},
	},
};
