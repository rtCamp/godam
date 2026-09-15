/**
 * Layer Registry
 * Manages dynamic layer type registration for add-ons
 *
 * The registry store lives on `window` so every webpack bundle that imports
 * this module shares ONE store. The main player build and the separate
 * image-layers build each carry their own module-scoped copy of this file; a
 * module-local store would give each build a private registry. Add-ons (e.g.
 * the Woo layer) register once — into whichever build initialized
 * `window.godamLayerRegistry` first (it drains the queue) — so with private
 * stores the other build never sees that registration. The player reads its
 * own copy via getLayerManager(), so on a page that had both a godam/video and
 * a godam/image block, if the image build won the init race the player's store
 * stayed empty and the video's Woo hotspots never rendered. A shared,
 * window-backed store makes every copy of these functions read/write the same
 * data, independent of bundle load order.
 */

const STORE_KEY = '__godamLayerRegistryStore';

/**
 * Create an empty registry store.
 *
 * @return {Object} A fresh store for layer types, validators, managers and hooks.
 */
function createStore() {
	return {
		types: {},
		validators: {},
		managers: {},
		hooks: [],
	};
}

// Module-local fallback for non-browser contexts (SSR / unit tests with no
// window). In the browser the store is a singleton hung off `window`.
const fallbackStore = createStore();

/**
 * Get the shared registry store.
 *
 * @return {Object} The window-backed store, or the module-local fallback when there is no `window`.
 */
function getStore() {
	if ( typeof window === 'undefined' ) {
		return fallbackStore;
	}
	if ( ! window[ STORE_KEY ] ) {
		window[ STORE_KEY ] = createStore();
	}
	return window[ STORE_KEY ];
}

/**
 * Register a new layer type
 *
 * @param {string}   id               - Unique identifier for the layer type (e.g., 'woo', 'custom')
 * @param {Object}   config           - Layer configuration object
 * @param {string}   config.label     - Human-readable label for the layer type
 * @param {Function} config.validator - Validation function for this layer type
 * @param {Function} [config.manager] - Optional manager class for this layer type
 * @return {boolean} True if registration successful, false if already registered
 */
export function registerLayerType( id, config ) {
	const layerRegistry = getStore();

	if ( layerRegistry.types[ id ] ) {
		// eslint-disable-next-line no-console
		console.warn( `Layer type "${ id }" is already registered. Skipping duplicate registration.` );
		return false;
	}

	if ( ! id || ! config.label || ! config.validator ) {
		// eslint-disable-next-line no-console
		console.error( 'Layer type registration requires: id, label, and validator function' );
		return false;
	}

	layerRegistry.types[ id ] = {
		label: config.label,
		...( config.manager && { manager: config.manager } ),
	};

	layerRegistry.validators[ id ] = config.validator;

	if ( config.manager ) {
		layerRegistry.managers[ id ] = config.manager;
	}

	// Call any registered hooks
	layerRegistry.hooks.forEach( ( callback ) => {
		callback( 'register', id, config );
	} );

	return true;
}

/**
 * Get all registered layer types
 *
 * @return {Object} Object with all registered layer type IDs as keys
 */
export function getLayerTypes() {
	const layerRegistry = getStore();
	const defaultTypes = {
		FORM: 'form',
		CTA: 'cta',
		POLL: 'poll',
		HOTSPOT: 'hotspot',
		...Object.keys( layerRegistry.types ).reduce( ( acc, key ) => {
			acc[ key.toUpperCase() ] = key;
			return acc;
		}, {} ),
	};
	return defaultTypes;
}

/**
 * Get validator for a specific layer type
 *
 * @param {string} layerType - The layer type ID
 * @return {Function|null} Validator function if found, null otherwise
 */
export function getLayerValidator( layerType ) {
	return getStore().validators[ layerType ] || null;
}

/**
 * Get manager class for a specific layer type
 *
 * @param {string} layerType - The layer type ID
 * @return {Function|null} Manager class if found, null otherwise
 */
export function getLayerManager( layerType ) {
	return getStore().managers[ layerType ] || null;
}

/**
 * Check if a layer type is registered
 *
 * @param {string} layerType - The layer type ID
 * @return {boolean} True if layer type is registered
 */
export function isLayerTypeRegistered( layerType ) {
	return !! getStore().types[ layerType ] || [ 'form', 'cta', 'poll', 'hotspot' ].includes( layerType );
}

/**
 * Add a filter hook that fires when layers are registered
 * Callback receives: (action, layerId, config)
 *
 * @param {Function} callback - Callback function to execute
 */
export function addLayerRegistryHook( callback ) {
	getStore().hooks.push( callback );
}

/**
 * Get all registered layer types info
 *
 * @return {Object} Object with metadata for all registered types
 */
export function getAllRegisteredLayerTypes() {
	return {
		...getStore().types,
	};
}
