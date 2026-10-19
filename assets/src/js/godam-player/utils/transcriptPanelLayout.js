/**
 * Pure helpers for the transcript panel: where it goes when it opens, and how
 * a search query maps onto cue text. Kept free of the DOM so they can be unit
 * tested; TranscriptPanelManager does the measuring and applies the result.
 */

// Panel width beside the video: a share of the space, within these bounds.
export const PANEL_MIN_WIDTH = 260;
export const PANEL_MAX_WIDTH = 420;
export const PANEL_WIDTH_RATIO = 0.32;

// Below this width the video would be too small to watch beside the panel, so
// the panel drops beneath the video instead.
export const MIN_PLAYER_WIDTH = 280;

// Height of the panel when it sits beneath the video.
export const BELOW_MIN_HEIGHT = 220;
export const BELOW_MAX_HEIGHT = 360;
export const BELOW_HEIGHT_RATIO = 0.6;

// A narrow (portrait) video widens toward this shape when the panel opens.
const WIDE_RATIO = 16 / 9;

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
 * `below`: there is not enough width for both, so the panel stacks beneath
 * the video, which keeps its full size.
 *
 * @param {Object} geometry             Closed-state geometry, in px.
 * @param {number} geometry.stageWidth  Width of the video stage.
 * @param {number} geometry.stageHeight Height of the video stage.
 * @param {number} geometry.ratio       Video aspect ratio (width / height).
 * @param {number} geometry.room        Widest the stage may grow to.
 * @return {Object} The layout. Side: `mode`, `width`, `expandBy`, `panelWidth`, `stageHeight`, `playerWidth`, `playerHeight`, `playerTop`. Below: `mode`, `panelHeight`.
 */
export function computeTranscriptLayout( { stageWidth, stageHeight, ratio, room } ) {
	const belowHeight = clamp( Math.round( ( stageHeight || 0 ) * BELOW_HEIGHT_RATIO ), BELOW_MIN_HEIGHT, BELOW_MAX_HEIGHT );

	if ( ! stageWidth || ! stageHeight || ! ratio ) {
		return { mode: 'below', panelHeight: belowHeight };
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

	if ( playerWidth < Math.min( MIN_PLAYER_WIDTH, fullPlayerWidth ) ) {
		return { mode: 'below', panelHeight: belowHeight };
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
 * Find every occurrence of a query in a cue's text, case-insensitively.
 *
 * @param {string} text  Cue text.
 * @param {string} query Normalised query (see `normaliseQuery`).
 * @return {Array<[number, number]>} `[start, end)` index pairs, in order.
 */
export function findMatchRanges( text, query ) {
	if ( ! query ) {
		return [];
	}

	const haystack = String( text || '' ).toLocaleLowerCase();
	const ranges = [];
	let from = 0;

	while ( from <= haystack.length - query.length ) {
		const index = haystack.indexOf( query, from );
		if ( index === -1 ) {
			break;
		}
		ranges.push( [ index, index + query.length ] );
		from = index + query.length;
	}

	return ranges;
}
