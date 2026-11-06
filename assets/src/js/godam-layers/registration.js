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
import { CORE_LAYER_TYPES, DEFAULT_SUPPORTS, LEGACY_LAYER_TYPE_NAMES, MANAGED_KEYS, NAME_PATTERN, SHARED_KEYS } from './constants';

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
	const normalized = {
		apiVersion: 1,
		description: '',
		...rest,
		label: rest.label || rest.title,
		icon: isUrl( icon ) ? undefined : icon,
		iconUrl: iconUrl || ( isUrl( icon ) ? icon : undefined ),
		supports: { ...DEFAULT_SUPPORTS, ...( supports || {} ) },
		attributes: sanitizeAttributes( rest.name, attributes ),
	};
	normalized.variations = ( Array.isArray( variations ) ? variations : [] ).map( ( variation ) => normalizeVariation( normalized, variation ) );
	return normalized;
}

/**
 * Give a variation the attributes that select it. A type that sets
 * `variationAttribute` (Form uses `form_type`) gets `{ [ variationAttribute ]: name }`
 * for any variation that doesn't set its own `attributes`.
 *
 * @param {Object} layerType The layer type the variation belongs to.
 * @param {Object} variation The variation.
 * @return {Object} The variation, with `attributes`.
 */
function normalizeVariation( layerType, variation ) {
	if ( variation.attributes || ! layerType.variationAttribute ) {
		return { attributes: {}, ...variation };
	}
	return { ...variation, attributes: { [ layerType.variationAttribute ]: variation.name } };
}

// Variations registered before their layer type, applied when it registers.
const pendingVariations = {};

/**
 * The metadata a layer type registered in PHP, sent to the editor as
 * `godamVideoEditorConfig.layerTypes`.
 *
 * @param {string} name Layer type name.
 * @return {Object} The metadata, or an empty object.
 */
function getServerMetadata( name ) {
	const server = typeof window !== 'undefined' ? window.godamVideoEditorConfig?.layerTypes?.[ name ] : undefined;
	return server && typeof server === 'object' ? server : {};
}

/**
 * The strings PHP translated from a type's `layer.json`.
 *
 * @param {Object} server Server metadata.
 * @return {Object} Its `title` and `description`, when set.
 */
function pickTranslated( server ) {
	return [ 'title', 'description' ].reduce( ( picked, key ) => {
		if ( typeof server[ key ] === 'string' && server[ key ] !== '' ) {
			picked[ key ] = server[ key ];
		}
		return picked;
	}, {} );
}

/**
 * Register a layer type.
 *
 * @param {Object|string} metadata Contents of the type's `layer.json`, or just its name.
 * @param {Object}        settings Editor settings: `edit`, `icon`, `getAvailability`, `validate`, `variations`, translated `title`/`description`, and so on.
 * @return {Object|undefined} The registered layer type, or undefined when registration failed.
 */
export function registerLayerType( metadata, settings = {} ) {
	const own = typeof metadata === 'string' ? { name: metadata } : metadata;
	// Metadata the type registered in PHP (`godam_register_layer_type()`) fills
	// in what the script doesn't pass, so an add-on can register by name. PHP
	// translates the layer.json strings, so its title and description win over
	// the untranslated ones in `metadata`; `settings` still win over both.
	const server = getServerMetadata( own?.name );
	const merged = { ...server, ...own, ...pickTranslated( server ), ...settings };
	const { name } = merged;

	if ( typeof name !== 'string' || ( ! NAME_PATTERN.test( name ) && ! CORE_LAYER_TYPES.includes( name ) && ! LEGACY_LAYER_TYPE_NAMES.includes( name ) ) ) {
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
	const filtered = applyFilters( 'godam.layers.registerLayerType', merged, name );
	const layerType = normalizeLayerType( {
		...filtered,
		name,
		variations: [ ...( filtered.variations || [] ), ...( pendingVariations[ name ] || [] ) ],
	} );
	delete pendingVariations[ name ];

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

/**
 * Register a variation of a layer type, such as a form plugin for the Form
 * layer. When the type isn't registered yet, the variation is kept and added
 * when it is, so scripts can load in any order.
 *
 * A variation has a `name` and `title`, plus whatever its type reads; a form
 * provider adds `icon`, `isAvailable`, `edit` or `getForms`/`getFormHtml`,
 * `idField` and `settingsUrl`.
 *
 * @param {string} typeName  Layer type name, e.g. `form`.
 * @param {Object} variation The variation.
 * @return {Object|undefined} The registered variation, or undefined when registration failed.
 */
export function registerLayerVariation( typeName, variation ) {
	const name = variation?.name;
	if ( typeof name !== 'string' || ! name ) {
		console.error( `GoDAM: a "${ typeName }" variation needs a name.` );
		return undefined;
	}
	if ( typeof variation.title !== 'string' || ! variation.title ) {
		console.error( `GoDAM: the "${ typeName }" variation "${ name }" needs a title.` );
		return undefined;
	}

	const layerType = select( store ).getLayerType( typeName );
	const existing = layerType ? layerType.variations : ( pendingVariations[ typeName ] || [] );
	if ( existing.some( ( v ) => v.name === name ) ) {
		console.error( `GoDAM: the "${ typeName }" variation "${ name }" is already registered.` );
		return undefined;
	}

	if ( ! layerType ) {
		pendingVariations[ typeName ] = [ ...existing, variation ];
		return variation;
	}

	const normalized = normalizeVariation( layerType, variation );
	dispatch( store ).addLayerType( { ...layerType, variations: [ ...layerType.variations, normalized ] } );
	return normalized;
}

/**
 * Unregister a variation of a layer type.
 *
 * @param {string} typeName      Layer type name.
 * @param {string} variationName Variation name.
 * @return {Object|undefined} The removed variation.
 */
export function unregisterLayerVariation( typeName, variationName ) {
	const layerType = select( store ).getLayerType( typeName );
	const variation = layerType?.variations.find( ( v ) => v.name === variationName );
	if ( ! variation ) {
		console.error( `GoDAM: the "${ typeName }" variation "${ variationName }" is not registered.` );
		return undefined;
	}
	dispatch( store ).addLayerType( { ...layerType, variations: layerType.variations.filter( ( v ) => v !== variation ) } );
	return variation;
}

/* eslint-enable no-console */

/**
 * @param {string} typeName      Layer type name.
 * @param {string} variationName Variation name.
 * @return {Object|undefined} The registered variation.
 */
export const getLayerVariationByName = ( typeName, variationName ) =>
	select( store ).getLayerType( typeName )?.variations.find( ( v ) => v.name === variationName );

/**
 * @param {string} name Layer type name.
 * @return {Object|undefined} The registered layer type.
 */
export const getLayerType = ( name ) => select( store ).getLayerType( name );

/**
 * @return {Object[]} Every registered layer type, in registration order.
 */
export const getLayerTypes = () => select( store ).getLayerTypes();
