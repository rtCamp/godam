/**
 * External dependencies
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * Map form plugin names to video editor form types
 */
const FORM_PLUGIN_MAP = {
	wpforms: 'wpforms',
	gravity_forms: 'gravity',
	contact_form_7: 'cf7',
	sureforms: 'sureforms',
	forminator: 'forminator',
	fluent_forms: 'fluentforms',
	'everest-forms': 'everest',
	ninja_forms: 'ninja',
	metform: 'metform',
};

/**
 * Map placement values from global settings to display times
 *
 * @param {string} placement
 * @param {number} position
 * @param {number} duration
 */
const getDisplayTimeFromPlacement = ( placement, position, duration ) => {
	switch ( placement ) {
		case 'start':
			return 0;
		case 'middle':
			return position || Math.floor( duration / 2 );
		case 'end':
			return Math.max( 0, ( duration || 60 ) - 10 ); // 10 seconds before end
		default:
			return 0;
	}
};

/**
 * Convert global layer settings to video editor layer format
 *
 * @param {Object} globalLayer
 * @param {string} layerType
 * @param {number} videoDuration
 */
export const createLayerFromGlobalSettings = ( globalLayer, layerType, videoDuration = 0 ) => {
	const baseLayer = {
		id: uuidv4(),
		type: layerType,
		isGlobalLayer: true, // Mark as global layer for identification
	};

	switch ( layerType ) {
		case 'form':
			if ( ! globalLayer.forms?.enabled || ! globalLayer.forms?.plugin || ! globalLayer.forms?.form_id ) {
				return null;
			}

			return {
				...baseLayer,
				displayTime: getDisplayTimeFromPlacement(
					globalLayer.forms.placement,
					globalLayer.forms.position,
					videoDuration,
				),
				form_type: FORM_PLUGIN_MAP[ globalLayer.forms.plugin ] || 'gravity',
				form_id: globalLayer.forms.form_id,
				duration: globalLayer.forms.duration || 0,
				submitted: false,
				allow_skip: true,
				custom_css: globalLayer.forms.custom_css || '',
				theme: globalLayer.forms.theme || '',
				// Additional form properties from global settings
				screen_position: globalLayer.forms.screen_position || 'center',
				overlay_color: globalLayer.forms.overlay_color || 'rgba(0,0,0,0.8)',
				show_close_button: globalLayer.forms.show_close_button !== false,
			};

		case 'cta':
			if ( ! globalLayer.cta?.enabled || ! globalLayer.cta?.text ) {
				return null;
			}

			return {
				...baseLayer,
				displayTime: getDisplayTimeFromPlacement(
					globalLayer.cta.placement,
					globalLayer.cta.position,
					videoDuration,
				),
				cta_type: 'text',
				text: globalLayer.cta.text,
				html: '',
				link: globalLayer.cta.url || '',
				allow_skip: true,
				imageOpacity: 1,
				// Additional CTA properties from global settings
				new_tab: globalLayer.cta.new_tab !== false,
				duration: globalLayer.cta.duration || 10,
				screen_position: globalLayer.cta.screen_position || 'bottom-center',
				background_color: globalLayer.cta.background_color || '#0073aa',
				text_color: globalLayer.cta.text_color || '#ffffff',
				font_size: globalLayer.cta.font_size || 16,
				border_radius: globalLayer.cta.border_radius || 4,
				css_classes: globalLayer.cta.css_classes || '',
			};

		default:
			return null;
	}
};

/**
 * Apply global settings to create initial layers for a video
 *
 * @param {Object} globalSettings
 * @param {number} videoDuration
 */
export const applyGlobalLayersToVideo = ( globalSettings, videoDuration = 0 ) => {
	if ( ! globalSettings?.global_layers ) {
		return [];
	}

	const globalLayers = globalSettings.global_layers;
	const layersToAdd = [];

	// Add form layer if enabled
	const formLayer = createLayerFromGlobalSettings( globalLayers, 'form', videoDuration );
	if ( formLayer ) {
		layersToAdd.push( formLayer );
	}

	// Add CTA layer if enabled
	const ctaLayer = createLayerFromGlobalSettings( globalLayers, 'cta', videoDuration );
	if ( ctaLayer ) {
		layersToAdd.push( ctaLayer );
	}

	return layersToAdd;
};

/**
 * Check if a layer is a global layer
 *
 * @param {Object} layer
 */
export const isGlobalLayer = ( layer ) => {
	return layer?.isGlobalLayer === true;
};

/**
 * Remove global layers from existing layers array
 *
 * @param {Array} layers
 */
export const removeGlobalLayers = ( layers ) => {
	return layers.filter( ( layer ) => ! isGlobalLayer( layer ) );
};

/**
 * Merge global layers with existing video layers
 *
 * @param {Array} existingLayers
 * @param {Array} globalLayers
 */
export const mergeGlobalAndVideoLayers = ( existingLayers, globalLayers ) => {
	// Remove any existing global layers first
	const videoOnlyLayers = removeGlobalLayers( existingLayers );

	// Add new global layers
	return [ ...videoOnlyLayers, ...globalLayers ];
};
