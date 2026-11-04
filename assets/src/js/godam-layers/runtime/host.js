/**
 * GoDAM Layer API: the host that mounts saved layers on one video or image (#2294).
 *
 * `LayersManager` creates one host per player and `render-image-frame` one per
 * image. The host mounts each saved layer through its type's runtime, then
 * forwards player events to the handlers each `mount()` returned:
 *
 * - `onReady()` once every saved layer is mounted (and right away for a layer mounted later)
 * - `onTimeUpdate( currentTime )`, `onPause()`, `onEnded()` (held back while layers are suppressed)
 * - `onPlay()`, `onResize()`, `onFullscreenChange( isFullscreen, container )`, `onReplay()`
 * - `destroy()` when the layer is unmounted
 *
 * Several mounts may return the same handlers object (a runtime that keeps one
 * controller for all its layers on a player); it then gets each event once.
 */

/**
 * Internal dependencies
 */
import { getLayerRuntime, supportsMedia, logOnce } from './registry';
import { LAYER_TYPE_WHITELIST } from '../../godam-player/utils/layerActions.js';

// Events that reveal layers, so they wait while a hover preview plays.
const SUPPRESSIBLE_EVENTS = new Set( [ 'onTimeUpdate', 'onPause', 'onEnded' ] );

/**
 * Resolve the analytics video key for a player (`data-id`, else `data-job_id`).
 *
 * @param {Object} player Player or media adapter.
 * @return {string} The key, or '' when there is none.
 */
function getVideoKey( player ) {
	try {
		const el = player?.el?.();
		return String( el?.getAttribute?.( 'data-id' ) || el?.getAttribute?.( 'data-job_id' ) || '' );
	} catch ( e ) {
		return '';
	}
}

/**
 * Create a layer host.
 *
 * @param {Object}   options                      Options.
 * @param {Object}   options.player               Video.js player, or an adapter with the same methods for images.
 * @param {Object}   options.media                `{ type: 'video' | 'image', element }`.
 * @param {string}   [options.instanceId]         Player instance id, used in layer element ids.
 * @param {Object}   [options.isDisplayingLayers] Shared map of players showing a blocking layer.
 * @param {Function} [options.isSuppressed]       Returns true while layers must not appear.
 * @return {Object} The host.
 */
