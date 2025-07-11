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
		sync_from_godam: false,
		adaptive_bitrate: false,
		optimize_videos: false,
		video_format: 'auto',
		video_quality: [],
		video_compress_quality: 100,
		video_thumbnails: 5,
		overwrite_thumbnails: false,
		watermark: false,
		use_watermark_image: false,
		watermark_text: '',
		watermark_url: '',
		watermark_image_id: null,
		video_slug: 'videos',
	},
	general: {
		enable_folder_organization: true,
	},
	video_player: {
		brand_image: '',
		brand_color: '#2B333FB3',
		brand_image_id: null,
		custom_css: VideoCustomCSSTemplate,
		player_skin: 'Default',
	},
	ads_settings: {
		enable_global_video_ads: false,
		adTagUrl: '',
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
