/**
 * Layer type registration (RFC: docs/rfcs/layer-api.md).
 *
 * `registerLayerType( metadata, settings )` mirrors `registerBlockType()`:
 * `metadata` is the contents of a `layer.json`, `settings` adds what JSON
 * can't hold (React components, callbacks, translated strings).
 */

/**
 * WordPress dependencies
 */
import { dispatch, select } from '@wordpress/data';
import { applyFilters } from '@wordpress/hooks';

/**
 * Internal dependencies
 */
import { store } from './store';
import { CORE_LAYER_TYPES, DEFAULT_SUPPORTS, MANAGED_KEYS, NAME_PATTERN, SHARED_KEYS } from './constants';

/* eslint-disable no-console -- registration problems are reported to the add-on developer. */

const isUrl = ( value ) => typeof value === 'string' && /^(https?:|\/|data:)/.test( value );

/**
 * Drop attribute declarations a layer type isn't allowed to make.
 *
 * @param {string} name       Layer type name, for messages.
 * @param {Object} attributes Declared attributes.
 * @return {Object} Allowed attributes.
 */
function sanitizeAttributes( name, attributes = {} ) {
	const allowed = {};
	Object.entries( attributes ).forEach( ( [ key, schema ] ) => {
		if ( MANAGED_KEYS.includes( key ) ) {
			console.error( `GoDAM: layer type "${ name }" can't declare the "${ key }" attribute; GoDAM manages it.` );
			return;
		}
		if ( SHARED_KEYS.includes( key ) ) {
			// Shared keys keep GoDAM's schema; only the default is the layer type's.
			allowed[ key ] = 'default' in ( schema || {} ) ? { default: schema.default } : {};
			return;
		}
		allowed[ key ] = schema || {};
	} );
	return allowed;
}

/**
 * Fill in defaults so every registered layer type has the same shape.
 *
 * @param {Object} layerType Merged metadata and settings.
 * @return {Object} Normalized layer type.
 */
function normalizeLayerType( layerType ) {
	const { icon, iconUrl, supports, attributes, variations, ...rest } = layerType;
	return {
		apiVersion: 1,
		description: '',
		...rest,
		label: rest.label || rest.title,
		icon: isUrl( icon ) ? undefined : icon,
		iconUrl: iconUrl || ( isUrl( icon ) ? icon : undefined ),
		supports: { ...DEFAULT_SUPPORTS, ...( supports || {} ) },
		attributes: sanitizeAttributes( rest.name, attributes ),
		variations: Array.isArray( variations ) ? variations : [],
	};
}

/**
 * Register a layer type.
 *
 * @param {Object|string} metadata Contents of the type's `layer.json`, or just its name.
 * @param {Object}        settings Editor settings: `edit`, `icon`, `getAvailability`, `validate`, `variations`, translated `title`/`description`, and so on.
 * @return {Object|undefined} The registered layer type, or undefined when registration failed.
 */
export function registerLayerType( metadata, settings = {} ) {
	const merged = { ...( typeof metadata === 'string' ? { name: metadata } : metadata ), ...settings };
	const { name } = merged;

	if ( typeof name !== 'string' || ( ! NAME_PATTERN.test( name ) && ! CORE_LAYER_TYPES.includes( name ) ) ) {
		console.error( 'GoDAM: layer type names must be namespaced, for example "acme/countdown".' );
		return undefined;
	}

	return addLayerType( merged );
}

/**
 * Register a layer type that came through the pre-Layer-API add-on hooks
 * (`godam_video_editor_layer_options` and friends). Those types have
 * un-namespaced names, so they skip the name check. Not part of the public API.
 *
 * @param {Object} settings Layer type settings, including `name`.
 * @return {Object|undefined} The registered layer type.
 */
export function __unstableRegisterLegacyLayerType( settings ) {
	if ( typeof settings?.name !== 'string' || ! settings.name ) {
		return undefined;
	}
	return addLayerType( settings );
}

function addLayerType( merged ) {
	const { name } = merged;

	if ( select( store ).getLayerType( name ) ) {
		console.error( `GoDAM: layer type "${ name }" is already registered.` );
		return undefined;
	}

	/**
	 * Filters a layer type's settings before it is registered.
	 *
	 * @param {Object} settings Layer type settings.
	 * @param {string} name     Layer type name.
	 */
	const layerType = normalizeLayerType( { ...applyFilters( 'godam.layers.registerLayerType', merged, name ), name } );

	if ( typeof layerType.title !== 'string' || ! layerType.title ) {
		console.error( `GoDAM: layer type "${ name }" needs a title.` );
		return undefined;
	}

	dispatch( store ).addLayerType( layerType );
	return layerType;
}

/**
 * Unregister a layer type.
 *
 * @param {string} name Layer type name.
 * @return {Object|undefined} The removed layer type.
 */
export function unregisterLayerType( name ) {
	const layerType = select( store ).getLayerType( name );
	if ( ! layerType ) {
		console.error( `GoDAM: layer type "${ name }" is not registered.` );
		return undefined;
	}
	dispatch( store ).removeLayerType( name );
	return layerType;
}

/* eslint-enable no-console */

/**
 * @param {string} name Layer type name.
 * @return {Object|undefined} The registered layer type.
 */
export const getLayerType = ( name ) => select( store ).getLayerType( name );

/**
 * @return {Object[]} Every registered layer type, in registration order.
 */
export const getLayerTypes = () => select( store ).getLayerTypes();
