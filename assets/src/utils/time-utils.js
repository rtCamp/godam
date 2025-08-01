/**
 * Format a number of seconds into a time string.
 *
 * @param {number} seconds - The total number of seconds to format.
 *
 * @return {string} The formatted time string.
 */
export function formatTime( seconds ) {
	if ( seconds >= 3600 ) {
		const hours = Math.floor( seconds / 3600 );
		const mins = Math.floor( ( seconds % 3600 ) / 60 );
		const secs = Math.floor( seconds % 60 );
		return `${ hours }:${ mins.toString().padStart( 2, '0' ) }:${ secs.toString().padStart( 2, '0' ) }`;
	}
	const mins = Math.floor( seconds / 60 );
	const secs = Math.floor( seconds % 60 );
	return `${ mins }:${ secs.toString().padStart( 2, '0' ) }`;
}

/**
 * Parse a time string in "MM:SS" or "HH:MM:SS" format into total seconds.
 *
 * @param {string} timeString - The time string to parse.
 *
 * @return {number} The total number of seconds. Returns 0 if invalid.
 */
export function parseTime( timeString ) {
	if ( ! validateTimeString( timeString ) ) {
		return 0;
	}
	const parts = timeString.split( ':' ).map( Number );
	if ( parts.length === 3 ) {
		const [ hours, minutes, seconds ] = parts;
		return ( hours * 3600 ) + ( minutes * 60 ) + seconds;
	} else if ( parts.length === 2 ) {
		const [ minutes, seconds ] = parts;
		return ( minutes * 60 ) + seconds;
	}
	return 0;
}

/**
 * Validate whether a string is in "MM:SS" or "HH:MM:SS" format.
 *
 * @param {string} timeString - The time string to validate.
 *
 * @return {boolean} True if valid, false otherwise.
 */
export function validateTimeString( timeString ) {
	return /^(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)$/.test( timeString );
}
