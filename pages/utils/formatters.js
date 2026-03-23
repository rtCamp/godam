/**
 * Format numbers to human-readable format (e.g., 1K, 2M, 1B)
 *
 * @param {number} num      - The number to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @return {string} Formatted number string
 */
export function formatNumber( num, decimals = 1 ) {
	if ( num === null || num === undefined || isNaN( num ) ) {
		return '0';
	}

	const absNum = Math.abs( num );

	if ( absNum >= 1_000_000_000 ) {
		return ( num / 1_000_000_000 ).toFixed( decimals ) + 'B';
	} else if ( absNum >= 1_000_000 ) {
		return ( num / 1_000_000 ).toFixed( decimals ) + 'M';
	} else if ( absNum >= 1_000 ) {
		return ( num / 1_000 ).toFixed( decimals ) + 'K';
	}

	return num.toString();
}

/**
 * Format watch time in seconds to human-readable format (e.g., 1d 2h 30m 45s)
 *
 * @param {number} seconds - The number of seconds
 * @return {string} Formatted time string
 */
export function formatWatchTime( seconds ) {
	if ( seconds === null || seconds === undefined || isNaN( seconds ) ) {
		return '0s';
	}

	const days = Math.floor( seconds / 86400 );
	const hrs = Math.floor( ( seconds % 86400 ) / 3600 );
	const mins = Math.floor( ( seconds % 3600 ) / 60 );
	const secs = Math.floor( seconds % 60 );

	const parts = [];
	if ( days > 0 ) {
		parts.push( `${ days }d` );
	}
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
 * Format watch time in seconds to display format with exact value on hover
 *
 * @param {number} seconds - The number of seconds
 * @return {Object} Object with display and exact values
 */
export function formatWatchTimeWithExact( seconds ) {
	const display = formatWatchTime( seconds );
	const exactSeconds = seconds?.toFixed( 2 ) || 0;
	return {
		display,
		exact: `${ exactSeconds }s`,
	};
}

/**
 * Format percentage values
 * For very high percentages (>100%), show as is but can be capped if needed
 *
 * @param {number} percentage - The percentage value
 * @param {number} decimals   - Number of decimal places (default: 2)
 * @return {string} Formatted percentage string
 */
export function formatPercentage( percentage, decimals = 2 ) {
	if ( percentage === null || percentage === undefined || isNaN( percentage ) ) {
		return '0%';
	}

	return `${ percentage.toFixed( decimals ) }%`;
}

/**
 * Format number with exact value for tooltip
 *
 * @param {number} num      - The number to format
 * @param {number} decimals - Number of decimal places for formatted number
 * @return {Object} Object with display and exact values
 */
export function formatNumberWithExact( num, decimals = 1 ) {
	if ( num === null || num === undefined || isNaN( num ) ) {
		return { display: '0', exact: '0' };
	}

	return {
		display: formatNumber( num, decimals ),
		exact: num.toLocaleString(),
	};
}
