/**
 * Layer Registry
 * Manages dynamic layer type registration for add-ons
 */

// Internal registry for layer types, validators, and managers
const layerRegistry = {
	types: {},
	validators: {},
	managers: {},
	hooks: [],
};

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
	return layerRegistry.validators[ layerType ] || null;
}

/**
 * Get manager class for a specific layer type
 *
 * @param {string} layerType - The layer type ID
 * @return {Function|null} Manager class if found, null otherwise
 */
export function getLayerManager( layerType ) {
	return layerRegistry.managers[ layerType ] || null;
}

/**
 * Check if a layer type is registered
 *
 * @param {string} layerType - The layer type ID
 * @return {boolean} True if layer type is registered
 */
export function isLayerTypeRegistered( layerType ) {
	return !! layerRegistry.types[ layerType ] || [ 'form', 'cta', 'poll', 'hotspot' ].includes( layerType );
}

/**
 * Add a filter hook that fires when layers are registered
 * Callback receives: (action, layerId, config)
 *
 * @param {Function} callback - Callback function to execute
 */
export function addLayerRegistryHook( callback ) {
	layerRegistry.hooks.push( callback );
}

/**
 * Get all registered layer types info
 *
 * @return {Object} Object with metadata for all registered types
 */
export function getAllRegisteredLayerTypes() {
	return {
		...layerRegistry.types,
	};
}
