/**
 * External dependencies
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * GlobalLayersManager class for handling global video layer management
 */
class GlobalLayersManager {
	/**
	 * Constants
	 */
	static GLOBAL_LAYER_PREFIX = 'global_';
	static GLOBAL_LAYER_TIMESTAMP_SEPARATOR = '_';

	/**
	 * Placement constants
	 */
	static PLACEMENT_START = 'start';
	static PLACEMENT_MIDDLE = 'middle';
	static PLACEMENT_END = 'end';

	/**
	 * Layer type constants
	 */
	static LAYER_TYPE_CTA = 'cta';
	static LAYER_TYPE_FORM = 'form';

	/**
	 * CTA type constants
	 */
	static CTA_TYPE_TEXT = 'text';
	static CTA_TYPE_HTML = 'html';
	static CTA_TYPE_IMAGE = 'image';

	/**
	 * Map form plugin names to video editor form types
	 *
	 * TODO: I guess this map is not necessary now, so consider removing it.
	 */
	static FORM_PLUGIN_MAP = {
		wpforms: 'wpforms',
		gravity_forms: 'gravity',
		contact_form_7: 'cf7',
		sure_forms: 'sureforms',
		forminator: 'forminator',
		fluent_forms: 'fluentforms',
		everest_forms: 'everestforms',
		ninja_forms: 'ninjaforms',
		metform: 'metform',
	};

	/**
	 * Default values for different layer types
	 */
	static defaults = {
		cta: {
			text: '',
			html: '',
			image: 0,
			imageText: '',
			imageLink: '',
			imageDescription: '',
			imageCtaOrientation: 'landscape',
			imageCtaButtonText: 'Buy Now',
		},
		form: {
			form_id: '',
			duration: 0,
			submitted: false,
			allow_skip: true,
			custom_css: '',
			theme: '',
			screen_position: 'center',
			overlay_color: 'rgba(0,0,0,0.8)',
			show_close_button: true,
		},
	};

	/**
	 * Constructor
	 *
	 * @param {Object} globalSettings - Global settings object
	 * @param {number} videoDuration  - Video duration in seconds
	 */
	constructor( globalSettings, videoDuration = 0 ) {
		this.globalSettings = globalSettings;
		this.videoDuration = videoDuration;
	}

	/**
	 * Generate a unique ID for global layers
	 *
	 * @param {string} layerType - Type of layer (form, cta, etc.)
	 * @return {string} Unique global layer ID
	 */
	generateGlobalLayerId( layerType ) {
		const timestamp = Date.now();
		const uuid = uuidv4();
		return `${ GlobalLayersManager.GLOBAL_LAYER_PREFIX }${ layerType }${ GlobalLayersManager.GLOBAL_LAYER_TIMESTAMP_SEPARATOR }${ timestamp }${ GlobalLayersManager.GLOBAL_LAYER_TIMESTAMP_SEPARATOR }${ uuid }`;
	}

	/**
	 * Map placement values from global settings to display times
	 *
	 * @param {string} placement - Placement setting (start, middle, end)
	 * @param {number} position  - Custom position in seconds
	 * @return {number} Display time in seconds
	 */
	getDisplayTimeFromPlacement( placement, position ) {
		switch ( placement ) {
			case GlobalLayersManager.PLACEMENT_START:
				return 0;
			case GlobalLayersManager.PLACEMENT_MIDDLE:
				return Math.floor( position || Math.floor( this.videoDuration / 2 ) );
			case GlobalLayersManager.PLACEMENT_END:
				return Math.max( 0, ( Math.round( this.videoDuration || 60 ) ) );
			default:
				return Math.floor( position || 0 );
		}
	}

	/**
	 * Create base layer object with global layer metadata
	 *
	 * @param {string} layerType - Type of layer
	 * @param {Object} metadata  - Additional metadata
	 * @return {Object} Base layer object
	 */
	createBaseGlobalLayer( layerType, metadata = {} ) {
		return {
			id: this.generateGlobalLayerId( layerType ),
			type: layerType,
			isGlobalLayer: true,
			globalLayerSource: 'global_settings',
			globalLayerCreatedAt: Date.now(),
			...metadata,
		};
	}

	/**
	 * Create CTA layer based on configuration
	 *
	 * @param {Object} ctaConfig - CTA layer configuration
	 * @return {Object|null} CTA layer data or null if disabled
	 */
	createCtaLayer( ctaConfig ) {
		if ( ! ctaConfig?.enabled || ! ctaConfig?.text ) {
			return null;
		}

		const ctaType = ctaConfig.cta_type || GlobalLayersManager.CTA_TYPE_TEXT;
		const placement = ctaConfig.placement || GlobalLayersManager.PLACEMENT_START;

		const baseLayer = this.createBaseGlobalLayer( GlobalLayersManager.LAYER_TYPE_CTA, {
			globalLayerConfig: ctaConfig,
		} );

		const layer = {
			...baseLayer,
			displayTime: this.getDisplayTimeFromPlacement( placement, ctaConfig.position ),
			cta_type: ctaType,
			allow_skip: true,
			imageOpacity: 1,
		};

		return this.buildCtaLayerByType( layer, ctaType, ctaConfig );
	}

