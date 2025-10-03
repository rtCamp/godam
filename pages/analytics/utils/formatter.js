/**
 * Format time in MM:SS format
 *
 * @param {number} seconds - Time in seconds
 * @return {string} Formatted time string
 */
function formatTime( seconds ) {
	const minutes = Math.floor( seconds / 60 );
	const remainingSeconds = seconds % 60;
	return `${ minutes }:${ remainingSeconds.toString().padStart( 2, '0' ) }`;
}

/**
 * Format numbers with comma separators
 *
 * @param {number} num - Number to format
 * @return {string} Formatted number string
 */
function formatNumber( num ) {
	return num.toString().replace( /\B(?=(\d{3})+(?!\d))/g, ',' );
}

/**
 * Format watch time in human readable format (h/m/s)
 *
 * @param {number} seconds - Time in seconds
 * @return {string} Formatted watch time string
 */
function formatWatchTime( seconds ) {
	const hrs = Math.floor( seconds / 3600 );
	const mins = Math.floor( ( seconds % 3600 ) / 60 );
	const secs = Math.floor( seconds % 60 );

	const parts = [];
	if ( hrs > 0 ) {
		parts.push( `${ hrs }h` );
	}
	if ( mins > 0 ) {
		parts.push( `${ mins }m` );
	}
	if ( secs > 0 || parts.length === 0 ) {
		parts.push( `${ secs }s` );
	}

	return parts.join( ' ' );
}

/**
 * Render change percentage with proper formatting
 *
 * @param {number} changeValue - Change value
 * @return {string} Formatted change string
 */
function renderChange( changeValue ) {
	const rounded = Math.abs( changeValue ).toFixed( 2 );
	const prefix = changeValue >= 0 ? '+' : '-';
	return `${ prefix }${ rounded }%`;
}

export {
	formatTime,
	formatNumber,
	formatWatchTime,
	renderChange,
};
