/**
 * Viewer Reach maths for the per-video layer panels.
 *
 * "Viewer Reach" answers "how many viewers were still watching when this layer
 * appeared?". It is read off the same per-second retention array the Viewer
 * Retention Curve draws (`all_time_heatmap`, summed per-day server-side for the
 * selected range), indexed at the layer's timestamp. Reusing that array means
 * the tile always agrees with the curve the user is looking at on the same page.
 *
 * Why not the layer's own `viewed` count: `viewed` is not one unit across layer
 * types. The microservice aggregates atomic layers (CTA / Form / Poll) and
 * sub-hotspot rows with `COUNT(*)` (raw events, so a looping viewer contributes
 * more than one) but hotspot / Woo parent rows with
 * `uniqExact(page_load_session_id)` (distinct sessions). So `viewed / plays`
 * would exceed 100% legitimately on atomic layers, and no clamp can fix that
 * honestly. `viewed` stays in the UI as "Impressions", a deliberately different
 * metric from Reach.
 *
 * Reach and Impressions therefore count different populations: the retention
 * array includes sessions with no `type=1` page_load (same convention as the
 * shipped curve), while layer events are gated on one. Both carry tooltips
 * saying so.
 */

/**
 * Parse the per-second retention array out of an analytics payload field.
 *
 * The microservice returns it as a JSON string in both range and all-time mode.
 * Anything unparseable or non-array yields `[]`, which every consumer below
 * treats as "no reach data" rather than zero reach.
 *
 * @param {string|Array|null|undefined} raw `all_time_heatmap` as returned by the REST proxy.
 * @return {number[]} Per-second view counts, or [] when unavailable.
 */
export function parseRetentionArray( raw ) {
	if ( Array.isArray( raw ) ) {
		return raw.map( ( v ) => Number( v ) || 0 );
	}
	if ( typeof raw !== 'string' || raw.trim() === '' ) {
		return [];
	}
	try {
		const parsed = JSON.parse( raw );
		return Array.isArray( parsed ) ? parsed.map( ( v ) => Number( v ) || 0 ) : [];
	} catch ( e ) {
		return [];
	}
}

/**
 * The denominator for a reach rate: how many viewers the video started with.
 *
 * Mirrors `generateRetentionCurve` in helper.js (`data[0] || max(data)`) so the
 * tile and the curve normalise against the identical baseline. The `max`
 * fallback covers the case where second 0 recorded nothing but later seconds
 * did, which happens when every session's first beacon lands mid-video.
 *
 * @param {number[]} array Per-second view counts.
 * @return {number} Starting viewers, or 0 when there is no data.
 */
export function reachBase( array ) {
	if ( ! Array.isArray( array ) || array.length === 0 ) {
		return 0;
	}
	const first = Number( array[ 0 ] ) || 0;
	if ( first > 0 ) {
		return first;
	}
	return array.reduce( ( max, v ) => Math.max( max, Number( v ) || 0 ), 0 );
}

/**
 * Viewers still watching at `timestamp`.
 *
 * Returns null (not 0) whenever the answer is unknown, so callers hide the
 * tile instead of reporting a confident zero:
 * no retention array at all, or the layer sits past the end of the array. The
 * latter happens when a layer was positioned beyond the `video_length` recorded
 * with these events, e.g. the video was re-encoded shorter after the layer was
 * placed.
 *
 * @param {number[]}      array     Per-second view counts.
 * @param {number|string} timestamp Layer position in seconds.
 * @return {number|null} Viewers at that second, or null when unknown.
 */
export function reachAt( array, timestamp ) {
	if ( ! Array.isArray( array ) || array.length === 0 ) {
		return null;
	}
	const seconds = Math.floor( Number( timestamp ) || 0 );
	if ( seconds < 0 || seconds >= array.length ) {
		return null;
	}
	return Number( array[ seconds ] ) || 0;
}

/**
 * Reach as a percentage of the video's starting viewers.
 *
 * Deliberately unclamped: a rewatched second can legitimately exceed 100%,
 * exactly as the retention curve documents and renders. Clamping here would
 * make the tile disagree with the chart directly above it.
 *
 * @param {number[]}      array     Per-second view counts.
 * @param {number|string} timestamp Layer position in seconds.
 * @return {number|null} Percentage, or null when reach or the baseline is unknown.
 */
export function reachRateAt( array, timestamp ) {
	const reach = reachAt( array, timestamp );
	if ( reach === null ) {
		return null;
	}
	const base = reachBase( array );
	if ( base <= 0 ) {
		return null;
	}
	return ( reach / base ) * 100;
}

