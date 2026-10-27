/**
 * Helpers for `[ start, end ]` time-range arrays (seconds).
 *
 * Used to keep playback that happened while a player was out of view and
 * auto-muted out of the heatmap (see managers/visibilityManager.js and
 * analytics.js `collectPlayedRanges()`).
 */

/**
 * Sort and merge overlapping or touching ranges.
 *
 * @param {Array<Array<number>>} ranges - `[ start, end ]` pairs.
 * @return {Array<Array<number>>} New merged, sorted array.
 */
export function mergeRanges( ranges ) {
	const sorted = ( ranges || [] )
		.filter( ( r ) => Array.isArray( r ) && r[ 1 ] > r[ 0 ] )
		.map( ( r ) => [ r[ 0 ], r[ 1 ] ] )
		.sort( ( a, b ) => a[ 0 ] - b[ 0 ] );

	const merged = [];
	sorted.forEach( ( range ) => {
		const last = merged[ merged.length - 1 ];
		if ( last && range[ 0 ] <= last[ 1 ] ) {
			last[ 1 ] = Math.max( last[ 1 ], range[ 1 ] );
		} else {
			merged.push( range );
		}
	} );
	return merged;
}

/**
 * Add one range to a list, keeping it merged.
 *
 * @param {Array<Array<number>>} ranges - Existing ranges.
 * @param {number}               start  - Range start.
 * @param {number}               end    - Range end.
 * @return {Array<Array<number>>} New merged array.
 */
export function addRange( ranges, start, end ) {
	return mergeRanges( [ ...( ranges || [] ), [ start, end ] ] );
}

/**
 * Remove every part of `ranges` covered by `remove`.
 *
 * @param {Array<Array<number>>} ranges - Ranges to keep from.
 * @param {Array<Array<number>>} remove - Ranges to cut out.
 * @return {Array<Array<number>>} New merged array.
 */
export function subtractRanges( ranges, remove ) {
	const cuts = mergeRanges( remove );
	let result = mergeRanges( ranges );

	cuts.forEach( ( [ cutStart, cutEnd ] ) => {
		const next = [];
		result.forEach( ( [ start, end ] ) => {
			if ( cutEnd <= start || cutStart >= end ) {
				next.push( [ start, end ] );
				return;
			}
			if ( cutStart > start ) {
				next.push( [ start, cutStart ] );
			}
			if ( cutEnd < end ) {
				next.push( [ cutEnd, end ] );
			}
		} );
		result = next;
	} );

	return result;
}
