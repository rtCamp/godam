/**
 * GoDAM Layer API: the front-end layer runtime registry (#2294).
 *
 * A layer type's front-end part registers here with `registerLayerRuntime()`.
 * The video player (`LayersManager`) and the image block (`render-image-frame`)
 * both mount saved layers through it, so a layer type works the same on video
 * and on images.
 *
 * This is plain JavaScript, not a `@wordpress/data` store: the image-layers
 * script must not pull React onto image-only pages (RFC D6). Every bundle that
 * imports this module shares one registry, published on `window.godam.layers`
 * next to the editor API, so a runtime registered from any script is seen by
 * every player and image on the page.
 */

/**
 * Internal dependencies
 */
import { isEqual } from '../is-equal';

const REGISTRY_KEY = '__runtimeRegistry';

/**
 * The variation of a runtime whose attributes all match a saved layer.
 *
 * @param {Object} runtime Runtime.
 * @param {Object} layer   Saved layer.
 * @return {Object|undefined} The variation.
 */
function findVariation( runtime, layer ) {
	return runtime?.variations?.find( ( { attributes } ) =>
		Object.entries( attributes ).every( ( [ key, value ] ) => isEqual( layer?.[ key ], value ) ),
	);
}

/**
 * Call a runtime callback an add-on wrote, treating a throw as `false`, so one
 * broken layer type can't stop the others from mounting.
 *
 * @param {Object}   runtime Runtime, for the message.
 * @param {string}   name    Callback name, for the message.
 * @param {Function} fn      The callback.
 * @param {...*}     args    Its arguments.
 * @return {boolean} The callback's answer, or false when it threw.
 */
function callSafely( runtime, name, fn, ...args ) {
	try {
		return Boolean( fn( ...args ) );
	} catch ( error ) {
		// eslint-disable-next-line no-console
		console.error( `GoDAM: the ${ name }() of layer runtime "${ runtime?.name }" failed.`, error );
		return false;
	}
}

/**
 * Log a message once per page.
 *
 * @param {Set}    seen    Messages already logged.
 * @param {string} level   Console method.
 * @param {string} message Message.
 */
function logOnceIn( seen, level, message ) {
	if ( seen.has( message ) ) {
		return;
	}
	seen.add( message );
	// eslint-disable-next-line no-console
	console[ level ]( message );
}

/**
 * Normalize a variation for a runtime.
 *
 * @param {Object} runtime   The runtime.
 * @param {Object} variation The variation as registered.
 * @return {Object} The variation, with `attributes` defaulted from its name.
 */
function normalizeVariation( runtime, variation ) {
	const attributes = variation.attributes ||
		( runtime.variationAttribute ? { [ runtime.variationAttribute ]: variation.name } : {} );
	return { ...variation, attributes };
}

/**
 * Create an empty registry.
 *
 * @return {Object} The registry API.
 */
