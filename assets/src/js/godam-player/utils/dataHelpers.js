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
