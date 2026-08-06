/**
 * iOS custom fullscreen helpers.
 *
 * iOS Safari will not put an arbitrary element into real fullscreen — only a
 * bare `<video>` — so the player fakes it: a class makes the container
 * `position: fixed; inset: 0`, and the page behind is pinned so it cannot
 * scroll underneath.
 *
 * The lock and the state check live here because more than one place needs
 * them: the enter/exit buttons in `controlsManager.js`, and the lightbox, which
 * has to release the lock if it closes while fullscreen is still on — otherwise
 * the page is left `position: fixed` and unscrollable.
 */

/**
 * Class the custom fullscreen puts on `.easydam-video-container`.
 *
 * This, rather than the player's `vjs-fullscreen`, is the marker for *custom*
 * fullscreen: Video.js sets `vjs-fullscreen` for native fullscreen too.
 *
 * @type {string}
 */
export const CUSTOM_FULLSCREEN_CONTAINER_CLASS = 'godam-video-fullscreen';

/**
 * Class the custom fullscreen puts on the `.video-js` player element.
 *
 * @type {string}
 */
export const CUSTOM_FULLSCREEN_PLAYER_CLASS = 'vjs-fullscreen';

/**
 * Stop the page behind the fullscreen player from scrolling.
 *
 * `overflow: hidden` alone is not enough on iOS Safari, so the body is pinned
 * with `position: fixed` and offset by the current scroll, which
 * {@link unlockBodyScroll} reads back to restore the position.
 */
export function lockBodyScroll() {
	const scrollY = window.scrollY;

	document.body.style.overflow = 'hidden';
	document.documentElement.style.overflow = 'hidden';
	document.body.style.position = 'fixed';
	document.body.style.top = `-${ scrollY }px`;
	// Without this the pinned body can shed its width and show a scrollbar.
	document.body.style.width = '100%';
}

/**
 * Undo {@link lockBodyScroll} and put the reader back where they were.
 */
export function unlockBodyScroll() {
	// Read the offset before clearing it — it is the stored scroll position.
	const offset = document.body.style.top;

	document.body.style.overflow = '';
	document.body.style.position = '';
	document.body.style.top = '';
	document.body.style.width = '';
	document.documentElement.style.overflow = '';

	if ( offset ) {
		window.scrollTo( 0, parseInt( offset, 10 ) * -1 );
	}
}

/**
 * Whether a player is in the iOS custom fullscreen (not native fullscreen).
 *
 * @param {HTMLElement} playerEl - The `.video-js` element.
 * @return {boolean} True when custom fullscreen is active.
 */
export function isInCustomFullscreen( playerEl ) {
	return !! playerEl
		?.closest?.( '.easydam-video-container' )
		?.classList?.contains( CUSTOM_FULLSCREEN_CONTAINER_CLASS );
}

/**
 * Leave the custom fullscreen, if it is on.
 *
 * @param {HTMLElement} playerEl - The `.video-js` element.
 * @return {boolean} True when fullscreen was active and has been exited.
 */
export function exitCustomFullscreen( playerEl ) {
	if ( ! isInCustomFullscreen( playerEl ) ) {
		return false;
	}

	playerEl.classList.remove( CUSTOM_FULLSCREEN_PLAYER_CLASS );
	playerEl
		.closest( '.easydam-video-container' )
		?.classList.remove( CUSTOM_FULLSCREEN_CONTAINER_CLASS );

	unlockBodyScroll();

	return true;
}
