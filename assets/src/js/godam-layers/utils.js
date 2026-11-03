/**
 * Helpers for working with registered layer types.
 */

const clone = ( value ) => ( value === undefined ? undefined : JSON.parse( JSON.stringify( value ) ) );

/**
 * Default attribute values for a new layer of this type, optionally for a
 * variation. Values are copied, so layers never share an array or object.
 *
 * @param {Object} layerType   Registered layer type.
 * @param {Object} [variation] One of the type's variations.
 * @return {Object} Attribute defaults.
 */
export function getDefaultAttributes( layerType, variation ) {
	const defaults = {};
	Object.entries( layerType?.attributes || {} ).forEach( ( [ key, schema ] ) => {
		if ( schema && 'default' in schema ) {
			defaults[ key ] = clone( schema.default );
		}
	} );
	return { ...defaults, ...clone( variation?.attributes || {} ) };
}

/**
 * The variation a saved layer uses: the one whose `attributes` all match the
 * layer, reading missing keys as their defaults. Undefined for a type with no
 * variations, or a layer that matches none.
 *
 * @param {Object} layerType Registered layer type.
 * @param {Object} layer     Saved layer.
 * @return {Object|undefined} The matching variation.
 */
export function getLayerVariation( layerType, layer ) {
	const defaults = getDefaultAttributes( layerType );
	return ( layerType?.variations || [] ).find( ( variation ) =>
		Object.entries( variation.attributes || {} ).every( ( [ key, value ] ) => ( layer?.[ key ] ?? defaults[ key ] ) === value ),
	);
}

/**
 * The variation a new layer gets when none is chosen: the one marked
 * `isDefault`, else the first.
 *
 * @param {Object} layerType Registered layer type.
 * @return {Object|undefined} The default variation.
 */
export function getDefaultVariation( layerType ) {
	const variations = layerType?.variations || [];
	return variations.find( ( variation ) => variation.isDefault ) || variations[ 0 ];
}

/**
 * Whether a variation can be used right now (e.g. its form plugin is active).
 *
 * @param {Object} variation A layer type variation.
 * @return {boolean} True when available.
 */
export function isVariationAvailable( variation ) {
	return typeof variation?.isAvailable === 'function' ? variation.isAvailable() !== false : true;
}

/**
 * Whether a layer type can be added right now, and why not.
 *
 * @param {Object} layerType Registered layer type.
 * @param {Object} context   `{ videoConfig, mediaType }` from the editor.
 * @return {{available: boolean, reason?: string, disablesExisting?: boolean}} Availability.
 */
export function getAvailability( layerType, context = {} ) {
	const availability = typeof layerType?.getAvailability === 'function' ? layerType.getAvailability( context ) : null;
	return { available: true, ...( availability || {} ) };
}

/**
 * Whether a layer type works on this kind of media.
 *
 * @param {Object} layerType Registered layer type.
 * @param {string} mediaType `video`, `audio` or `image`.
 * @return {boolean} True when supported.
 */
export function supportsMedia( layerType, mediaType ) {
	return ( layerType?.supports?.media || [] ).includes( mediaType );
}
