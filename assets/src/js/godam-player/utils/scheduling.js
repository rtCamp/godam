/**
 * Main-thread scheduling helpers.
 *
 * Starting a player is expensive, so the work is split into separate tasks:
 * the browser can paint and handle input between them, and no single task
 * runs long enough to count towards Total Blocking Time.
 */

/**
 * Give the main thread back to the browser, then continue in a new task.
 *
 * Uses `scheduler.yield()` where available (it keeps the continuation ahead of
 * other queued tasks) and falls back to a zero-delay timeout.
 *
 * @return {Promise<void>} Resolves in a later task.
 */
export function yieldToMain() {
	if ( typeof window !== 'undefined' && typeof window.scheduler?.yield === 'function' ) {
		return window.scheduler.yield();
	}
	return new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
}

/**
 * Run work that a player does not need before it plays.
 *
 * Runs once, at whichever comes first: the browser is idle, the visitor starts
 * playback, or `timeout` milliseconds pass.
 *
 * @param {Object}   player            - Video.js player.
 * @param {Function} callback          - Work to run.
 * @param {Object}   [options]         - Options.
 * @param {number}   [options.timeout] - Upper bound before it runs anyway.
 */
export function runWhenIdleOrPlay( player, callback, { timeout = 1500 } = {} ) {
	let done = false;
	let idleHandle = null;
	let timer = null;

	const run = () => {
		if ( done ) {
			return;
		}
		done = true;
		if ( idleHandle !== null && typeof window.cancelIdleCallback === 'function' ) {
			window.cancelIdleCallback( idleHandle );
		}
		if ( timer !== null ) {
			clearTimeout( timer );
		}
		player.off( 'play', run );
		if ( player.isDisposed?.() ) {
			return;
		}
		callback();
	};

	player.one( 'play', run );

	if ( typeof window.requestIdleCallback === 'function' ) {
		idleHandle = window.requestIdleCallback( run, { timeout } );
	} else {
		timer = setTimeout( run, Math.min( timeout, 200 ) );
	}
}
