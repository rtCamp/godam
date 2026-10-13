/**
 * Parse WebVTT or SRT text into ordered cues.
 *
 * Cue identifiers, the WEBVTT header, NOTE blocks and styling are ignored —
 * only timed text is returned. Shared by the audio block's front-end script
 * (view.js) and its editor preview (tabs.js).
 *
 * @param {string} raw The caption file contents.
 * @return {Array<{start:number,end:number,text:string}>} Ordered cues.
 */
export function parseCaptions( raw ) {
	if ( ! raw || typeof raw !== 'string' ) {
		return [];
	}

	const parseStamp = ( stamp ) => {
		if ( ! stamp ) {
			return NaN;
		}
		const parts = stamp.trim().replace( ',', '.' ).split( ':' );
		if ( parts.length < 2 || parts.length > 3 ) {
			return NaN;
		}
		const nums = parts.map( ( part ) => parseFloat( part ) );
		if ( nums.some( ( num ) => Number.isNaN( num ) ) ) {
			return NaN;
		}
		return nums.length === 3
			? ( nums[ 0 ] * 3600 ) + ( nums[ 1 ] * 60 ) + nums[ 2 ]
			: ( nums[ 0 ] * 60 ) + nums[ 1 ];
	};

	const cues = [];
	const blocks = raw.replace( /\r\n/g, '\n' ).replace( /\r/g, '\n' ).split( /\n{2,}/ );
	for ( const block of blocks ) {
		const lines = block.split( '\n' ).filter( ( line ) => line.trim() !== '' );
		const arrowIndex = lines.findIndex( ( line ) => line.includes( '-->' ) );
		if ( arrowIndex === -1 ) {
			continue;
		}
		const [ rawStart, rawRest ] = lines[ arrowIndex ].split( '-->' );
		const rawEnd = ( rawRest || '' ).trim().split( /\s+/ )[ 0 ];
		const start = parseStamp( rawStart );
		const end = parseStamp( rawEnd );
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
}
