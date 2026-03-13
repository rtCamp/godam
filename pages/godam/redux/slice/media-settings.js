/**
 * External dependencies
 */
import { createSlice } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import { VideoCustomCSSTemplate } from '../../components/VideoCustomCSSTemplate';
import { generalAPI } from '../api/media-settings';

const initialState = {
	video: {
		sync_from_godam: false,
		adaptive_bitrate: false,
		optimize_videos: false,
		video_format: 'auto',
		video_quality: [],
		video_compress_quality: 100,
		video_thumbnails: 5,
		watermark: false,
		use_watermark_image: false,
		watermark_text: '',
		watermark_url: '',
		watermark_image_id: null,
		enable_global_video_engagement: true,
		enable_global_video_share: true,
	},
	general: {
		enable_folder_organization: true,
		enable_gtm_tracking: false,
		enable_posthog_tracking: false,
		posthog_initialized: false,
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
	integrations: {
		woocommerce: {
			videoCloseBg: 'rgba(28, 28, 28, 0.4)',
			videoCloseIcon: 'rgba(255, 255, 255, 1)',
			videoCloseBorder: {
				width: '0.59px',
				style: 'solid',
				color: 'rgba(224, 224, 224, 1)',
			},
			videoCloseRadius: 45.13,

			miniCartBg: 'rgba(255, 255, 255, 1)',
			miniCartIcon: 'rgba(28, 28, 28, 1)',
			miniCartBorder: {
				width: '1.38px',
				style: 'solid',
				color: 'rgba(224, 224, 224, 1)',
			},
			miniCartRadius: 11,

			addToCartFontSize: 14,
			addToCartBgColor: 'rgba(28, 28, 28, 1)',
			addToCartFontColor: 'rgba(255, 255, 255, 1)',
			addToCartBorder: {
				width: '1px',
				style: 'solid',
				color: 'rgba(28, 28, 28, 1)',
			},
			addToCartRadius: 8,

			toggleFontSize: 16,
			toggleBgColor: 'rgba(0, 0, 0, 0.7)',
			toggleFontColor: 'rgba(255, 255, 255, 1)',
			toggleBorder: {
				width: '0.59px',
				style: 'solid',
				color: 'rgba(224, 224, 224, 1)',
			},
			toggleRadius: 40,

			desktopModalBgColor: 'rgba( 255, 255, 255, 1 )',
			desktopModalTextColor: 'rgba( 28, 28, 28, 1 )',
			mobileModalBgColor: 'rgba( 0, 0, 0, 0.7 )',
			mobileModalTextColor: 'rgba( 255, 255, 255, 1 )',

			desktopPricePrimaryColor: 'rgba( 28, 28, 28, 1 )',
			desktopPriceSecondaryColor: 'rgba(230, 134, 0, 1)',
			desktopPriceTertiaryColor: 'rgba(143, 143, 143, 1)',

			mobilePricePrimaryColor: 'rgba( 255, 255, 255, 1 )',
			mobilePriceSecondaryColor: 'rgba(230, 134, 0, 1)',
			mobilePriceTertiaryColor: 'rgba(143, 143, 143, 1)',

			additionalComponentsColor: 'rgba(95, 95, 95, 1)',
		},
	},
	isChanged: false,
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
							// Check if the value is actually different
							if ( state[ category ][ key ] !== action.payload[ category ][ key ] ) {
								state[ category ][ key ] = action.payload[ category ][ key ];
								state.isChanged = true; // Mark as changed
							}
						}
					} );
				}
			} );
		},

		// Updates a specific setting dynamically
		updateMediaSetting: ( state, action ) => {
			const { category, subCategory, key, value } = action.payload; // e.g., { category: 'video', subCategory: 'woocommerce' key: 'video_format', value: 'mp4' }

			if ( state[ category ] && key in state[ category ] ) {
				// Only update isChanged if the value is different
				if ( state[ category ][ key ] !== value ) {
					state[ category ][ key ] = value;
					state.isChanged = true; // Mark as changed
				}
			}

			if ( state[ category ] && subCategory ) {
				if ( state[ category ][ subCategory ] && state[ category ][ subCategory ][ key ] !== value ) {
					state[ category ][ subCategory ][ key ] = value;
					state.isChanged = true;
				}
			}
		},

		// Reset isChanged flag after successful save
		resetChangeFlag: ( state ) => {
			state.isChanged = false;
		},
	},
	extraReducers: ( builder ) => {
		builder.addMatcher(
			generalAPI.endpoints.getMediaSettings.matchFulfilled,
			( state, action ) => {
				// Update settings and ensure isChanged is false on initial load
				Object.keys( action.payload ).forEach( ( category ) => {
					if ( state[ category ] ) {
						Object.keys( action.payload[ category ] ).forEach( ( key ) => {
							if ( key in state[ category ] ) {
								state[ category ][ key ] = action.payload[ category ][ key ];
							}
						} );
					}
				} );
				state.isChanged = false; // Ensure isChanged is false after loading
			},
		);
	},
} );

// Export the actions to be used in components
export const { setMediaSettings, updateMediaSetting, resetChangeFlag } = mediaSettingsSlice.actions;

// Export the reducer to be used in the store
export default mediaSettingsSlice.reducer;