	/**
	 * Build CTA layer data based on type
	 *
	 * @param {Object} baseLayer - Base layer configuration
	 * @param {string} ctaType   - CTA type
	 * @param {Object} ctaConfig - CTA configuration
	 * @return {Object} Complete CTA layer data
	 */
	buildCtaLayerByType( baseLayer, ctaType, ctaConfig ) {
		const defaults = GlobalLayersManager.defaults.cta;

		switch ( ctaType ) {
			case GlobalLayersManager.CTA_TYPE_TEXT:
				return {
					...baseLayer,
					text: ctaConfig.text || defaults.text,
				};

			case GlobalLayersManager.CTA_TYPE_HTML:
				return {
					...baseLayer,
					html: ctaConfig.html || defaults.html,
				};

			case GlobalLayersManager.CTA_TYPE_IMAGE:
				return {
					...baseLayer,
					image: ctaConfig.image || defaults.image,
					imageText: ctaConfig.imageText || defaults.imageText,
					imageLink: ctaConfig.imageLink || defaults.imageLink,
					imageDescription: ctaConfig.imageDescription || defaults.imageDescription,
					imageCtaOrientation: ctaConfig.imageCtaOrientation || defaults.imageCtaOrientation,
					imageCtaButtonText: ctaConfig.imageCtaButtonText || defaults.imageCtaButtonText,
				};

			default:
				return baseLayer;
		}
	}

	/**
	 * Create form layer based on configuration
	 *
	 * @param {Object} formConfig - Form layer configuration
	 * @return {Object|null} Form layer data or null if disabled
	 */
	createFormLayer( formConfig ) {
		if ( ! formConfig?.enabled || ! formConfig?.plugin || ! formConfig?.form_id ) {
			return null;
		}

		const placement = formConfig.placement || GlobalLayersManager.PLACEMENT_START;
		const formType = GlobalLayersManager.FORM_PLUGIN_MAP[ formConfig.plugin ] || 'gravity';

		const baseLayer = this.createBaseGlobalLayer( GlobalLayersManager.LAYER_TYPE_FORM, {
			globalLayerConfig: formConfig,
		} );

		const layer = {
			...baseLayer,
			displayTime: this.getDisplayTimeFromPlacement( placement, formConfig.position ),
			form_type: formType,
		};

		return this.buildFormLayerByType( layer, formType, formConfig );
	}

	/**
	 * Build form layer data based on type
	 *
	 * @param {Object} baseLayer  - Base layer configuration
	 * @param {string} formType   - Form type
	 * @param {Object} formConfig - Form configuration
	 * @return {Object} Complete form layer data
	 */
	buildFormLayerByType( baseLayer, formType, formConfig ) {
		const defaults = GlobalLayersManager.defaults.form;

		// Common form properties
		const commonProps = {
			form_id: formConfig.form_id,
			duration: formConfig.duration || defaults.duration,
			submitted: defaults.submitted,
			allow_skip: defaults.allow_skip,
			custom_css: formConfig.custom_css || defaults.custom_css,
			theme: formConfig.theme || defaults.theme,
			screen_position: formConfig.screen_position || defaults.screen_position,
			overlay_color: formConfig.overlay_color || defaults.overlay_color,
			show_close_button: formConfig.show_close_button !== false,
		};

		switch ( formType ) {
			case 'gravity':
				return {
					...baseLayer,
					...commonProps,
					gf_id: formConfig.form_id,
				};

			case 'wpforms':
				return {
					...baseLayer,
					...commonProps,
					wpform_id: formConfig.form_id,
				};

			case 'cf7':
				return {
					...baseLayer,
					...commonProps,
					cf7_id: formConfig.form_id,
				};
			case 'sureforms':
				return {
					...baseLayer,
					...commonProps,
					sureform_id: formConfig.form_id,
				};
			case 'forminator':
				return {
					...baseLayer,
					...commonProps,
					forminator_id: formConfig.form_id,
				};
			case 'everestforms':
				return {
					...baseLayer,
					...commonProps,
					everest_form_id: formConfig.form_id,
				};
			case 'fluentforms':
				return {
					...baseLayer,
					...commonProps,
					fluent_form_id: formConfig.form_id,
				};
			case 'ninjaforms':
				return {
					...baseLayer,
					...commonProps,
					ninja_form_id: formConfig.form_id,
				};
			case 'metform':
				return {
					...baseLayer,
					...commonProps,
					metform_id: formConfig.form_id,
				};

			default:
				return {
					...baseLayer,
					...commonProps,
				};
		}
	}

