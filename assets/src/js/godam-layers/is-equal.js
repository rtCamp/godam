/**
 * Whether two JSON-like values are equal by value, so a variation whose
 * attributes hold an array or object still matches a layer loaded from saved
 * data (a different object with the same contents). Shared by the editor
 * registry and the front-end runtime registry.
 *
 * @param {*} a A value.
 * @param {*} b Another value.
 * @return {boolean} True when they hold the same data.
 */
export function isEqual( a, b ) {
	if ( a === b ) {
		return true;
	}
	if ( ! a || ! b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray( a ) !== Array.isArray( b ) ) {
		return false;
	}
	const keys = Object.keys( a );
	return keys.length === Object.keys( b ).length &&
		keys.every( ( key ) => Object.prototype.hasOwnProperty.call( b, key ) && isEqual( a[ key ], b[ key ] ) );
}
