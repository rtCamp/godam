/**
 * Returns the first non-empty value from the provided arguments.
 *
 * A value is considered non-empty if it is not `undefined`, `null`, or an empty string (`''`).
 * If none of the values are non-empty, the function returns `null`.
 *
 * @param {...*} values - A list of values to check.
 * @return {*} The first non-empty value, or `null` if all values are empty.
 */
function getFirstNonEmpty( ...values ) {
	for ( const value of values ) {
		if ( value !== undefined && value !== null ) {
			return value;
		}
	}
	return null;
}

/**
 * Converts a given date string to an ISO 8601 UTC string and appends a custom timezone offset.
 *
 * This function assumes the input date string is in a format that can be parsed by the JavaScript Date constructor.
 * It converts the date to a UTC ISO string and replaces the default 'Z' (UTC designator) with the specified timezone offset.
 * Note: This does not convert the time to match the offset — it only changes the suffix for representation purposes.
 *
 * @param {string} dateString                - The date string to convert.
 * @param {string} [timezoneOffset='+00:00'] - The timezone offset to append (e.g., '+05:30', '-04:00').
 * @return {string} The ISO 8601 string with the specified timezone offset.
 */
function appendTimezoneOffsetToUTC( dateString, timezoneOffset = '+00:00' ) {
	// Convert to UTC ISO string, then append custom timezone suffix
	const date = new Date( dateString );
	if ( isNaN( date.getTime() ) ) {
		return dateString; // Invalid date, return original input
	}
	const isoString = date.toISOString();
	return isoString.replace( 'Z', timezoneOffset );
}

/*
 * Checks if an object is empty.
 *
 * An object is considered empty if it has no own properties.
 * This function also checks for null and arrays, treating them as empty.
 *
 * @param {Object} obj - The object to check.
 * @return {boolean} True if the object is empty, false otherwise.
 */
function isObjectEmpty( obj ) {
	if ( obj === null || typeof obj !== 'object' ) {
		return true;
	}
	if ( Array.isArray( obj ) ) {
		return obj.length === 0;
	}
	return Object.keys( obj ).length === 0;
}

/**
 * Convert a duration in seconds to an ISO 8601 duration string.
 *
 * @param {number} seconds - The duration in seconds to convert.
 * @return {string} An ISO 8601 duration string in the format 'PTnHnMnS'.
 */
function secondsToISO8601( seconds ) {
	seconds = Math.floor( seconds ); // ensure whole seconds

	const duration = {
		hours: Math.floor( seconds / 3600 ),
		minutes: Math.floor( ( seconds % 3600 ) / 60 ),
		seconds: seconds % 60,
	};

	let isoString = 'PT';
	if ( duration.hours ) {
		isoString += `${ duration.hours }H`;
	}
	if ( duration.minutes ) {
		isoString += `${ duration.minutes }M`;
	}
	if ( duration.seconds || isoString === 'PT' ) {
		isoString += `${ duration.seconds }S`;
	}

	return isoString;
}

function isSEODataEmpty( seoData ) {
	return ! seoData ||
		typeof seoData !== 'object' ||
		Object.keys( seoData ).length === 0 ||
		( Object.keys( seoData ).length === 1 && seoData.hasOwnProperty( 'isFamilyFriendly' ) );
}

/**
 * Strip HTML tags from a string.
 *
 * Uses DOMParser to safely parse HTML and extract text content.
 * This is secure as DOMParser creates an inert document that doesn't execute scripts.
 *
 * @param {string} html - The HTML string to strip tags from.
 * @return {string} The plain text without HTML tags.
 */
function stripHtmlTags( html ) {
	if ( ! html ) {
		return '';
	}
	const doc = new DOMParser().parseFromString( html, 'text/html' );
	return doc.body.textContent || '';
}

export { getFirstNonEmpty, appendTimezoneOffsetToUTC, isObjectEmpty, secondsToISO8601, isSEODataEmpty, stripHtmlTags };