export function createLayerHost( {
	player,
	media,
	instanceId = '',
	isDisplayingLayers = {},
	isSuppressed = () => false,
} ) {
	const shared = new Map();
	const handlerList = [];
	const mounted = [];
	const tracked = new Set();
	let ready = false;

	const host = {
		player,
		media,
		instanceId,
		isDisplayingLayers,

		/**
		 * Whether layers must stay hidden right now (e.g. during a hover preview).
		 *
		 * @return {boolean} True while suppressed.
		 */
		isSuppressed: () => isSuppressed() === true,

		/**
		 * Mount one saved layer.
		 *
		 * @param {Object}      layer     Saved layer.
		 * @param {HTMLElement} container The layer's element.
		 * @param {Object}      [runtime] Runtime to use. Defaults to the one registered for `layer.type`.
		 * @return {Function|null} Unmount function, or null when nothing was mounted.
		 */
		mount( layer, container, runtime = getLayerRuntime( layer?.type ) ) {
			if ( ! runtime ) {
				logOnce( 'info', `GoDAM: no runtime registered for layer type "${ layer?.type }".` );
				return null;
			}
			if ( ! supportsMedia( runtime, media?.type ) ) {
				return null;
			}

			let handlers;
			try {
				handlers = runtime.mount( createContext( layer, container ) ) || {};
			} catch ( error ) {
				// eslint-disable-next-line no-console
				console.error( `GoDAM: layer "${ layer?.id }" (${ runtime.name }) failed to mount.`, error );
				return null;
			}

			const record = { layer, container, handlers };
			mounted.push( record );
			if ( ! handlerList.includes( handlers ) ) {
				handlerList.push( handlers );
			}
			// A layer mounted after `onReady` (its view script loaded late) gets it now.
			if ( ready ) {
				call( handlers, 'onReady' );
			}

			return () => host.unmount( record );
		},

		/**
		 * Unmount a layer. Its handlers' `destroy()` runs once no other layer uses them.
		 *
		 * @param {Object} record The mounted layer.
		 */
		unmount( record ) {
			const index = mounted.indexOf( record );
			if ( index === -1 ) {
				return;
			}
			mounted.splice( index, 1 );
			if ( mounted.some( ( { handlers } ) => handlers === record.handlers ) ) {
				return;
			}
			handlerList.splice( handlerList.indexOf( record.handlers ), 1 );
			call( record.handlers, 'destroy' );
		},

		/**
		 * Send an event to every mounted layer's handlers.
		 *
		 * @param {string} event Handler name, e.g. `onTimeUpdate`.
		 * @param {...*}   args  Handler arguments.
		 */
		dispatch( event, ...args ) {
			if ( 'onReady' === event ) {
				ready = true;
			}
			if ( SUPPRESSIBLE_EVENTS.has( event ) && host.isSuppressed() ) {
				return;
			}
			[ ...handlerList ].forEach( ( handlers ) => call( handlers, event, ...args ) );
		},

		/**
		 * A value shared by every layer on this video or image, created on first use.
		 * Runtimes reach it as `ctx.shared( key, create )`.
		 *
		 * @param {string}   key    Key, namespaced like the layer type.
		 * @param {Function} create Creates the value.
		 * @return {*} The value.
		 */
		shared( key, create ) {
			if ( ! shared.has( key ) ) {
				shared.set( key, create() );
			}
			return shared.get( key );
		},

		/**
		 * The value stored under a key, if any.
		 *
		 * @param {string} key Key.
		 * @return {*} The value.
		 */
		getShared: ( key ) => shared.get( key ),

		/**
		 * The layers mounted so far.
		 *
		 * @return {Array} `{ layer, container }` for each.
		 */
		getMountedLayers: () => mounted.map( ( { layer, container } ) => ( { layer, container } ) ),

		/**
		 * Unmount every layer.
		 */
		destroy() {
			[ ...mounted ].forEach( ( record ) => host.unmount( record ) );
			shared.clear();
		},
	};

	/**
	 * Call one handler, keeping a broken add-on from stopping the others.
	 *
	 * @param {Object} handlers Handlers.
	 * @param {string} event    Handler name.
	 * @param {...*}   args     Arguments.
	 */
	function call( handlers, event, ...args ) {
		if ( typeof handlers?.[ event ] !== 'function' ) {
			return;
		}
		try {
			handlers[ event ]( ...args );
		} catch ( error ) {
			// eslint-disable-next-line no-console
			console.error( `GoDAM: a layer's ${ event } handler failed.`, error );
		}
	}

	/**
	 * Build the `ctx` passed to `mount()`.
	 *
	 * @param {Object}      layer     Saved layer.
	 * @param {HTMLElement} container Layer element.
	 * @return {Object} The context.
	 */
	function createContext( layer, container ) {
		return {
			layer,
			container,
			player,
			media,
			instanceId,
			isDisplayingLayers,
			shared: host.shared,
			api: {
				show: () => container?.classList.remove( 'hidden' ),
				hide: () => container?.classList.add( 'hidden' ),
				isVisible: () => Boolean( container ) && ! container.classList.contains( 'hidden' ),
				pause: () => player?.pause?.(),
				play: () => {
					const playing = player?.play?.();
					playing?.catch?.( () => {} );
				},
				seek: ( time ) => player?.currentTime?.( time ),
				currentTime: () => Number( player?.currentTime?.() ) || 0,
				isSuppressed: host.isSuppressed,
				track: ( action, metadata ) => track( layer, action, metadata ),
			},
		};
	}

	/**
	 * Record a layer interaction, once per layer and action per page.
	 *
	 * @param {Object} layer    Saved layer.
	 * @param {string} action   e.g. `viewed`, `clicked`.
	 * @param {Object} metadata Extra data.
	 */
	function track( layer, action, metadata = {} ) {
		const type = String( layer?.type || '' );
		// The analytics service accepts only these types today (RFC D4).
		if ( ! LAYER_TYPE_WHITELIST.includes( type ) ) {
			logOnce( 'info', `GoDAM: analytics doesn't record layer type "${ type }" yet.` );
			return;
		}
		const videoKey = getVideoKey( player );
		const key = `${ layer?.id }:${ action }`;
		if ( ! videoKey || ! layer?.id || tracked.has( key ) || typeof window.GoDAM?.addLayerInteraction !== 'function' ) {
			return;
		}
		tracked.add( key );

		const name = window.GoDAM.getLayerDisplayName?.( layer, type ) || String( layer.id );
		window.GoDAM.addLayerInteraction( videoKey, {
			layer_id: String( layer.id ),
			layer_type: type,
			action_type: action,
			layer_timestamp: parseFloat( layer.displayTime ) || 0,
			layer_name: name,
			page_url: window.location.href,
			layer_metadata: { parent_layer_id: String( layer.id ), parent_layer_name: name, ...metadata },
		} );
	}

	return host;
}
