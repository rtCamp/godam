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

/**
 * Get the file name (without folders or query string) from a URL or path.
 *
 * @param {string} url - URL or path.
 * @return {string} File name, e.g. "my-video_final.mp4", or ''.
 */
function getFileNameFromUrl( url ) {
	if ( ! url || typeof url !== 'string' ) {
		return '';
	}

	const path = url.split( /[?#]/ )[ 0 ];
	const name = path.substring( path.lastIndexOf( '/' ) + 1 );

	try {
		return decodeURIComponent( name );
	} catch {
		return name;
	}
}

/**
 * Remove a trailing file extension, e.g. "clip.final.mp4" -> "clip.final".
 *
 * @param {string} name - File name.
 * @return {string} Name without the last extension.
 */
function stripFileExtension( name ) {
	return String( name || '' ).replace( /\.[a-z0-9]{2,5}$/i, '' );
}

/**
 * Normalize a title or file name for comparison: lower case, and runs of
 * spaces, hyphens and underscores collapsed to "-".
 *
 * WordPress builds the title from the uploaded name with its spaces but saves
 * the file with hyphens, e.g. title "Screen Recording 2024-01-15 at 10.30.45"
 * and file "Screen-Recording-2024-01-15-at-10.30.45.mov"; both normalize to
 * the same string.
 *
 * @param {string} value - Title or file name.
 * @return {string} Normalized value.
 */
function normalizeForFileNameComparison( value ) {
	return String( value || '' ).trim().toLowerCase()
		.replace( /[\s_-]+/g, '-' )
		.replace( /^-+|-+$/g, '' );
}

/**
 * Whether a video title looks like a raw file name rather than a real title.
 *
 * A single hyphen or underscore is not enough on its own: real titles such as
 * "Spider-Man", "COVID-19", "e-commerce", "Add-ons", "Q3_review" or
 * "Paris-2024" have one. A title is flagged when it matches the video's file
 * name (ignoring case, the extension, and the difference between spaces,
 * hyphens and underscores). A title with no spaces is also flagged when it
 * has two or more hyphens/underscores ("product-demo_v2"), is a camera or
 * phone file name ("IMG_2041", "DSC-0001", "PXL_20240115"), or ends in a
 * video file extension ("clip.mp4").
 *
 * @param {string} title      - Video title / SEO headline.
 * @param {string} [fileName] - The video's file name or URL, if known.
 * @return {boolean} True when the title looks like a file name.
 */
function isFilenameLikeTitle( title, fileName = '' ) {
	const trimmed = String( title || '' ).trim();

	if ( ! trimmed ) {
		return false;
	}

	const baseName = getFileNameFromUrl( fileName );
	if ( baseName ) {
		const normalizedTitle = normalizeForFileNameComparison( trimmed );
		const normalizedFile = normalizeForFileNameComparison( baseName );
		const normalizedFileNoExtension = normalizeForFileNameComparison( stripFileExtension( baseName ) );

		if ( normalizedTitle && ( normalizedTitle === normalizedFile || normalizedTitle === normalizedFileNoExtension ) ) {
			return true;
		}
	}

	if ( /\s/.test( trimmed ) ) {
		return false;
	}

	// Two or more separators, e.g. "product-demo_v2".
	if ( ( trimmed.match( /[-_]/g ) || [] ).length >= 2 ) {
		return true;
	}

	// Camera / phone naming, e.g. "IMG_2041", "DSC-0001", "VID_20240115", "PXL_20240115".
	if ( /^(img|vid|dsc|dscn|mvi|pxl|mov|dji|gopr|gp)[-_]?\d{3,}$/i.test( trimmed ) ) {
		return true;
	}

	// A single word ending in a video file extension, e.g. "IMG2041.mp4".
	if ( /\.(mp4|mov|m4v|webm|mkv|avi|wmv|flv|mpe?g|3gp|ogv|m3u8|mpd)$/i.test( trimmed ) ) {
		return true;
	}

	return false;
}

export { getFirstNonEmpty, appendTimezoneOffsetToUTC, isObjectEmpty, secondsToISO8601, isSEODataEmpty, stripHtmlTags, getFileNameFromUrl, isFilenameLikeTitle };