function createRegistry() {
	const runtimes = new Map();
	const pendingVariations = new Map();
	const logged = new Set();
	const waiting = new Map();
	const waitingForVariation = new Map();

	/**
	 * Run the callbacks of layers waiting for a variation of this runtime that
	 * now has one (e.g. a form layer whose provider just registered).
	 *
	 * @param {Object} runtime The runtime, with its current variations.
	 */
	const notifyVariationWaiters = ( runtime ) => {
		const entries = waitingForVariation.get( runtime.name ) || [];
		const ready = entries.filter( ( { layer } ) => findVariation( runtime, layer ) );
		if ( ! ready.length ) {
			return;
		}
		waitingForVariation.set( runtime.name, entries.filter( ( entry ) => ! ready.includes( entry ) ) );
		ready.forEach( ( { callback } ) => {
			try {
				callback( runtime );
			} catch ( error ) {
				// eslint-disable-next-line no-console
				console.error( `GoDAM: a layer waiting for a "${ runtime.name }" variation failed to mount.`, error );
			}
		} );
	};

	const withVariations = ( runtime, variations ) => ( {
		...runtime,
		variations: variations.map( ( variation ) => normalizeVariation( runtime, variation ) ),
	} );

	/**
	 * Register a layer type's front-end runtime.
	 *
	 * @param {string}   name                          Layer type name, as saved in `layer.type`.
	 * @param {Object}   settings                      Runtime settings.
	 * @param {Function} settings.mount                `mount( ctx )`, called once per saved layer. Returns the event handlers.
	 * @param {Function} [settings.validate]           `validate( layer, { dependencies } )`. Return false to skip the layer.
	 * @param {Object}   [settings.supports]           `{ media: [ 'video', 'image' ] }`. Defaults to video only.
	 * @param {string}   [settings.title]              Label used in analytics names.
	 * @param {Function} [settings.usesIconFont]       `usesIconFont( layer )`. Return true to load FontAwesome first.
	 * @param {string}   [settings.variationAttribute] Attribute that selects a variation, e.g. `form_type`.
	 * @param {Array}    [settings.variations]         Variations, e.g. one per form provider.
	 * @return {Object|undefined} The registered runtime, or undefined when it was rejected.
	 */
	function registerLayerRuntime( name, settings = {} ) {
		if ( typeof name !== 'string' || ! name ) {
			// eslint-disable-next-line no-console
			console.error( 'GoDAM: a layer runtime needs a layer type name.' );
			return undefined;
		}
		if ( runtimes.has( name ) ) {
			// eslint-disable-next-line no-console
			console.error( `GoDAM: a runtime for layer type "${ name }" is already registered.` );
			return undefined;
		}
		if ( typeof settings.mount !== 'function' ) {
			// eslint-disable-next-line no-console
			console.error( `GoDAM: the runtime for layer type "${ name }" needs a mount() function.` );
			return undefined;
		}

		const runtime = withVariations(
			{
				...settings,
				name,
				title: settings.title || name,
				supports: { media: [ 'video' ], ...settings.supports },
			},
			[ ...( settings.variations || [] ), ...( pendingVariations.get( name ) || [] ) ],
		);
		pendingVariations.delete( name );
		runtimes.set( name, runtime );

		const callbacks = waiting.get( name ) || [];
		waiting.delete( name );
		callbacks.forEach( ( callback ) => {
			try {
				callback( runtime );
			} catch ( error ) {
				// eslint-disable-next-line no-console
				console.error( `GoDAM: a layer waiting for runtime "${ name }" failed to mount.`, error );
			}
		} );
		notifyVariationWaiters( runtime );
		return runtime;
	}

	/**
	 * Run a callback once a runtime has a variation matching a saved layer: now,
	 * if it already has. Lets a player mount a layer whose variation (an add-on's
	 * form provider, say) registers after the layer was first checked.
	 *
	 * @param {string}   name     Layer type name.
	 * @param {Object}   layer    Saved layer.
	 * @param {Function} callback `callback( runtime )`.
	 * @return {Function} Stops waiting.
	 */
	function whenLayerRuntimeVariation( name, layer, callback ) {
		const runtime = runtimes.get( name );
		if ( runtime && findVariation( runtime, layer ) ) {
			callback( runtime );
			return () => {};
		}
		const entry = { layer, callback };
		waitingForVariation.set( name, [ ...( waitingForVariation.get( name ) || [] ), entry ] );
		return () => waitingForVariation.set( name, ( waitingForVariation.get( name ) || [] ).filter( ( other ) => other !== entry ) );
	}

	/**
	 * Run a callback once a layer type's runtime is registered: now, if it
	 * already is. Lets a player mount layers whose view script loads after the
	 * player started (scripts deferred or delayed by an optimisation plugin).
	 *
	 * @param {string}   name     Layer type name.
	 * @param {Function} callback `callback( runtime )`.
	 * @return {Function} Stops waiting.
	 */
	function whenLayerRuntime( name, callback ) {
		if ( runtimes.has( name ) ) {
			callback( runtimes.get( name ) );
			return () => {};
		}
		waiting.set( name, [ ...( waiting.get( name ) || [] ), callback ] );
		return () => waiting.set( name, ( waiting.get( name ) || [] ).filter( ( other ) => other !== callback ) );
	}

	/**
	 * Remove a layer type's runtime. Layers already mounted keep running.
	 *
	 * @param {string} name Layer type name.
	 * @return {Object|undefined} The removed runtime.
	 */
	function unregisterLayerRuntime( name ) {
		const runtime = runtimes.get( name );
		runtimes.delete( name );
		return runtime;
	}

	/**
	 * Add a variation to a runtime, e.g. a form provider to the Form runtime.
	 * A variation registered before its runtime is added once the runtime registers.
	 *
	 * @param {string} name      Layer type name.
	 * @param {Object} variation `{ name, title, ... }`.
	 * @return {Object|undefined} The variation, or undefined when it was rejected.
	 */
	function registerLayerRuntimeVariation( name, variation = {} ) {
		if ( ! variation.name || typeof variation.name !== 'string' ) {
			// eslint-disable-next-line no-console
			console.error( `GoDAM: a variation of layer runtime "${ name }" needs a name.` );
			return undefined;
		}

		const runtime = runtimes.get( name );
		const existing = runtime ? runtime.variations : ( pendingVariations.get( name ) || [] );
		if ( existing.some( ( { name: other } ) => other === variation.name ) ) {
			// eslint-disable-next-line no-console
			console.error( `GoDAM: variation "${ variation.name }" of layer runtime "${ name }" is already registered.` );
			return undefined;
		}

		if ( ! runtime ) {
			pendingVariations.set( name, [ ...existing, variation ] );
			return variation;
		}

		const updated = withVariations( runtime, [ ...runtime.variations, variation ] );
		runtimes.set( name, updated );
		notifyVariationWaiters( updated );
		return updated.variations.at( -1 );
	}

	/**
	 * Remove a variation from a runtime.
	 *
	 * @param {string} name          Layer type name.
	 * @param {string} variationName Variation name.
	 */
	function unregisterLayerRuntimeVariation( name, variationName ) {
		const runtime = runtimes.get( name );
		if ( runtime ) {
			runtimes.set( name, {
				...runtime,
				variations: runtime.variations.filter( ( { name: other } ) => other !== variationName ),
			} );
		}
		if ( pendingVariations.has( name ) ) {
			pendingVariations.set(
				name,
				pendingVariations.get( name ).filter( ( { name: other } ) => other !== variationName ),
			);
		}
	}

	return {
		registerLayerRuntime,
		unregisterLayerRuntime,
		whenLayerRuntime,
		whenLayerRuntimeVariation,
		registerLayerRuntimeVariation,
		unregisterLayerRuntimeVariation,
		getLayerRuntime: ( name ) => runtimes.get( name ),
		getLayerRuntimes: () => [ ...runtimes.values() ],
		logOnce: ( level, message ) => logOnceIn( logged, level, message ),
	};
}

