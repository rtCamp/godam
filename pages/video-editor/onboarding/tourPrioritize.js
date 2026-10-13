/**
 * Tiny pub/sub for the id of the attachment the tour wants pinned first in the
 * Video Editor list (the demo video). The Video Editor list subscribes and
 * refetches with `prioritize_id` when this changes; ProductGuide sets it when
 * the interactive tour starts and clears it when the tour ends.
 *
 * Kept out of the editor Redux slice on purpose — it's ephemeral, list-only
 * state that resets on reload (module default 0).
 */

let prioritizeId = 0;
const subscribers = new Set();

/**
 * @return {number} Current pinned attachment id (0 when none).
 */
export const getTourPrioritizeId = () => prioritizeId;

/**
 * Set the pinned attachment id and notify subscribers.
 *
 * @param {number} id Attachment id (0 to clear).
 */
export const setTourPrioritizeId = ( id ) => {
	const next = Number( id ) || 0;
	if ( next === prioritizeId ) {
		return;
	}
	prioritizeId = next;
	subscribers.forEach( ( fn ) => fn( prioritizeId ) );
};

/**
 * Subscribe to changes.
 *
 * @param {Function} fn Listener invoked with the new id.
 * @return {Function} Unsubscribe.
 */
export const subscribeTourPrioritize = ( fn ) => {
	subscribers.add( fn );
	return () => subscribers.delete( fn );
};
