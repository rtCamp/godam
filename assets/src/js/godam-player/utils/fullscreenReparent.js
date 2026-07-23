/**
 * Shared fullscreen reparenting helpers.
 *
 * Video.js requests fullscreen on the player element (`.video-js`), and only
 * that element's subtree renders in the fullscreen top layer. Overlay UI that
 * lives in an ancestor (the video container, the wrapper, or `document.body`)
 * therefore vanishes in fullscreen unless it is moved inside `.video-js`.
 *
 * The share button, the transcript button + panel, and the share modal all need
 * the same enter/exit dance, so it lives here once instead of being duplicated
 * across managers.
 */

/**
 * Whether the player is in fullscreen.
 *
 * Native fullscreen sets `player.isFullscreen()`; the iOS custom fullscreen only
 * toggles the `vjs-fullscreen` class on the player element. Check both so either
 * path is detected.
 *
 * @param {Object} player Video.js player instance.
 * @return {boolean} True when the player is (natively or custom) fullscreen.
 */
export function isPlayerFullscreen( player ) {
	const el = player?.el?.();
	return !! ( player?.isFullscreen?.() || el?.classList?.contains( 'vjs-fullscreen' ) );
}

/**
 * Keep an overlay element visible in fullscreen by reparenting it into the
 * fullscreen player element on enter and back to its normal parent on exit.
 *
 * The element and its restore parent are resolved lazily (via callbacks) on
 * every fullscreen change, so callers can move elements that are created after
 * setup or that come and go (e.g. a transient modal).
 *
 * @param {Object}   options                          Options.
 * @param {Object}   options.player                   Video.js player instance.
 * @param {Function} options.getElement               Returns the element to move (falsy to skip this change).
 * @param {Function} options.getRestoreParent         Returns the element to restore into when exiting fullscreen.
 * @param {boolean}  [options.runNow=true]            Reparent once immediately so an already-fullscreen player is handled.
 * @param {boolean}  [options.disposeWithPlayer=true] Auto-remove listeners on player `dispose`.
 * @return {Function} A disposer that removes the listeners.
 */
export function setupFullscreenReparenting( {
	player,
	getElement,
	getRestoreParent,
	runNow = true,
	disposeWithPlayer = true,
} ) {
	const handleChange = () => {
		const el = getElement();
		if ( ! el ) {
			return;
		}

		const fullscreenEl = player.el();

		if ( isPlayerFullscreen( player ) ) {
			if ( fullscreenEl && el.parentElement !== fullscreenEl ) {
				fullscreenEl.appendChild( el );
			}
			return;
		}

		const restoreParent = getRestoreParent();
		if ( restoreParent && el.parentElement !== restoreParent ) {
			restoreParent.appendChild( el );
		}
	};

	player.on( 'fullscreenchange', handleChange );
	player.on( 'customfullscreenchange', handleChange );

	const dispose = () => {
		player.off( 'fullscreenchange', handleChange );
		player.off( 'customfullscreenchange', handleChange );
	};

	if ( disposeWithPlayer ) {
		player.one( 'dispose', dispose );
	}

	if ( runNow ) {
		handleChange();
	}

	return dispose;
}