/**
 * The equal-length window immediately before `range`, for period-over-period
 * deltas. A 7-day range ending today returns the 7 days before it.
 *
 * Returns null for an open-ended ("All Time") range, which has no previous
 * window to compare against.
 *
 * Uses calendar arithmetic through the Date constructor rather than fixed-ms
 * subtraction, matching `spanDays` in the DateRangePicker: a DST shift inside
 * the window must not move the boundary onto the wrong calendar day.
 *
 * @param {Object}      range           Current range.
 * @param {string|null} range.startDate ISO YYYY-MM-DD.
 * @param {string|null} range.endDate   ISO YYYY-MM-DD.
 * @return {{startDate:string,endDate:string}|null} Previous window, or null.
 */
export function previousRange( { startDate, endDate } = {} ) {
	if ( ! startDate || ! endDate ) {
		return null;
	}
	const start = parseISO( startDate );
	const end = parseISO( endDate );
	if ( ! start || ! end || end < start ) {
		return null;
	}

	const days = spanLengthInDays( start, end );
	const prevEnd = new Date(
		start.getFullYear(),
		start.getMonth(),
		start.getDate() - 1,
	);
	const prevStart = new Date(
		prevEnd.getFullYear(),
		prevEnd.getMonth(),
		prevEnd.getDate() - ( days - 1 ),
	);
	return { startDate: formatISO( prevStart ), endDate: formatISO( prevEnd ) };
}

/**
 * Inclusive length of a range in whole days. Rounded because a DST transition
 * makes the raw millisecond difference 23 or 25 hours for one of the days.
 *
 * @param {Date} start Range start at local midnight.
 * @param {Date} end   Range end at local midnight.
 * @return {number} Day count, at least 1.
 */
export function spanLengthInDays( start, end ) {
	const msPerDay = 24 * 60 * 60 * 1000;
	return Math.max( 1, Math.round( ( end - start ) / msPerDay ) + 1 );
}

/**
 * Percentage change between two values.
 *
 * Matches the convention used by both the microservice (`compute_percent_change`
 * in app/utils/helpers.py) and the dashboard cards (`calculateTrendPercentage`
 * in helper.js): a zero baseline reports ±100 rather than infinity, so the layer
 * badges read the same way as the KPI badges elsewhere on the page.
 *
 * Returns null when there is no comparable previous value at all, which hides
 * the badge rather than implying a flat 0% change.
 *
 * @param {number|null|undefined} current  Value for the selected range.
 * @param {number|null|undefined} previous Value for the previous equal range.
 * @return {number|null} Percentage change, or null when incomparable.
 */
export function percentDelta( current, previous ) {
	// Guard null/'' explicitly: Number(null) and Number('') are both 0, which
	// would turn "no previous window" into a confident +100%.
	if (
		current === null ||
		current === undefined ||
		current === '' ||
		previous === null ||
		previous === undefined ||
		previous === ''
	) {
		return null;
	}
	const now = Number( current );
	const before = Number( previous );
	if ( ! Number.isFinite( now ) || ! Number.isFinite( before ) ) {
		return null;
	}
	if ( before === 0 ) {
		if ( now > 0 ) {
			return 100;
		}
		return now < 0 ? -100 : 0;
	}
	return ( ( now - before ) / before ) * 100;
}

/**
 * 'YYYY-MM-DD' to a local-midnight Date. Null for anything malformed, so a
 * garbled range degrades to "no previous window" instead of NaN dates.
 *
 * @param {string} iso ISO date string.
 * @return {Date|null} Parsed date or null.
 */
function parseISO( iso ) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec( String( iso || '' ) );
	if ( ! match ) {
		return null;
	}
	const [ , y, m, d ] = match.map( Number );
	const date = new Date( y, m - 1, d );
	// Reject impossible dates that the constructor silently rolls over
	// (2026-02-30 becomes March 2).
	if ( date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d ) {
		return null;
	}
	return date;
}

/**
 * Local-midnight Date to 'YYYY-MM-DD'.
 *
 * @param {Date} date Date to format.
 * @return {string} ISO date string.
 */
function formatISO( date ) {
	const y = date.getFullYear();
	const m = String( date.getMonth() + 1 ).padStart( 2, '0' );
	const d = String( date.getDate() ).padStart( 2, '0' );
	return `${ y }-${ m }-${ d }`;
}
