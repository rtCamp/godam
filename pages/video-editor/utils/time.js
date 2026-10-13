/**
 * Time formatting helpers shared across layer-config sections (Start Time
 * fields in TriggerSection and the hotspot Duration section).
 */

/**
 * Format a seconds value as `m:ss`.
 *
 * @param {number} seconds Time in seconds.
 * @return {string} Clock-formatted string.
 */
export const formatClock = ( seconds ) => {
	const total = Math.max( 0, Math.floor( Number( seconds ) || 0 ) );
	const mins = Math.floor( total / 60 );
	const secs = total % 60;
	return `${ mins }:${ secs < 10 ? '0' : '' }${ secs }`;
};

/**
 * Parse a `m:ss` (or plain seconds) string to seconds.
 *
 * @param {string} value Clock string.
 * @return {number} Seconds.
 */
export const parseClock = ( value ) => {
	if ( typeof value !== 'string' ) {
		return Number( value ) || 0;
	}
	const parts = value.split( ':' ).map( ( p ) => p.trim() );
	if ( parts.length === 2 ) {
		const mins = parseInt( parts[ 0 ], 10 ) || 0;
		const secs = parseInt( parts[ 1 ], 10 ) || 0;
		return ( mins * 60 ) + secs;
	}
	return parseInt( parts[ 0 ], 10 ) || 0;
};
