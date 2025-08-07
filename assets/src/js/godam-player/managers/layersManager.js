/**
 * Internal dependencies
 */
import { LAYER_TYPES } from '../utils/constants.js';
import LayerValidator from './layers/layerValidator.js';
import FormLayerManager from './layers/formLayerManager.js';
import HotspotLayerManager from './layers/hotspotLayerManager.js';

import { getForms as getHubSpotForms, createFormElement as createHubSpotFormElement } from '../hubspot-forms.js';

/**
 * Layers Manager
 * Orchestrates form and hotspot layers functionality
 */
export default class LayersManager {
	constructor( player, video, config, isDisplayingLayers, currentPlayerVideoInstanceId ) {
		this.player = player;
		this.video = video;
		this.config = config;
		this.isDisplayingLayers = isDisplayingLayers;
		this.currentPlayerVideoInstanceId = currentPlayerVideoInstanceId;

		// Initialize sub-managers
		this.formLayerManager = new FormLayerManager( player, isDisplayingLayers, currentPlayerVideoInstanceId );
		this.hotspotLayerManager = new HotspotLayerManager( player );
	}

	/**
	 * Setup layers
	 */
	async setupLayers() {
		const layers = this.config.videoSetupOptions?.layers || [];

		await getHubSpotForms( this.video.dataset.id ).then( ( godamCentralLayers ) => {
			godamCentralLayers.forEach( ( layer ) => {
				const existingLayerElement = document.querySelector( `#layer-${ this.video.dataset.instanceId }-${ layer.id }` );
				const formElementContainer = this.video.closest( '.godam-video-wrapper' )?.querySelector( '.easydam-video-container' );
				if ( ! existingLayerElement && formElementContainer ) {
					this.createEnternalLayerElement( layer, this.video.dataset.instanceId, formElementContainer );
				}
			} );

			layers.push( ...godamCentralLayers );
		} ).catch( () => {} );

		if ( ! this.config.isPreviewEnabled ) {
			layers.forEach( ( layer ) => this.processLayer( layer ) );
		}

		this.formLayerManager.sortLayers();
		this.isDisplayingLayers[ this.currentPlayerVideoInstanceId ] = false;
	}

	/**
	 * Process individual layer
	 *
	 * @param {Object} layer - Layer configuration object
	 */
	processLayer( layer ) {
		const shouldProcess = LayerValidator.shouldProcessLayer( layer );

		if ( shouldProcess ) {
			this.handleLayerDisplay( layer );
		}
	}

	/**
	 * Handle layer display setup
	 *
	 * @param {Object} layer - Layer configuration object
	 */
	handleLayerDisplay( layer ) {
		const instanceId = this.video.dataset.instanceId;
		const layerId = `layer-${ instanceId }-${ layer.id }`;
		const layerElement = document.querySelector( `#${ layerId }` );

		if ( ! layerElement ) {
			return;
		}

		this.setupLayerEnvironment();
		layerElement.classList.add( 'hidden' );

		if ( LayerValidator.isFormOrCTAOrPoll( layer.type ) ) {
			this.formLayerManager.setupFormLayer( layer, layerElement );
		} else if ( layer.type === LAYER_TYPES.HOTSPOT ) {
			this.hotspotLayerManager.setupHotspotLayer( layer, layerElement );
		}
	}

	/**
	 * Creates a DOM element for a given layer.
	 *
	 * @param {Object}      layer          - The layer object containing details like id, type, and content.
	 * @param {string}      instanceId     - The unique identifier for the player instance.
	 * @param {HTMLElement} videoContainer - The DOM element representing the video container.
	 * @return {HTMLElement} The created layer element.
	 */
	createEnternalLayerElement = ( layer, instanceId, videoContainer ) => {
		const layerId = `layer-${ instanceId }-${ layer.id }`;
		const layerElement = document.createElement( 'div' );
		layerElement.id = layerId;
		layerElement.classList.add( 'godam-layer', `godam-layer-${ layer.type }`, 'hidden' );

		createHubSpotFormElement( layerElement, layer );

		if ( layer.html_content ) {
			layerElement.innerHTML = layer.html_content;
		}

		videoContainer.appendChild( layerElement );
		return layerElement;
	};

	/**
	 * Setup layer environment
	 */
	setupLayerEnvironment() {
		if ( typeof window.wpforms !== 'undefined' ) {
			window.wpforms.scrollToError = () => {};
			window.wpforms.animateScrollTop = () => {};
		}
	}

	/**
	 * Handle form layers time update
	 *
	 * @param {number} currentTime - Current video time in seconds
	 */
	handleFormLayersTimeUpdate( currentTime ) {
		this.formLayerManager.handleFormLayersTimeUpdate( currentTime );
	}

	/**
	 * Handle hotspot layers time update
	 *
	 * @param {number} currentTime - Current video time in seconds
	 */
	handleHotspotLayersTimeUpdate( currentTime ) {
		this.hotspotLayerManager.handleHotspotLayersTimeUpdate( currentTime );
	}

	/**
	 * Handle fullscreen changes for layers
	 */
	handleFullscreenChange() {
		const isFullscreen = this.player.isFullscreen();
		const videoContainer = this.player.el();

		this.formLayerManager.handleFullscreenChange( isFullscreen, videoContainer );
		this.hotspotLayerManager.handleFullscreenChange( isFullscreen, videoContainer );
	}

	/**
	 * Handle play events for layers
	 */
	handlePlay() {
		this.formLayerManager.handlePlay();
	}

	/**
	 * Handle preview state change callback
	 *
	 * @param {boolean} newValue - New preview state value
	 */
	handlePreviewStateChange( newValue ) {
		this.formLayerManager.formLayers.forEach( ( layer ) => {
			if ( ! newValue ) {
				const layerConfig = this.mapLayerToConfig( layer );
				this.handleLayerDisplay( layerConfig );
			}
		} );
	}

	/**
	 * Map a layer object to the expected layer configuration format
	 *
	 * @param {Object} layerObj - Layer object from formLayers
	 * @return {Object} - Layer configuration object
	 */
	mapLayerToConfig( layerObj ) {
		return {
			id: layerObj.id || 'unknown',
			type: layerObj.type || 'form',
			displayTime: layerObj.displayTime,
			allow_skip: layerObj.allowSkip,
			custom_css: layerObj.custom_css,
		};
	}
}
