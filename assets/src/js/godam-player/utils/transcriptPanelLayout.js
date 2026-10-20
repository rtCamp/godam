/**
 * Pure helpers for the transcript panel: where it goes when it opens, and how
 * a search query maps onto cue text. Kept free of the DOM so they can be unit
 * tested; TranscriptPanelManager does the measuring and applies the result.
 */

// Panel width beside the video: a share of the space, within these bounds.
export const PANEL_MIN_WIDTH = 260;
export const PANEL_MAX_WIDTH = 420;
export const PANEL_WIDTH_RATIO = 0.32;

// The video only shrinks beside the panel while it stays at least this wide
// (below 480px the player switches to its compact, mobile control layout) or
// keeps this share of its full size; otherwise the panel drops beneath it.
export const MIN_PLAYER_WIDTH = 480;
export const MIN_PLAYER_SCALE = 0.75;

// Height of the panel when it sits beneath the video.
export const BELOW_MIN_HEIGHT = 220;
export const BELOW_MAX_HEIGHT = 360;
export const BELOW_HEIGHT_RATIO = 0.6;

// A narrow (portrait) video widens toward this shape when the panel opens.
const WIDE_RATIO = 16 / 9;

// Where the height is capped (the lightbox), the video keeps at least this
// share of it when it has to shrink to make room for the panel beneath.
const MIN_STAGE_SHARE = 0.5;

const clamp = ( value, min, max ) => Math.min( Math.max( value, min ), max );

/**
 * Decide how the open panel shares space with the video, so that no part of
 * the video is ever covered.
 *
 * `side`: the panel sits beside the video and the stage keeps its height.
 * The stage widens into free room in the column when it can (a portrait video
 * grows toward 16:9 and keeps its full size); otherwise the video scales down
 * to fit beside the panel, letterboxed and never cropped.
 *
 * `below`: the video would get too small beside the panel (a 16:9 video in a
 * typical content column), so the panel stacks beneath the full-size video.
 * Where the height is capped (`maxHeight`, the lightbox, which cannot
 * scroll), the video shrinks so that it and the panel both fit.
 *
 * @param {Object} geometry             Closed-state geometry, in px.
 * @param {number} geometry.stageWidth  Width of the video stage.
 * @param {number} geometry.stageHeight Height of the video stage.
 * @param {number} geometry.ratio       Video aspect ratio (width / height).
 * @param {number} geometry.room        Widest the stage may grow to.
 * @param {number} [geometry.maxHeight] Tallest the stage plus a panel beneath may be (0: no cap).
 * @return {Object} The layout. Side: `mode`, `width`, `expandBy`, `panelWidth`, `stageHeight`, `playerWidth`, `playerHeight`, `playerTop`. Below: `mode`, `width`, `panelHeight`.
 */
export function computeTranscriptLayout( { stageWidth, stageHeight, ratio, room, maxHeight = 0 } ) {
	const below = () => {
		const panelHeight = clamp( Math.round( ( stageHeight || 0 ) * BELOW_HEIGHT_RATIO ), BELOW_MIN_HEIGHT, BELOW_MAX_HEIGHT );
		if ( ! maxHeight || ! ratio || stageHeight + panelHeight <= maxHeight ) {
			return { mode: 'below', width: stageWidth, panelHeight };
		}
		// Too tall for the cap: shrink the video, but not below half the cap,
		// and give the panel what is left.
		const fitHeight = Math.max( maxHeight - panelHeight, maxHeight * MIN_STAGE_SHARE );
		return { mode: 'below', width: Math.min( stageWidth, fitHeight * ratio ), panelHeight: Math.round( maxHeight - fitHeight ) };
	};

	if ( ! stageWidth || ! stageHeight || ! ratio ) {
		return below();
	}

	const reach = Math.max( stageWidth, room || 0 );
	// Size the panel from the stage it will end up in, so a narrow portrait
	// stage that widens gets a panel sized for the wider shape.
	const panelBasis = Math.max( stageWidth, Math.min( reach, stageHeight * WIDE_RATIO ) );
	const panelWidth = clamp( Math.round( panelBasis * PANEL_WIDTH_RATIO ), PANEL_MIN_WIDTH, PANEL_MAX_WIDTH );

	// Widest the video can be at the stage's height.
	const fullPlayerWidth = stageHeight * ratio;
	const width = Math.max( stageWidth, Math.min( fullPlayerWidth + panelWidth, reach ) );
	const playerWidth = Math.min( fullPlayerWidth, width - panelWidth );

	if ( playerWidth < Math.min( MIN_PLAYER_WIDTH, fullPlayerWidth * MIN_PLAYER_SCALE ) ) {
		return below();
	}

	const playerHeight = playerWidth / ratio;

	return {
		mode: 'side',
		width,
		expandBy: width - stageWidth,
		panelWidth,
		stageHeight,
		playerWidth,
		playerHeight,
		playerTop: ( stageHeight - playerHeight ) / 2,
	};
}

/**
 * Normalise a search query: trimmed, case-folded, inner whitespace collapsed.
 *
 * @param {string} query Raw query.
 * @return {string} Normalised query ('' when there is nothing to search for).
 */
export function normaliseQuery( query ) {
	return String( query || '' ).trim().replace( /\s+/g, ' ' ).toLocaleLowerCase();
}

/**
 * Compile a query into the pattern `matchRanges` searches with: matched
 * case-insensitively on the original text, so the ranges index the text as
 * displayed (lower-casing first can change its length, e.g. "İ"), and any run
 * of whitespace in the text matches a space in the query. Compile once per
 * query, not once per cue.
 *
 * @param {string} query Normalised query (see `normaliseQuery`).
 * @return {RegExp|null} The pattern, or null when there is nothing to search for.
 */
export function compileQuery( query ) {
	if ( ! query ) {
		return null;
	}

	const source = query
		.split( ' ' )
		.map( ( word ) => word.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) )
		.join( '\\s+' );
	return new RegExp( source, 'giu' );
}

/**
 * Find every match of a compiled query in a cue's text.
 *
 * @param {string}      text    Cue text.
 * @param {RegExp|null} pattern Pattern from `compileQuery`.
 * @return {Array<[number, number]>} `[start, end)` index pairs, in order.
 */
export function matchRanges( text, pattern ) {
	if ( ! pattern ) {
		return [];
	}

	const value = String( text || '' );
	const ranges = [];
	// The pattern is shared across cues: start each search from the beginning.
	pattern.lastIndex = 0;
	let match = pattern.exec( value );
	while ( match ) {
		if ( match[ 0 ].length === 0 ) {
			pattern.lastIndex = match.index + 1;
		} else {
			ranges.push( [ match.index, match.index + match[ 0 ].length ] );
		}
		match = pattern.exec( value );
	}

	return ranges;
}

/**
 * Find every occurrence of a query in a cue's text, case-insensitively.
 *
 * @param {string} text  Cue text.
 * @param {string} query Normalised query (see `normaliseQuery`).
 * @return {Array<[number, number]>} `[start, end)` index pairs, in order.
 */
export function findMatchRanges( text, query ) {
	return matchRanges( text, compileQuery( query ) );
}
