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
		// Set media settings, merging with existing settings
		setMediaSettings: ( state, action ) => {
			const payload = action.payload || {};
			// Merge directly with current settings
			const mergedSettings = { ...state.settings };
			Object.entries( payload ).forEach( ( [ category, payloadSettings ] ) => {
				if ( state.settings[ category ] ) {
					mergedSettings[ category ] = {
						...state.settings[ category ],
						...payloadSettings,
						...( category === 'video_player' && ( ! payloadSettings.custom_css?.trim() )
							? { custom_css: initialState.settings.video_player.custom_css }
							: {} ),
					};
					state.isChanged[ category ] = false;
				}
			} );
			state.settings = mergedSettings;
		},
		// Update a specific media setting
		updateMediaSetting: ( state, action ) => {
			const { category, key, value } = action.payload;
			if ( state.settings[ category ] && key in state.settings[ category ] ) {
				state.settings[ category ][ key ] = value;
				state.isChanged[ category ] = true;
			}
		},
		// Reset changes for a specific category
		resetChanges: ( state, action ) => {
			const { category } = action.payload;
			if ( state.isChanged[ category ] !== undefined ) {
				state.isChanged[ category ] = false;
			}
		},
		//  Reset all changes for all categories
		resetAllChanges: ( state ) => {
			Object.keys( state.isChanged ).forEach( ( category ) => {
				state.isChanged[ category ] = false;
			} );
		},
	},
} );

// Export actions for use in components
export const { setMediaSettings, updateMediaSetting, resetChanges, resetAllChanges } = mediaSettingsSlice.actions;

// Selector to get media settings for a specific category
export const selectMediaSettings = ( category ) => ( state ) => state.mediaSettings.settings[ category ] || initialState.settings[ category ];

// Selector to check if settings have changed for a category
export const selectHasChanges = ( category ) => ( state ) => state.mediaSettings.isChanged[ category ];

// Export the reducer to be used in the store
export default mediaSettingsSlice.reducer;
