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
		overwrite_thumbnails: false,
		watermark: false,
		use_watermark_image: false,
		watermark_text: '',
		watermark_url: '',
		watermark_image_id: null,
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
	global_layers: {
		video_ads: {
			enabled: false,
			adTagUrl: '',
			placement: 'start',
			position: 30,
			duration: 30,
		},
		forms: {
			enabled: false,
			plugin: '',
			form_id: '',
			placement: 'end',
			position: 30,
			duration: 0,
		},
		cta: {
			enabled: false,
			text: '',
			url: '',
			new_tab: true,
			placement: 'end',
			position: 30,
			screen_position: 'bottom-center',
			duration: 10,
			background_color: '#0073aa',
			text_color: '#ffffff',
			font_size: 16,
			border_radius: 4,
			css_classes: '',
		},
		hotspots: {
			enabled: false,
			default_shape: 'circle',
			default_animation: 'pulse',
			default_color: '#ff0000',
			placement: 'throughout',
			hotspots: [],
		},
		polls: {
			enabled: false,
			placement: 'middle',
			screen_position: 'center',
			default_duration: 15,
			show_results_default: true,
			background_color: '#ffffff',
			text_color: '#000000',
			polls: [],
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
					// Handle nested structures like global_layers
					if ( typeof state[ category ] === 'object' && !Array.isArray( state[ category ] ) ) {
						Object.keys( action.payload[ category ] ).forEach( ( key ) => {
							if ( key in state[ category ] ) {
								// Handle nested subcategories
								if ( typeof state[ category ][ key ] === 'object' && !Array.isArray( state[ category ][ key ] ) ) {
									Object.keys( action.payload[ category ][ key ] ).forEach( ( subKey ) => {
										if ( subKey in state[ category ][ key ] ) {
											if ( state[ category ][ key ][ subKey ] !== action.payload[ category ][ key ][ subKey ] ) {
												state[ category ][ key ][ subKey ] = action.payload[ category ][ key ][ subKey ];
												state.isChanged = true;
											}
										}
									} );
								} else {
									// Handle regular properties
									if ( state[ category ][ key ] !== action.payload[ category ][ key ] ) {
										state[ category ][ key ] = action.payload[ category ][ key ];
										state.isChanged = true;
									}
								}
							}
						} );
					}
				}
			} );
		},

		// Updates a specific setting dynamically
		updateMediaSetting: ( state, action ) => {
			const { category, subcategory, key, value } = action.payload;
			console.log('Redux updateMediaSetting:', { category, subcategory, key, value });
			console.log('Current state before update:', JSON.stringify(state[category]?.[subcategory], null, 2));

			// Ensure the category exists
			if ( ! state[ category ] ) {
				console.log('Creating missing category:', category);
				state[ category ] = {};
			}

			// Handle nested structure for global_layers
			if ( subcategory ) {
				// Ensure the subcategory exists
				if ( ! state[ category ][ subcategory ] ) {
					console.log('Creating missing subcategory:', subcategory);
					state[ category ][ subcategory ] = {};
				}
				
				// Update the specific key
				console.log('Updating nested setting:', { category, subcategory, key, oldValue: state[ category ][ subcategory ][ key ], newValue: value });
				state[ category ][ subcategory ][ key ] = value;
				state.isChanged = true; // Mark as changed
				console.log('State after update:', JSON.stringify(state[category]?.[subcategory], null, 2));
			}
			// Handle regular flat structure
			else if ( state[ category ] && key in state[ category ] ) {
				// Only update isChanged if the value is different
				if ( state[ category ][ key ] !== value ) {
					state[ category ][ key ] = value;
					state.isChanged = true; // Mark as changed
				}
			} else {
				console.log('Unable to update setting:', { category, subcategory, key, value });
				console.log('State category exists:', !!state[ category ]);
				console.log('State subcategory exists:', !!state[ category ]?.[ subcategory ]);
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
						// Handle nested structures like global_layers
						if ( typeof state[ category ] === 'object' && !Array.isArray( state[ category ] ) ) {
							Object.keys( action.payload[ category ] ).forEach( ( key ) => {
								if ( key in state[ category ] ) {
									// Handle nested subcategories
									if ( typeof state[ category ][ key ] === 'object' && !Array.isArray( state[ category ][ key ] ) ) {
										Object.keys( action.payload[ category ][ key ] ).forEach( ( subKey ) => {
											if ( subKey in state[ category ][ key ] ) {
												state[ category ][ key ][ subKey ] = action.payload[ category ][ key ][ subKey ];
											}
										} );
									} else {
										// Handle regular properties
										state[ category ][ key ] = action.payload[ category ][ key ];
									}
								}
							} );
						}
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