	/**
	 * Get merged layers with existing video layers
	 *
	 * @param {Array} existingLayers - Existing video layers
	 * @return {Array} Merged layers array
	 */
	getMergedLayers( existingLayers ) {
		if ( ! Array.isArray( existingLayers ) ) {
			existingLayers = [];
		}

		// Get existing global layers and check what types are already present or disabled
		const existingGlobalInfo = this.getExistingGlobalLayersInfo( existingLayers );

		// Prepare a copy of existingLayers to filter out replaced global layers
		let mergedLayers = Array.isArray( existingLayers ) ? [ ...existingLayers ] : [];

		// Replace global form layer if present and not disabled
		if ( this.globalSettings?.global_layers?.forms ) {
			// Always remove existing global form layers first
			mergedLayers = mergedLayers.filter(
				( layer ) => ! ( GlobalLayersManager.isGlobalLayer( layer ) && layer.type === 'form' ),
			);

			const newFormLayer = this.createFormLayer( this.globalSettings.global_layers.forms );
			if ( newFormLayer ) {
				if ( existingGlobalInfo.form && existingGlobalInfo.form.disabled ) {
					newFormLayer.isDisabled = true;
				}

				mergedLayers.push( newFormLayer );
			}
		}

		// Replace global CTA layer if present and not disabled
		if ( this.globalSettings?.global_layers?.cta ) {
			// Always remove existing global form layers first
			mergedLayers = mergedLayers.filter(
				( layer ) => ! ( GlobalLayersManager.isGlobalLayer( layer ) && layer.type === 'cta' ),
			);

			const newCtaLayer = this.createCtaLayer( this.globalSettings.global_layers.cta );
			if ( newCtaLayer ) {
				if ( existingGlobalInfo?.cta && existingGlobalInfo?.cta?.disabled ) {
					newCtaLayer.isDisabled = true;
				}
				mergedLayers.push( newCtaLayer );
			}
		}

		return mergedLayers;
	}

	/**
	 * Get information about existing global layers
	 *
	 * @param {Array} layers - Array of layers to analyze
	 * @return {Object} Object with info about existing global layers by type
	 */
	getExistingGlobalLayersInfo( layers ) {
		const info = {};

		layers.forEach( ( layer ) => {
			if ( ! layer?.type ) {
				return;
			}

			const isGlobal = GlobalLayersManager.isGlobalLayer( layer );
			const isDisabled = layer.isDisabled === true;
			const hasGlobalMetadata = layer.globalLayerSource || layer.globalLayerConfig;

			// Track global layers or disabled layers with global characteristics
			if ( isGlobal || ( isDisabled && hasGlobalMetadata ) ) {
				info[ layer.type ] = {
					exists: true,
					disabled: isDisabled,
					layer,
				};
			}
		} );

		return info;
	}

	/**
	 * Check if a layer is a global layer (enhanced version)
	 *
	 * @param {Object} layer - Layer object to check
	 * @return {boolean} True if it's a global layer
	 */
	static isGlobalLayer( layer ) {
		if ( ! layer ) {
			return false;
		}

		// Check multiple indicators for backwards compatibility
		return (
			layer?.isGlobalLayer === true ||
			GlobalLayersManager.isGlobalLayerId( layer?.id ) ||
			layer?.globalLayerSource === 'global_settings'
		);
	}

	/**
	 * Check if a layer ID indicates it's a global layer
	 *
	 * @param {string} layerId - Layer ID to check
	 * @return {boolean} True if it's a global layer ID
	 */
	static isGlobalLayerId( layerId ) {
		return typeof layerId === 'string' && layerId.startsWith( GlobalLayersManager.GLOBAL_LAYER_PREFIX );
	}

	/**
	 * Remove global layers from existing layers array
	 *
	 * @param {Array} layers - Array of layers
	 * @return {Array} Video-only layers
	 */
	removeGlobalLayers( layers ) {
		return this.filterLayersByGlobalStatus( layers, false );
	}

	/**
	 * Get only global layers from existing layers array
	 *
	 * @param {Array} layers - Array of layers
	 * @return {Array} Global-only layers
	 */
	getGlobalLayers( layers ) {
		return this.filterLayersByGlobalStatus( layers, true );
	}

	/**
	 * Filter layers by global status
	 *
	 * @param {Array}   layers   - Array of layers
	 * @param {boolean} isGlobal - True to get global layers, false for video layers
	 * @return {Array} Filtered layers
	 */
	filterLayersByGlobalStatus( layers, isGlobal = true ) {
		if ( ! Array.isArray( layers ) ) {
			return [];
		}

		return layers.filter( ( layer ) => GlobalLayersManager.isGlobalLayer( layer ) === isGlobal );
	}

	/**
	 * Get global layer metadata
	 *
	 * @param {Object} layer - Layer object
	 * @return {Object|null} Global layer metadata or null
	 */
	static getGlobalLayerMetadata( layer ) {
		if ( ! GlobalLayersManager.isGlobalLayer( layer ) ) {
			return null;
		}

		return {
			isGlobal: true,
			source: layer.globalLayerSource || 'global_settings',
			createdAt: layer.globalLayerCreatedAt || null,
			config: layer.globalLayerConfig || null,
			id: layer.id,
			type: layer.type,
		};
	}

	/**
	 * Get default configuration for a layer type
	 *
	 * @param {string} layerType - Layer type
	 * @return {Object} Default configuration
	 */
	static getDefaultConfig( layerType ) {
		return GlobalLayersManager.defaults[ layerType ] || {};
	}
}

export default GlobalLayersManager;

