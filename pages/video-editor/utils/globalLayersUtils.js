/**
 * External dependencies
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * Map form plugin names to video editor form types
 */
const FORM_PLUGIN_MAP = {
	'wpforms': 'wpforms',
	'gravity_forms': 'gravity',
	'contact_form_7': 'cf7',
	'sureforms': 'sureforms',
	'forminator': 'forminator',
	'fluent_forms': 'fluentforms',
	'everest-forms': 'everest',
	'ninja_forms': 'ninja',
	'metform': 'metform',
};

/**
 * Map placement values from global settings to display times
 */
const getDisplayTimeFromPlacement = (placement, position, duration) => {
	switch (placement) {
		case 'start':
			return 0;
		case 'middle':
			return position || Math.floor(duration / 2);
		case 'end':
			return Math.max(0, (duration || 60) - 10); // 10 seconds before end
		default:
			return 0;
	}
};

/**
 * Convert global layer settings to video editor layer format
 */
export const createLayerFromGlobalSettings = (globalLayer, layerType, videoDuration = 0) => {
	const baseLayer = {
		id: uuidv4(),
		type: layerType,
		isGlobalLayer: true, // Mark as global layer for identification
	};

	switch (layerType) {
		case 'form':
			if (!globalLayer.forms?.enabled || !globalLayer.forms?.plugin || !globalLayer.forms?.form_id) {
				return null;
			}

			return {
				...baseLayer,
				displayTime: getDisplayTimeFromPlacement(
					globalLayer.forms.placement,
					globalLayer.forms.position,
					videoDuration
				),
				form_type: FORM_PLUGIN_MAP[globalLayer.forms.plugin] || 'gravity',
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
			if (!globalLayer.cta?.enabled || !globalLayer.cta?.text) {
				return null;
			}

			return {
				...baseLayer,
				displayTime: getDisplayTimeFromPlacement(
					globalLayer.cta.placement,
					globalLayer.cta.position,
					videoDuration
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

		case 'video_ads':
			if (!globalLayer.video_ads?.enabled || !globalLayer.video_ads?.adTagUrl) {
				return null;
			}

			return {
				...baseLayer,
				type: 'ad',
				displayTime: getDisplayTimeFromPlacement(
					globalLayer.video_ads.placement,
					globalLayer.video_ads.position,
					videoDuration
				),
				adTagUrl: globalLayer.video_ads.adTagUrl,
				duration: globalLayer.video_ads.duration || 30,
				skippable: true,
				skip_offset: 5,
			};

		case 'hotspot':
			if (!globalLayer.hotspots?.enabled || !globalLayer.hotspots?.hotspots?.length) {
				return null;
			}

			return {
				...baseLayer,
				displayTime: getDisplayTimeFromPlacement(
					globalLayer.hotspots.placement,
					0,
					videoDuration
				),
				duration: 5,
				pauseOnHover: false,
				hotspots: globalLayer.hotspots.hotspots.map(hotspot => ({
					id: uuidv4(),
					tooltipText: hotspot.text || 'Click me!',
					position: { x: hotspot.x || 50, y: hotspot.y || 50 },
					size: { diameter: hotspot.size || 48 },
					oSize: { diameter: hotspot.size || 48 },
					oPosition: { x: hotspot.x || 50, y: hotspot.y || 50 },
					link: hotspot.link || '',
					backgroundColor: globalLayer.hotspots.default_color || '#ff0000',
					showStyle: false,
					showIcon: false,
					icon: '',
				})),
			};

		case 'poll':
			if (!globalLayer.polls?.enabled || !globalLayer.polls?.poll_id) {
				return null;
			}

			return {
				...baseLayer,
				displayTime: getDisplayTimeFromPlacement(
					globalLayer.polls.placement,
					globalLayer.polls.position,
					videoDuration
				),
				poll_id: globalLayer.polls.poll_id,
				allow_skip: true,
				custom_css: globalLayer.polls.custom_css || '',
				// Additional poll properties from global settings
				duration: globalLayer.polls.duration || 15,
				screen_position: globalLayer.polls.screen_position || 'center',
				show_results_default: globalLayer.polls.show_results_default !== false,
				background_color: globalLayer.polls.background_color || '#ffffff',
				text_color: globalLayer.polls.text_color || '#000000',
			};

		default:
			return null;
	}
};

/**
 * Apply global settings to create initial layers for a video
 */
export const applyGlobalLayersToVideo = (globalSettings, videoDuration = 0) => {
	if (!globalSettings?.global_layers) {
		return [];
	}

	const globalLayers = globalSettings.global_layers;
	const layersToAdd = [];

	// Add form layer if enabled
	const formLayer = createLayerFromGlobalSettings(globalLayers, 'form', videoDuration);
	if (formLayer) {
		layersToAdd.push(formLayer);
	}

	// Add CTA layer if enabled
	const ctaLayer = createLayerFromGlobalSettings(globalLayers, 'cta', videoDuration);
	if (ctaLayer) {
		layersToAdd.push(ctaLayer);
	}

	// Add video ads layer if enabled
	const adLayer = createLayerFromGlobalSettings(globalLayers, 'video_ads', videoDuration);
	if (adLayer) {
		layersToAdd.push(adLayer);
	}

	// Add hotspots layer if enabled
	const hotspotsLayer = createLayerFromGlobalSettings(globalLayers, 'hotspot', videoDuration);
	if (hotspotsLayer) {
		layersToAdd.push(hotspotsLayer);
	}

	// Add polls layer if enabled
	const pollsLayer = createLayerFromGlobalSettings(globalLayers, 'poll', videoDuration);
	if (pollsLayer) {
		layersToAdd.push(pollsLayer);
	}

	return layersToAdd;
};

/**
 * Check if a layer is a global layer
 */
export const isGlobalLayer = (layer) => {
	return layer?.isGlobalLayer === true;
};

/**
 * Remove global layers from existing layers array
 */
export const removeGlobalLayers = (layers) => {
	return layers.filter(layer => !isGlobalLayer(layer));
};

/**
 * Merge global layers with existing video layers
 */
export const mergeGlobalAndVideoLayers = (existingLayers, globalLayers) => {
	// Remove any existing global layers first
	const videoOnlyLayers = removeGlobalLayers(existingLayers);
	
	// Add new global layers
	return [...videoOnlyLayers, ...globalLayers];
};
