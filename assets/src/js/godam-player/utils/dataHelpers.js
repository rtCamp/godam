/**
 * Data Helper Utilities
 * Common helper functions for data parsing and manipulation
 */

/**
 * Parse data attribute safely from a video element
 *
 * @param {HTMLElement} element      - HTML element containing the dataset
 * @param {string}      attribute    - Data attribute to parse
 * @param {*}           defaultValue - Default value if parsing fails
 * @return {*} Parsed value or default
 */
export function parseDataAttribute( element, attribute, defaultValue ) {
	try {
		return element.dataset[ attribute ] ? JSON.parse( element.dataset[ attribute ] ) : defaultValue;
	} catch {
		return defaultValue;
	}
}

/**
 * Format time in MM:SS or HH:MM:SS format
 *
 * @param {number} seconds - Time in seconds
 * @return {string} Formatted time string
 */
export function formatTime( seconds ) {
	if ( seconds >= 3600 ) {
		// HH:MM:SS format
		const hours = Math.floor( seconds / 3600 );
		const mins = Math.floor( ( seconds % 3600 ) / 60 );
		const secs = Math.floor( seconds % 60 );
		return `${ hours }:${ mins.toString().padStart( 2, '0' ) }:${ secs.toString().padStart( 2, '0' ) }`;
	}
	// MM:SS format
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
	const match = /^(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)$/.exec( timeString );
	if ( ! match ) {
		return false;
	}
	const hours = match[ 1 ] !== undefined ? Number( match[ 1 ] ) : undefined;
	if ( hours !== undefined && ( hours < 0 || hours > 23 ) ) {
		return false;
	}
	const minutes = Number( match[ 2 ] );
	if ( minutes < 0 || minutes > 59 ) {
		return false;
	}
	const seconds = Number( match[ 3 ] );
	if ( seconds < 0 || seconds > 59 ) {
		return false;
	}
	return true;
}
