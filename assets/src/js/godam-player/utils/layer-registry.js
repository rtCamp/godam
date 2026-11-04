/**
 * The old front-end layer registry, `window.godamLayerRegistry`, kept for
 * add-ons built before the Layer API (#2294).
 *
 * It is now a thin layer over the Layer API runtime registry
 * (`godam-layers/runtime/registry.js`): `registerLayerType( id, { label,
 * validator, manager } )` registers a runtime whose `mount()` drives the
 * add-on's manager class through the informal interface core used to call:
 *
 * On video it calls `new Manager( player, isDisplayingLayers, instanceId )`,
 * then `setupLayer( layer, element )`, `handleTimeUpdate( time )`,
 * `handleResize()` and `handleFullscreenChange( isFullscreen, container )`.
 * On images it calls what core used to call on godam-for-woo's manager:
 * `setupLayer()`, `createProductHotspots()`, `emitLayerVisible()` and
 * `updateProductHotspotPositions()`. Only a manager with
 * `createProductHotspots()` runs on images.
 *
 * New code should call `registerLayerRuntime()` instead. #2296 moves
 * godam-for-woo over and deprecates this file.
 */

/**
 * Internal dependencies
 */
import {
	registerLayerRuntime,
	getLayerRuntime,
	getLayerRuntimes,
} from '../../godam-layers/runtime/registry.js';

const CORE_TYPES = [ 'form', 'cta', 'poll', 'hotspot' ];

// Callbacks added with addLayerRegistryHook(), shared by every bundle's copy.
const getHooks = () => {
	if ( typeof window === 'undefined' ) {
		return [];
	}
	window.godam = window.godam || {};
	window.godam.__legacyLayerRegistryHooks = window.godam.__legacyLayerRegistryHooks || [];
	return window.godam.__legacyLayerRegistryHooks;
};

/**
 * Whether a legacy manager class can draw on an image.
 *
 * @param {Function} Manager Manager class.
 * @return {boolean} True when it has the image methods godam-for-woo's manager has.
 */
const runsOnImages = ( Manager ) => typeof Manager?.prototype?.createProductHotspots === 'function';

/**
 * What core used to check for the Woo layer before loading FontAwesome: a
 * layer-level icon, or an icon on any product hotspot.
 *
 * @param {Object} layer Saved layer.
 * @return {boolean} True when FontAwesome must load first.
 */
const legacyUsesIconFont = ( layer ) =>
	Boolean( ( layer?.styleType === 'icon' && layer?.icon ) || layer?.productHotspots?.some( ( hotspot ) => hotspot.icon ) );

/**
 * Build the `mount()` that drives a legacy manager class.
 *
 * @param {string}   id      Layer type.
 * @param {Function} Manager Manager class, if any.
 * @return {Function} The mount function.
 */
function legacyMount( id, Manager ) {
	return ( ctx ) => {
		if ( ! Manager ) {
			return {};
		}

		const onImage = ctx.media?.type === 'image';
		const state = ctx.shared( `legacy:${ id }`, () => {
			const manager = new Manager( ctx.player, ctx.isDisplayingLayers, ctx.instanceId );
			if ( onImage ) {
				manager.computeContentRect = () => ctx.player.computeContentRect();
				return { manager, handlers: { onResize: () => manager.updateProductHotspotPositions?.() } };
			}
			return {
				manager,
				handlers: {
					onTimeUpdate: ( currentTime ) => manager.handleTimeUpdate?.( currentTime ),
					onResize: () => manager.handleResize?.(),
					onFullscreenChange: ( isFullscreen, container ) => manager.handleFullscreenChange?.( isFullscreen, container ),
				},
			};
		} );

		const { manager } = state;
		manager.setupLayer?.( ctx.layer, ctx.container );

		if ( onImage ) {
			// A still image has no timeline, so the layer is drawn now and its
			// impression fires once, on render.
			const layerObj = manager.wooLayers?.[ manager.wooLayers.length - 1 ];
			if ( layerObj ) {
				manager.createProductHotspots( layerObj );
				manager.emitLayerVisible?.( layerObj.layer );
			}
		}

		return state.handlers;
	};
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
	if ( getLayerRuntime( id ) ) {
		// eslint-disable-next-line no-console
		console.warn( `Layer type "${ id }" is already registered. Skipping duplicate registration.` );
		return false;
	}

	if ( ! id || ! config?.label || ! config?.validator ) {
		// eslint-disable-next-line no-console
		console.error( 'Layer type registration requires: id, label, and validator function' );
		return false;
	}

	const registered = registerLayerRuntime( id, {
		title: config.label,
		supports: { media: runsOnImages( config.manager ) ? [ 'video', 'image' ] : [ 'video' ] },
		validate: ( layer, { dependencies } ) => config.validator( layer, dependencies ),
		usesIconFont: legacyUsesIconFont,
		mount: legacyMount( id, config.manager ),
		legacy: { label: config.label, validator: config.validator, manager: config.manager },
	} );
	if ( ! registered ) {
		return false;
	}

	getHooks().forEach( ( callback ) => callback( 'register', id, config ) );
	return true;
}

/**
 * Get all registered layer types
 *
 * @return {Object} Object with all registered layer type IDs as keys
 */
export function getLayerTypes() {
	return [ ...CORE_TYPES, ...getLayerRuntimes().map( ( { name } ) => name ) ].reduce( ( types, name ) => {
		types[ name.toUpperCase() ] = name;
		return types;
	}, {} );
}

/**
 * Get validator for a specific layer type
 *
 * @param {string} layerType - The layer type ID
 * @return {Function|null} `validator( layer, dependencies )` if the type has one, null otherwise
 */
export function getLayerValidator( layerType ) {
	const runtime = getLayerRuntime( layerType );
	if ( runtime?.legacy?.validator ) {
		return runtime.legacy.validator;
	}
	if ( typeof runtime?.validate === 'function' ) {
		return ( layer, dependencies ) => runtime.validate( layer, { dependencies } );
	}
	return null;
}

/**
 * Get manager class for a specific layer type
 *
 * @param {string} layerType - The layer type ID
 * @return {Function|null} Manager class if found, null otherwise
 */
export function getLayerManager( layerType ) {
	return getLayerRuntime( layerType )?.legacy?.manager || null;
}

/**
 * Check if a layer type is registered
 *
 * @param {string} layerType - The layer type ID
 * @return {boolean} True if layer type is registered
 */
export function isLayerTypeRegistered( layerType ) {
	return Boolean( getLayerRuntime( layerType ) ) || CORE_TYPES.includes( layerType );
}

/**
 * Add a filter hook that fires when layers are registered
 * Callback receives: (action, layerId, config)
 *
 * @param {Function} callback - Callback function to execute
 */
export function addLayerRegistryHook( callback ) {
	getHooks().push( callback );
}

/**
 * Get all layer types registered through this API
 *
 * @return {Object} `{ [ id ]: { label, manager? } }`
 */
export function getAllRegisteredLayerTypes() {
	return getLayerRuntimes()
		.filter( ( { legacy } ) => legacy )
		.reduce( ( types, { name, legacy } ) => {
			types[ name ] = { label: legacy.label, ...( legacy.manager && { manager: legacy.manager } ) };
			return types;
		}, {} );
}
