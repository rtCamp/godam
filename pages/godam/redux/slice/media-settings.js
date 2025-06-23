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
					const settings = { ...state.settings[ category ] };
					Object.keys( action.payload[ category ] ).forEach( ( key ) => {
						// Preserve VideoCustomCSSTemplate if custom_css is empty
						if ( category === 'video_player' && key === 'custom_css' && ! action.payload[ category ][ key ]?.trim() ) {
							settings[ key ] = initialState.settings.video_player.custom_css;
						} else {
							settings[ key ] = action.payload[ category ][ key ];
						}
					} );
					state.settings[ category ] = settings;
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

// Export actions for use in components
export const { setMediaSettings, updateMediaSetting, resetChanges } = mediaSettingsSlice.actions;

// Selector to get media settings for a specific category
export const selectMediaSettings = ( category ) => ( state ) => state.mediaSettings.settings[ category ] || initialState.settings[ category ];

// Selector to check if settings have changed for a category
export const selectHasChanges = ( category ) => ( state ) => state.mediaSettings.isChanged[ category ];

// Export the reducer to be used in the store
export default mediaSettingsSlice.reducer;
