/**
 * External dependencies
 */
import { createSlice } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import { VideoCustomCSSTemplate } from '../../components/VideoCustomCSSTemplate';

const initialState = {
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
};

const mediaSettingsSlice = createSlice( {
	name: 'mediaSettings',
	initialState,
	reducers: {
		// Sets the entire media settings (validates allowed keys)
		setMediaSettings: ( state, action ) => {
			Object.keys( action.payload ).forEach( ( category ) => {
				if ( state[ category ] ) {
					Object.keys( action.payload[ category ] ).forEach( ( key ) => {
						if ( key in state[ category ] ) {
							state[ category ][ key ] = action.payload[ category ][ key ];
						}
					} );
				}
			} );
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
