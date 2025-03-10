/**
 * External dependencies
 */
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
	video: {
		adaptive_bitrate: false,
		video_quality: [],
		video_thumbnails: 5,
		overwrite_thumbnails: false,
		watermark: false,
		use_watermark_image: false,
		watermark_text: '',
		watermark_url: '',
	},
	general: {
		is_verified: false,
		disable_folder_organization: false,
	},
};

const mediaSettingsSlice = createSlice( {
	name: 'mediaSettings',
	initialState,
	reducers: {
		// Sets the entire media settings (useful when loading from API)
		setMediaSettings: ( state, action ) => {
			return { ...state, ...action.payload };
		},

		// Updates a specific setting dynamically
		updateMediaSetting: ( state, action ) => {
			const { category, key, value } = action.payload; // e.g., { category: 'video', key: 'video_format', value: 'mp4' }

			if ( state[ category ] && key in state[ category ] ) {
				state[ category ][ key ] = value;
			}
		},
	},
} );

export const { setMediaSettings, updateMediaSetting } = mediaSettingsSlice.actions;
export default mediaSettingsSlice.reducer;
