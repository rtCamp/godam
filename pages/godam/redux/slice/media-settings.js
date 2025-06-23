/**
 * External dependencies
 */
import { createSlice } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import { VideoCustomCSSTemplate } from '../../components/VideoCustomCSSTemplate';

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
	isChanged: {
		general: false,
		video: false,
		video_player: false,
	},
};

const mediaSettingsSlice = createSlice( {
	name: 'mediaSettings',
	initialState,
	reducers: {
		// Sets the entire media settings (validates allowed keys)
		setMediaSettings: ( state, action ) => {
			Object.keys( action.payload ).forEach( ( category ) => {
				if ( state.settings[ category ] ) {
					state.settings[ category ] = {
						...state.settings[ category ],
						...action.payload[ category ],
					};
				}
			} );
			// Reset isChanged for all categories on full settings update
			Object.keys( state.isChanged ).forEach( ( category ) => {
				state.isChanged[ category ] = false;
			} );
		},

		// Updates a specific setting dynamically
		updateMediaSetting: ( state, action ) => {
			const { category, key, value } = action.payload;
			if ( state.settings[ category ] && key in state.settings[ category ] ) {
				state.settings[ category ][ key ] = value;
				state.isChanged[ category ] = true;
			}
		},

		// Resets isChanged after successful save
		resetChanges: ( state, action ) => {
			const { category } = action.payload;
			if ( state.isChanged[ category ] !== undefined ) {
				state.isChanged[ category ] = false;
			}
		},
	},
} );

export const { setMediaSettings, updateMediaSetting, resetChanges } = mediaSettingsSlice.actions;

// Selector to get media settings for a specific category
export const selectMediaSettings = ( category ) => ( state ) => state.mediaSettings.settings[ category ] || initialState.settings[ category ];

// Selector to check if settings have changed for a category
export const selectHasChanges = ( category ) => ( state ) => state.mediaSettings.isChanged[ category ];

export default mediaSettingsSlice.reducer;
