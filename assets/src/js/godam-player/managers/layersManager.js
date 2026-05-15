/**
 * Internal dependencies
 */
import { LAYER_TYPES } from '../utils/constants.js';
import { getLayerManager } from '../utils/layer-registry.js';
import LayerValidator from './layers/layerValidator.js';
import FormLayerManager from './layers/formLayerManager.js';
import HotspotLayerManager from './layers/hotspotLayerManager.js';
import { loadFontAwesome, hasHotspotsWithIcons } from '../utils/pluginLoader.js';

/**
 * Layers Manager
 * Orchestrates form and hotspot layers functionality
 * Supports dynamically registered layer managers from add-ons
 */
export default class LayersManager {
	constructor( player, video, config, isDisplayingLayers, currentPlayerVideoInstanceId ) {
		this.player = player;
		this.video = video;
		this.config = config;
		this.isDisplayingLayers = isDisplayingLayers;
		this.currentPlayerVideoInstanceId = currentPlayerVideoInstanceId;
		this.customLayerManagers = {}; // Storage for custom manager instances

		// Initialize sub-managers
		this.formLayerManager = new FormLayerManager( player, isDisplayingLayers, currentPlayerVideoInstanceId );
		this.hotspotLayerManager = new HotspotLayerManager( player, isDisplayingLayers, currentPlayerVideoInstanceId );

		/**
		 * Naming convention is bit unusual here to avoid confusion with the main player instance.
		 *
		 * Basically we only need this for the player developer API.
		 * in future if we also need hotspot layer, this can be thought of again.
		 */
		this.player.layersManager = this.formLayerManager;
	}

	/**
	 * Setup layers
	 * Loads FontAwesome dynamically if hotspots with icons exist
	 */
	async setupLayers() {
		const layers = this.config.videoSetupOptions?.layers || [];

		// Check if we need to load FontAwesome for hotspot icons
		if ( hasHotspotsWithIcons( layers ) ) {
			try {
				await loadFontAwesome();
			} catch ( error ) {
				// eslint-disable-next-line no-console
				console.error( 'Failed to load FontAwesome for hotspot icons:', error );
			}
		}

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
		} else {
			// Try to find a custom layer manager registered via the layer registry.
			const customManagerClass = getLayerManager( layer.type );
			if ( customManagerClass && ! this.customLayerManagers[ layer.type ] ) {
				this.customLayerManagers[ layer.type ] = new customManagerClass(
					this.player,
					this.isDisplayingLayers,
					this.currentPlayerVideoInstanceId,
				);
			}

			if ( this.customLayerManagers[ layer.type ] && typeof this.customLayerManagers[ layer.type ].setupLayer === 'function' ) {
				this.customLayerManagers[ layer.type ].setupLayer( layer, layerElement );
			}
		}
	}

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
	 * Handle custom layer time update
	 * Calls timeUpdate on all registered custom layer managers
	 *
	 * @param {number} currentTime - Current video time in seconds
	 */
	handleCustomLayersTimeUpdate( currentTime ) {
		Object.values( this.customLayerManagers ).forEach( ( manager ) => {
			if ( typeof manager.handleTimeUpdate === 'function' ) {
				manager.handleTimeUpdate( currentTime );
			}
		} );
	}

	/**
	 * Handle video resize events
	 */
	handleVideoResize() {
		this.hotspotLayerManager.updateHotspotPositions();

		// Call update methods on custom layer managers if they exist
		Object.values( this.customLayerManagers ).forEach( ( manager ) => {
			if ( typeof manager.handleResize === 'function' ) {
				manager.handleResize();
			}
		} );
	}

	/**
	 * Handle fullscreen changes for layers
	 */
	handleFullscreenChange() {
		const isFullscreen = this.player.isFullscreen();
		const videoContainer = this.player.el();

		this.formLayerManager.handleFullscreenChange( isFullscreen, videoContainer );
		this.hotspotLayerManager.handleFullscreenChange( isFullscreen, videoContainer );

		// Notify custom layer managers about fullscreen changes
		Object.values( this.customLayerManagers ).forEach( ( manager ) => {
			if ( typeof manager.handleFullscreenChange === 'function' ) {
				manager.handleFullscreenChange( isFullscreen, videoContainer );
			}
		} );
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
