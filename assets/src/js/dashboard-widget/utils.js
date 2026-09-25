/**
 * Pure helpers for the GoDAM Dashboard widget, kept apart so they can be unit tested.
 */

/**
 * Play counts that count as milestones, largest first.
 *
 * @type {number[]}
 */
export const PLAY_MILESTONES = [ 100000, 50000, 25000, 10000, 5000, 2500, 1000, 500, 250, 100 ];

/**
 * The largest play milestone a site has passed.
 *
 * @param {number} plays Lifetime plays.
 * @return {number} The milestone, or 0 below the first one.
 */
export function playsMilestone( plays ) {
	return PLAY_MILESTONES.find( ( milestone ) => plays >= milestone ) || 0;
}

/**
 * Bar heights as fractions of the busiest day, for a simple bar chart.
 *
 * @param {number[]} values Plays per day.
 * @return {number[]} Each value divided by the largest, or all zeros when every day is zero.
 */
export function scaleBars( values ) {
	const max = Math.max( 0, ...values );

	return values.map( ( value ) => ( max > 0 ? Math.max( 0, value ) / max : 0 ) );
}

/**
 * Round watch time to the largest unit that reads well: hours, then minutes.
 *
 * Ten hours or more rounds to whole hours; one to ten hours keeps one decimal;
 * under an hour rounds to whole minutes, never below one.
 *
 * @param {number} seconds Watch time in seconds.
 * @return {{amount: number, unit: string}} The rounded amount and 'hours' or 'minutes'.
 */
export function roundWatchTime( seconds ) {
	const hours = seconds / 3600;

	if ( hours >= 1 ) {
		return {
			amount: hours >= 10 ? Math.round( hours ) : Math.round( hours * 10 ) / 10,
			unit: 'hours',
		};
	}

	return { amount: Math.max( 1, Math.round( seconds / 60 ) ), unit: 'minutes' };
}
