/**
 * Helpers for the Transcription tab: parsing WebVTT / SRT caption files into
 * cue objects and formatting clocks / file sizes for display.
 */

/**
 * Parse a single timestamp (`HH:MM:SS.mmm`, `MM:SS.mmm`, or the SRT comma
 * variant) into seconds.
 *
 * @param {string} stamp Raw timestamp.
 * @return {number} Seconds (float), or NaN when unparseable.
 */
const parseTimestamp = ( stamp ) => {
	if ( ! stamp ) {
		return NaN;
	}
	// SRT uses a comma before milliseconds; normalise to a dot.
	const parts = stamp.trim().replace( ',', '.' ).split( ':' );
	if ( parts.length < 2 || parts.length > 3 ) {
		return NaN;
	}
	const nums = parts.map( ( part ) => parseFloat( part ) );
	if ( nums.some( ( num ) => Number.isNaN( num ) ) ) {
		return NaN;
	}
	if ( nums.length === 3 ) {
		return ( nums[ 0 ] * 3600 ) + ( nums[ 1 ] * 60 ) + nums[ 2 ];
	}
	return ( nums[ 0 ] * 60 ) + nums[ 1 ];
};

/**
 * Parse WebVTT or SRT text into an array of cues. Cue identifiers, the
 * `WEBVTT` header, NOTE blocks and styling are ignored — only timed text is
 * returned.
 *
 * @param {string} raw The caption file contents.
 * @return {Array<{start:number,end:number,text:string}>} Ordered cues.
 */
export const parseCaptions = ( raw ) => {
	if ( ! raw || typeof raw !== 'string' ) {
		return [];
	}

	const cues = [];
	// Blocks are separated by one or more blank lines. Normalise line endings.
	const blocks = raw.replace( /\r\n/g, '\n' ).replace( /\r/g, '\n' ).split( /\n{2,}/ );

	for ( const block of blocks ) {
		const lines = block.split( '\n' ).filter( ( line ) => line.trim() !== '' );
		const arrowIndex = lines.findIndex( ( line ) => line.includes( '-->' ) );
		if ( arrowIndex === -1 ) {
			continue;
		}

		const [ rawStart, rawRest ] = lines[ arrowIndex ].split( '-->' );
		// The end timestamp may be followed by cue settings (e.g. `align:start`).
		const rawEnd = ( rawRest || '' ).trim().split( /\s+/ )[ 0 ];

		const start = parseTimestamp( rawStart );
		const end = parseTimestamp( rawEnd );
		if ( Number.isNaN( start ) ) {
			continue;
		}

		const text = lines.slice( arrowIndex + 1 ).join( ' ' ).trim();
		if ( text === '' ) {
			continue;
		}

		cues.push( { start, end: Number.isNaN( end ) ? start : end, text } );
	}

	return cues;
};

/**
 * Format seconds as a clock (`m:ss`, or `h:mm:ss` past an hour).
 *
 * @param {number} seconds Seconds.
 * @return {string} Clock string.
 */
export const formatClock = ( seconds ) => {
	if ( seconds === null || seconds === undefined || Number.isNaN( seconds ) ) {
		return '0:00';
	}
	const total = Math.max( 0, Math.floor( seconds ) );
	const hrs = Math.floor( total / 3600 );
	const mins = Math.floor( ( total % 3600 ) / 60 );
	const secs = total % 60;
	const pad = ( value ) => String( value ).padStart( 2, '0' );
	if ( hrs > 0 ) {
		return `${ hrs }:${ pad( mins ) }:${ pad( secs ) }`;
	}
	return `${ mins }:${ pad( secs ) }`;
};

/**
 * Human-readable file size.
 *
 * @param {number} bytes Byte count.
 * @return {string} e.g. `56.2 MB`, or '' when unknown.
 */
export const formatBytes = ( bytes ) => {
	if ( ! bytes || Number.isNaN( bytes ) ) {
		return '';
	}
	const units = [ 'B', 'KB', 'MB', 'GB' ];
	let value = bytes;
	let unit = 0;
	while ( value >= 1024 && unit < units.length - 1 ) {
		value /= 1024;
		unit += 1;
	}
	return `${ value.toFixed( unit === 0 ? 0 : 1 ) } ${ units[ unit ] }`;
};

/**
 * Whether a SaaS transcription status string means a job is still running.
 *
 * @param {string} status Status from the API.
 * @return {boolean} True while transcribing.
 */
export const isTranscribingStatus = ( status ) => status === 'Transcribing' || status === 'Transcoding';
