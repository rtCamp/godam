/**
 * Internal dependencies
 */
import { createLayerHost } from '../../godam-layers/runtime/host.js';
import {
	getLayerRuntime,
	shouldMountLayer,
	layersUseIconFont,
	runtimeUsesIconFont,
	logOnce,
	whenLayerRuntime,
	whenLayerRuntimeVariation,
	getLayerRuntimeVariation,
} from '../../godam-layers/runtime/registry.js';
import { getOverlayController } from '../layers/overlay.js';
import { loadFontAwesome } from '../utils/pluginLoader.js';
import { isAutoPause } from './visibilityManager.js';

/**
 * Layers Manager
 *
 * Mounts a video's saved layers through the Layer API runtimes (#2294): each
 * layer's type has a runtime registered with `registerLayerRuntime()` by its
 * view script (core types in `assets/src/layers/<type>/view.js`, add-ons on
 * `window.godam.layers`, older add-ons through `window.godamLayerRegistry`). The manager forwards player events to
 * every mounted layer and never branches on a layer type itself.
 */
export default class LayersManager {
	constructor( player, video, config, isDisplayingLayers, currentPlayerVideoInstanceId ) {
		this.player = player;
		this.video = video;
		this.config = config;
		this.isDisplayingLayers = isDisplayingLayers;
		this.currentPlayerVideoInstanceId = currentPlayerVideoInstanceId;
		this.suppressionCheck = null; // Optional predicate that pauses all layer firing
		this.mountedElements = new WeakSet();

		this.host = createLayerHost( {
			player,
			media: { type: 'video', element: video },
			instanceId: currentPlayerVideoInstanceId,
			isDisplayingLayers,
			isSuppressed: () => this.areLayersSuppressed(),
		} );

		// The public player API (`api/player.js`) reaches the CTA / form / poll
		// layers through `player.layersManager` (replay, dismiss, current layer),
		// and mounts `GoDAMAPI.createLayer()` layers through `player.godamLayers`.
		this.player.layersManager = getOverlayController( this.host ).manager;
		this.player.godamLayers = this.host;
	}

	/**
	 * Setup layers
	 * Loads FontAwesome first when a layer's runtime asks for it.
	 */
	async setupLayers() {
		const layers = this.config.videoSetupOptions?.layers || [];

		if ( layersUseIconFont( layers ) ) {
			try {
				await loadFontAwesome();
			} catch ( error ) {
				// eslint-disable-next-line no-console
				console.error( 'Failed to load FontAwesome for hotspot icons:', error );
			}
		}

		// A video with the hover preview (`preview="true"`) mounts its layers
		// once the viewer starts real playback, see handlePreviewStateChange().
		if ( ! this.config.isPreviewEnabled ) {
			this.mountSavedLayers();
		}

		this.host.dispatch( 'onReady' );
		this.isDisplayingLayers[ this.currentPlayerVideoInstanceId ] = false;
	}

	/**
	 * Mount the video's saved layers and install the event-driven triggers.
	 * Runs once; later calls do nothing.
	 */
	mountSavedLayers() {
		if ( this.savedLayersMounted ) {
			return;
		}
		this.savedLayersMounted = true;

		const layers = this.config.videoSetupOptions?.layers || [];
		layers.forEach( ( layer ) => this.processLayer( layer ) );

		// Event-driven triggers: `on_pause` shows a layer when the viewer
		// pauses, `end_of_video` overlays one when playback ends. The host
		// holds both back while layers are suppressed.
		this.player.on( 'pause', () => {
			// Automatic pauses (player scrolled out of view, GoDAMAPI.pauseAll)
			// are not the viewer pausing, so they must not reveal a layer.
			if ( ! isAutoPause( this.player ) ) {
				this.host.dispatch( 'onPause' );
			}
		} );
		this.player.on( 'ended', () => this.host.dispatch( 'onEnded' ) );
	}

	/**
	 * The hover preview of a `preview="true"` video started or ended.
	 *
	 * Layers stay unmounted while the muted preview plays. Once the preview
	 * ends (the viewer clicked the video, or the preview timed out) they are
	 * mounted for real playback. While a later preview replays from the start,
	 * the suppression check holds them back.
	 *
	 * @param {boolean} isPreviewing Whether the preview is playing now.
	 */
	handlePreviewStateChange( isPreviewing ) {
		if ( ! isPreviewing ) {
			this.mountSavedLayers();
		}
	}

