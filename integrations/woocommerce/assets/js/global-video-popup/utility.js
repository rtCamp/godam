/**
 * GoDAM Utility Helpers
 *
 * Contains small reusable helper functions used across
 * the video modal system.
 *
 * - isSafari(): Detects whether the current browser is Safari.
 * - parseTimestamp(): Converts timestamp strings into seconds.
 */

/**
 * Checks if the current browser is Safari.
 *
 * This function uses the `navigator.userAgent` string to detect
 * whether the user is browsing with Safari. It excludes Chrome
 * and Android browsers to avoid false positives.
 *
 * @return {boolean} True if the browser is Safari, false otherwise.
 */
export function isSafari() {
	return /^((?!chrome|android).)*safari/i.test( navigator.userAgent );
}

/**
 * Parses a raw timestamp string and converts it into total seconds.
 *
 * - If the input is falsy (e.g. null, undefined, empty), returns 0.
 * - If the input contains a colon (`:`), it is treated as a time format (`hh:mm:ss` or `mm:ss`) and converted to seconds using a reducer.
 * - If the input is a plain number string (e.g. `"12.5"`), it is parsed as a float.
 *
 * @param {string} raw - The raw timestamp string (e.g. "1:30", "00:01:45", "12.5").
 * @return {number} The total number of seconds as a float.
 */
export function parseTimestamp( raw ) {
	if ( ! raw ) {
		return 0;
	}
	if ( raw.includes( ':' ) ) {
		return raw.split( ':' ).reduce( ( acc, time ) => ( 60 * acc ) + Number( time ), 0 );
	}
	return parseFloat( raw );
}
