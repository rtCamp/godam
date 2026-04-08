/**
 * GoDAM Swipe Hint Animation Helpers
 *
 * Provides utility functions to control the swipe hint animation
 * shown inside video modals.
 *
 * - startSwipeAnimationLoop(): Starts a repeating animation that displays a swipe hint and overlay at fixed intervals.
 * - stopSwipeAnimationLoop(): Stops the animation loop and clears any active interval.
 *
 * Ensures only one animation loop runs at a time.
 */

let swipeAnimationInterval = null;

/**
 * Starts a loop that shows swipe hint animations at a regular interval.
 *
 * - Immediately displays the swipe hint and overlay for 5 seconds.
 * - Repeats the animation every 13 seconds (5s visible + 8s pause).
 * - Ensures no multiple intervals run simultaneously by calling stopSwipeAnimationLoop() first.
 *
 * @param {HTMLElement} swipeHint    - The element displaying the swipe hint animation.
 * @param {HTMLElement} swipeOverlay - The overlay element that appears with the hint.
 */
export function startSwipeAnimationLoop( swipeHint, swipeOverlay ) {
	stopSwipeAnimationLoop(); // Prevent overlapping intervals.

	const showHint = () => {
		swipeHint.classList.add( 'show' );
		swipeOverlay.classList.add( 'visible' );

		setTimeout( () => {
			swipeHint.classList.remove( 'show' );
			swipeOverlay.classList.remove( 'visible' );
		}, 5000 ); // Show hint for 5 seconds.
	};

	showHint(); // Show the hint immediately on first call.

	swipeAnimationInterval = setInterval( () => {
		showHint();
	}, 13000 ); // 5s show + 8s pause. Repeat every 13 seconds.
}

/**
 * Stops the swipe hint animation loop if it is currently running.
 *
 * - Clears the interval set by startSwipeAnimationLoop().
 * - Resets the swipeAnimationInterval reference to null.
 */
export function stopSwipeAnimationLoop() {
	if ( swipeAnimationInterval ) {
		clearInterval( swipeAnimationInterval );
		swipeAnimationInterval = null;
	}
}