	/**
	 * Register a predicate that temporarily suppresses all layer firing.
	 *
	 * Used by the hover "Start Preview" behaviour: layers are still set up (and
	 * stay `hidden`), but nothing is revealed while the muted preview runs, so
	 * event-driven layers also keep their un-`triggered` state for real playback.
	 * It covers every mounted layer, including add-on layers and layers from
	 * `GoDAMAPI.createLayer()`.
	 *
	 * @param {Function} check - Returns true while layers must stay suppressed.
	 */
	setSuppressionCheck( check ) {
		this.suppressionCheck = typeof check === 'function' ? check : null;
	}

	/**
	 * Whether layer firing is currently suppressed.
	 *
	 * @return {boolean} True when no layer should be revealed.
	 */
	areLayersSuppressed() {
		return this.suppressionCheck?.() === true;
	}

	/**
	 * Mount one saved layer, if its type has a runtime that accepts it.
	 *
	 * @param {Object} layer - Layer configuration object
	 */
	processLayer( layer ) {
		const runtime = getLayerRuntime( layer?.type );
		if ( ! runtime ) {
			logOnce( 'info', `GoDAM: no runtime registered for layer type "${ layer?.type }".` );
			// An add-on's `godam_player_render_layer` output may not start hidden.
			document.querySelector( `#layer-${ this.video.dataset.instanceId }-${ layer?.id }` )?.classList.add( 'hidden' );
			// Its view script may still load (deferred or delayed): mount the layer then.
			whenLayerRuntime( layer?.type, ( lateRuntime ) => this.mountLateLayer( layer, lateRuntime ) );
			return;
		}

		this.mountIfValid( layer, runtime );
	}

	/**
	 * Mount a layer if its runtime accepts it. A layer of a type with variations
	 * whose own variation isn't registered yet (an add-on's form provider whose
	 * script loads later) is mounted once it registers.
	 *
	 * @param {Object} layer   - Layer configuration object
	 * @param {Object} runtime - The layer type's runtime
	 */
	mountIfValid( layer, runtime ) {
		if ( shouldMountLayer( runtime, layer ) ) {
			this.handleLayerDisplay( layer, runtime );
			return;
		}
		if ( runtime.variationAttribute && ! getLayerRuntimeVariation( runtime, layer ) ) {
			whenLayerRuntimeVariation( layer?.type, layer, ( updated ) => this.mountIfValid( layer, updated ) );
		}
	}

	/**
	 * Mount a layer whose runtime registered after the player set its layers up.
	 *
	 * @param {Object} layer   - Layer configuration object
	 * @param {Object} runtime - The layer type's runtime
	 */
	async mountLateLayer( layer, runtime ) {
		if ( runtimeUsesIconFont( runtime, layer ) ) {
			try {
				await loadFontAwesome();
			} catch ( error ) {
				// eslint-disable-next-line no-console
				console.error( 'Failed to load FontAwesome for hotspot icons:', error );
			}
		}
		this.mountIfValid( layer, runtime );
	}

	/**
	 * Find the layer's element, hide it and mount the layer into it.
	 *
	 * @param {Object} layer     - Layer configuration object
	 * @param {Object} [runtime] - The layer type's runtime
	 */
	handleLayerDisplay( layer, runtime = getLayerRuntime( layer?.type ) ) {
		const instanceId = this.video.dataset.instanceId;
		const layerElement = document.querySelector( `#layer-${ instanceId }-${ layer.id }` );

		if ( ! layerElement || this.mountedElements.has( layerElement ) ) {
			return;
		}

		layerElement.classList.add( 'hidden' );
		if ( this.host.mount( layer, layerElement, runtime ) ) {
			this.mountedElements.add( layerElement );
		}
	}

	/**
	 * Forward a playback time update to every layer.
	 *
	 * @param {number} currentTime - Current video time in seconds
	 */
	handleTimeUpdate( currentTime ) {
		this.host.dispatch( 'onTimeUpdate', currentTime );
	}

	/**
	 * Handle video resize events
	 */
	handleVideoResize() {
		this.host.dispatch( 'onResize' );
	}

	/**
	 * Handle fullscreen changes for layers
	 */
	handleFullscreenChange() {
		this.host.dispatch( 'onFullscreenChange', this.player.isFullscreen(), this.player.el() );
	}

	/**
	 * Handle play events for layers
	 */
	handlePlay() {
		this.host.dispatch( 'onPlay' );
	}
}