let fallbackRegistry = null;

/**
 * Get the page's shared registry, creating it on first use.
 *
 * @return {Object} The registry.
 */
export function getRuntimeRegistry() {
	if ( typeof window === 'undefined' ) {
		fallbackRegistry = fallbackRegistry || createRegistry();
		return fallbackRegistry;
	}

	window.godam = window.godam || {};
	window.godam.layers = window.godam.layers || {};
	const globalApi = window.godam.layers;

	if ( ! globalApi[ REGISTRY_KEY ] ) {
		const registry = createRegistry();
		Object.defineProperty( globalApi, REGISTRY_KEY, { value: registry, configurable: true } );
		const publicApi = { ...registry };
		delete publicApi.logOnce;
		Object.assign( globalApi, publicApi, {
			getLayerRuntimeVariation,
			shouldMountLayer,
		} );
	}

	return globalApi[ REGISTRY_KEY ];
}

export const registerLayerRuntime = ( ...args ) => getRuntimeRegistry().registerLayerRuntime( ...args );
export const unregisterLayerRuntime = ( ...args ) => getRuntimeRegistry().unregisterLayerRuntime( ...args );
export const whenLayerRuntime = ( ...args ) => getRuntimeRegistry().whenLayerRuntime( ...args );
export const whenLayerRuntimeVariation = ( ...args ) => getRuntimeRegistry().whenLayerRuntimeVariation( ...args );
export const registerLayerRuntimeVariation = ( ...args ) => getRuntimeRegistry().registerLayerRuntimeVariation( ...args );
export const unregisterLayerRuntimeVariation = ( ...args ) => getRuntimeRegistry().unregisterLayerRuntimeVariation( ...args );
export const getLayerRuntime = ( name ) => getRuntimeRegistry().getLayerRuntime( name );
export const getLayerRuntimes = () => getRuntimeRegistry().getLayerRuntimes();
export const logOnce = ( level, message ) => getRuntimeRegistry().logOnce( level, message );

/**
 * The variation a saved layer uses: the one whose attributes all match the layer.
 *
 * @param {Object|string} runtime Runtime, or its layer type name.
 * @param {Object}        layer   Saved layer.
 * @return {Object|undefined} The variation.
 */
export function getLayerRuntimeVariation( runtime, layer ) {
	return findVariation( typeof runtime === 'string' ? getLayerRuntime( runtime ) : runtime, layer );
}

/**
 * Whether a runtime supports a kind of media.
 *
 * @param {Object} runtime   Runtime.
 * @param {string} mediaType `video` or `image`.
 * @return {boolean} True when the runtime runs on that media.
 */
export function supportsMedia( runtime, mediaType ) {
	return ( runtime?.supports?.media || [] ).includes( mediaType );
}

/**
 * Whether a saved layer should be mounted: its runtime's `validate()` says yes
 * (no `validate()` means always). A `validate()` that throws counts as no.
 *
 * @param {Object} runtime        Runtime.
 * @param {Object} layer          Saved layer.
 * @param {Object} [dependencies] Active plugins (`window.godamPluginDependencies`).
 * @return {boolean} True to mount the layer.
 */
export function shouldMountLayer( runtime, layer, dependencies = window.godamPluginDependencies ) {
	if ( ! runtime ) {
		return false;
	}
	if ( typeof runtime.validate !== 'function' ) {
		return true;
	}
	return callSafely( runtime, 'validate', runtime.validate, layer, { dependencies } );
}

/**
 * Whether a layer needs FontAwesome before it renders, per its runtime's
 * `usesIconFont( layer )`. A callback that throws counts as no.
 *
 * @param {Object} runtime Runtime.
 * @param {Object} layer   Saved layer.
 * @return {boolean} True when FontAwesome must load first.
 */
export function runtimeUsesIconFont( runtime, layer ) {
	return typeof runtime?.usesIconFont === 'function' && callSafely( runtime, 'usesIconFont', runtime.usesIconFont, layer );
}

/**
 * Whether any of these layers needs FontAwesome before it renders.
 *
 * @param {Array} layers Saved layers.
 * @return {boolean} True when a runtime's `usesIconFont( layer )` says so.
 */
export function layersUseIconFont( layers ) {
	return ( Array.isArray( layers ) ? layers : [] ).some( ( layer ) => runtimeUsesIconFont( getLayerRuntime( layer?.type ), layer ) );
}
