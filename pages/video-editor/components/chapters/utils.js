/**
 * Shared helpers for the Chapters tab.
 *
 * Each chapter is a simple interval with an editable start and end
 * (`{ id, text, startTime, originalTime, endTime, originalEndTime }`). Chapters
 * must not overlap. `startTime` / `originalTime` remain the fields the player
 * reads (see `chaptersManager.js`); `endTime` / `originalEndTime` carry the
 * editable end.
 */

/**
 * Parse a timestamp string (`hh:mm:ss.ms`, `mm:ss`, or plain seconds) into a
 * number of seconds. Returns 0 for empty/invalid input.
 *
 * @param {string|number} input Timestamp to parse.
 * @return {number} Seconds.
 */
export const parseTimeToSeconds = ( input ) => {
	if ( ! input && input !== 0 ) {
		return 0;
	}

	// Already plain seconds (e.g. "12.5").
	if ( /^\d+(\.\d+)?$/.test( String( input ) ) ) {
		return parseFloat( input );
	}

	const parts = String( input ).split( ':' ).map( Number );
	if ( parts.some( isNaN ) ) {
		return 0;
	}

	let seconds = 0;
	if ( parts.length === 3 ) {
		seconds = ( parts[ 0 ] * 3600 ) + ( parts[ 1 ] * 60 ) + parts[ 2 ];
	} else if ( parts.length === 2 ) {
		seconds = ( parts[ 0 ] * 60 ) + parts[ 1 ];
	} else if ( parts.length === 1 ) {
		seconds = parts[ 0 ];
	}

	return parseFloat( seconds.toFixed( 2 ) );
};

/**
 * Format seconds as a compact clock for the chapter cards (e.g. `0:34`,
 * `1:00`, `1:02:09`). Seconds are floored — cards show whole-second ranges.
 *
 * @param {number} seconds Time in seconds.
 * @return {string} Clock string.
 */
export const formatClock = ( seconds ) => {
	const total = Math.max( 0, Math.floor( Number( seconds ) || 0 ) );
	const hrs = Math.floor( total / 3600 );
	const mins = Math.floor( ( total % 3600 ) / 60 );
	const secs = total % 60;
	const ss = String( secs ).padStart( 2, '0' );

	if ( hrs > 0 ) {
		return `${ hrs }:${ String( mins ).padStart( 2, '0' ) }:${ ss }`;
	}
	return `${ mins }:${ ss }`;
};

/**
 * Build display rows (`{ id, text, startSeconds, endSeconds }`) sorted by start.
 * Robust to older saved data with no `endTime`: such a chapter falls back to the
 * next chapter's start (or the video end for the last one).
 *
 * @param {Array}  chapters Stored chapters.
 * @param {number} duration Video duration, in seconds.
 * @return {Array} Sorted rows.
 */
export const getChapterRows = ( chapters, duration ) => {
	const sorted = [ ...chapters ].sort(
		( a, b ) => ( parseFloat( a.startTime ) || 0 ) - ( parseFloat( b.startTime ) || 0 ),
	);

	return sorted.map( ( chapter, index ) => {
		const startSeconds = parseFloat( chapter.startTime ) || 0;
		let endSeconds;
		if ( chapter.endTime !== undefined && chapter.endTime !== null && chapter.endTime !== '' ) {
			endSeconds = parseFloat( chapter.endTime );
		} else {
			const next = sorted[ index + 1 ];
			endSeconds = next ? ( parseFloat( next.startTime ) || 0 ) : ( duration || startSeconds );
		}
		return { id: chapter.id, text: chapter.text || '', startSeconds, endSeconds };
	} );
};
