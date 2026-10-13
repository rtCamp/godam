/**
 * Vertical lane assignment for the timeline marker strip.
 *
 * Pure (no React / DOM) so it can be unit-tested directly; consumed by
 * LayerTimelineStrip. Layers firing at near-identical timestamps would overlap
 * horizontally, so each marker that's too close to an already-placed one is
 * pushed down into the next vertical lane.
 */

// Two markers whose centres are closer than this (in px, along the strip) would
// overlap, so the second is pushed down into the next vertical lane. Set just
// above the marker label's max width (110px) so even two full-width labels in
// the same lane keep a small gap.
export const MIN_GAP_PX = 112;

// Vertical distance between lanes (px). Clears a full marker — icon card + name
// + timestamp + conversion badge, plus the "Removed" pill on the historical
// strip — so a lower-lane marker never collides with the one above it.
export const LANE_STEP_PX = 124;

// Height of the marker area for a single lane (matches the tallest marker tree).
export const BASE_TRACK_HEIGHT_PX = 130;

/**
 * Assign each marker to a vertical lane so near-simultaneous layers don't
 * overlap. Walks the time-sorted markers left to right; each one takes the
 * topmost lane whose previous marker ended at least MIN_GAP_PX earlier, else
 * opens a new lane below. So three layers within MIN_GAP_PX of each other land
 * on lanes 0/1/2 (a descending staircase), while well-spaced layers all stay on
 * lane 0. Pixel positions need the strip's rendered width.
 *
 * @param {Array}  parents    Time-sorted parent layers.
 * @param {number} duration   Video duration in seconds (denominator for position).
 * @param {number} trackWidth Rendered strip width in px.
 * @return {{ lanes: number[], laneCount: number }} Lane per marker + total lanes.
 */
export function assignLanes( parents, duration, trackWidth ) {
	const laneLastX = [];
	const lanes = [];
	const width = trackWidth || 512; // fall back to the min track width pre-measure.
	parents.forEach( ( parent ) => {
		const pct = Math.min(
			100,
			Math.max( 0, ( parent.timestamp / duration ) * 100 ),
		);
		const x = ( pct / 100 ) * width;
		let lane = laneLastX.findIndex( ( lastX ) => x - lastX >= MIN_GAP_PX );
		if ( lane === -1 ) {
			lane = laneLastX.length;
			laneLastX.push( x );
		} else {
			laneLastX[ lane ] = x;
		}
		lanes.push( lane );
	} );
	return { lanes, laneCount: laneLastX.length };
}
