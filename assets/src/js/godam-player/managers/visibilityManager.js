/**
 * Visibility Manager
 *
 * Pauses (or mutes) GoDAM players that leave the visitor's view, so audio
 * never carries on from a video nobody can see: scrolled past, moved to
 * another carousel slide, inside a closed tab/accordion/modal, or in a
 * background browser tab.
 *
 * Rules (see rtCamp/godam-plugin-wp#57):
 *
 * Visitor-started playback (play, click, keyboard, unmute, seek, pause,
 * lightbox) follows the out-of-view setting: `pause` (default) or `mute`.
 * Back in view, a paused video stays paused and a muted one stays muted
 * until the visitor unmutes it.
 *
 * Autoplay, autoplay-on-view, hover previews and script-started playback
 * pause when hidden and resume when visible again (hover previews never
 * resume).
 *
 * `off` disables all of it for that player. Fullscreen and
 * picture-in-picture are never touched.
 *
 * Automatic pauses set `player.godamAutoPause` while their `pause` event is
 * dispatched, so other listeners (CTA `on_pause` layers, the public API) can
 * tell them apart from a visitor pausing.
 *
 * One manager is shared page-wide (several PlayerManager instances and late
 * players all register here), so there is a single IntersectionObserver and a
 * single `visibilitychange` listener.
 */

/**
 * Internal dependencies
 */
import { addRange } from '../utils/timeRanges.js';
import { CUSTOM_FULLSCREEN_PLAYER_CLASS } from '../utils/customFullscreen.js';

export const OUT_OF_VIEW_MODE = Object.freeze( {
	PAUSE: 'pause',
	MUTE: 'mute',
	OFF: 'off',
} );

/** A player counts as visible when at least this share of it (or of the viewport) is on screen. */
export const VISIBLE_RATIO = 0.25;

const OBSERVER_THRESHOLDS = [ 0, 0.05, 0.1, 0.15, 0.2, 0.25 ];

/** A play/pause/seek/volume change this soon after a pointer or key event on the player is the visitor's. */
const GESTURE_WINDOW_MS = 1000;

/** How long a CSS-hidden state (opacity/visibility) must last before it counts, to ignore fade-in transitions. */
const STYLE_HIDDEN_DEBOUNCE_MS = 300;

/** Poll interval for CSS visibility while an auto-paused player waits to be shown again. */
const STYLE_POLL_MS = 500;

/** Largest gap between two `timeupdate`s still treated as continuous playback (seconds). */
const MAX_SEGMENT_GAP = 1.5;

/** Safety net: clear the auto-pause flag even if no `pause` event arrives. */
const AUTO_PAUSE_FLAG_TIMEOUT_MS = 1000;

/** Clicks on interactive layers (CTAs, hotspots, forms) are not playback interaction. */
const LAYER_SELECTOR = '.easydam-layer';

const PLAYER_SELECTOR = '.easydam-player.video-js';

/**
 * Read the out-of-view mode rendered on the `<video>` element.
 *
 * @param {HTMLElement} videoEl - The original `<video>` element.
 * @return {string} One of OUT_OF_VIEW_MODE (defaults to `pause`).
 */
export function resolveOutOfViewMode( videoEl ) {
	const value = videoEl?.dataset?.outOfView;
	return Object.values( OUT_OF_VIEW_MODE ).includes( value ) ? value : OUT_OF_VIEW_MODE.PAUSE;
}

/**
 * Whether the `pause` currently being dispatched was triggered automatically.
 *
 * @param {Object} player - Video.js player.
 * @return {boolean} True for automatic (visibility or API) pauses.
 */
export function isAutoPause( player ) {
	return !! player?.godamAutoPause;
}

/**
 * Reason for the `pause` currently being dispatched, or null for any other pause.
 *
 * @param {Object} player - Video.js player.
 * @return {string|null} `visibility`, `api` or null.
 */
export function getAutoPauseReason( player ) {
	return isAutoPause( player ) ? player.godamAutoPauseReason || 'visibility' : null;
}

/**
 * Whether an IntersectionObserver record means "visible enough".
 *
 * Counts either 25% of the player, or 25% of the viewport covered by it, so a
 * player much taller than the screen still counts as visible.
 *
 * @param {IntersectionObserverEntry} record - Observer record.
 * @return {boolean} True when visible.
 */
export function isRecordVisible( record ) {
	if ( ! record?.isIntersecting ) {
		return false;
	}
	if ( record.intersectionRatio >= VISIBLE_RATIO ) {
		return true;
	}
	const root = record.rootBounds;
	const rect = record.intersectionRect;
	if ( root && rect && root.width > 0 && root.height > 0 ) {
		return ( rect.width * rect.height ) / ( root.width * root.height ) >= VISIBLE_RATIO;
	}
	return false;
}

export class VisibilityManager {
	/**
	 * @param {Object}   [deps]            - Injectable globals (for tests).
	 * @param {Window}   [deps.win]        - Window.
	 * @param {Document} [deps.doc]        - Document.
	 * @param {Function} [deps.now]        - Clock in ms.
	 * @param {Function} [deps.getPlayers] - Returns every GoDAM Video.js player on the page.
	 */
	constructor( { win = window, doc = document, now = () => Date.now(), getPlayers = null } = {} ) {
		this.win = win;
		this.doc = doc;
		this.now = now;
		this.getPlayers = getPlayers || ( () => this.findPagePlayers() );

		this.entries = new Map(); // player -> entry
		this.elementEntries = new WeakMap(); // observed element -> entry
		this.observer = null;
		this.stylePollTimer = null;

		this.handleDocumentVisibility = () => {
			this.entries.forEach( ( entry ) => this.evaluate( entry ) );
		};
		this.doc.addEventListener( 'visibilitychange', this.handleDocumentVisibility );
	}

	/**
	 * Start managing a player.
	 *
	 * @param {Object}   player              - Video.js player.
	 * @param {Object}   [options]           - Options.
	 * @param {string}   [options.mode]      - OUT_OF_VIEW_MODE value.
	 * @param {Function} [options.isPreview] - Returns true while an uncommitted hover preview runs.
	 * @return {Object|null} The entry, or null when the mode is `off`.
	 */
	register( player, { mode = OUT_OF_VIEW_MODE.PAUSE, isPreview = () => false } = {} ) {
		if ( ! player || mode === OUT_OF_VIEW_MODE.OFF ) {
			return null;
		}
		if ( this.entries.has( player ) ) {
			return this.entries.get( player );
		}

		const el = player.el();
		const entry = {
			player,
			el,
			mode,
			isPreview,
			inViewport: true,
			styleVisible: true,
			styleHiddenSince: null,
			userStarted: false,
			lastGestureAt: -Infinity,
			resumeWhenVisible: false,
			autoMuted: false,
			adPausedByUs: false,
			lastTime: null,
			cleanup: [],
		};

		// Read by analytics.js to keep auto-muted, off-screen playback out of the heatmap.
		player.godamVisibleRanges = [];
		player.godamHiddenRanges = [];

		this.entries.set( player, entry );
		this.elementEntries.set( el, entry );

		const listen = ( type, handler ) => {
			const options = { capture: true, passive: true };
			el.addEventListener( type, handler, options );
			entry.cleanup.push( () => el.removeEventListener( type, handler, options ) );
		};
		const onPlayer = ( type, handler ) => {
			player.on( type, handler );
			entry.cleanup.push( () => player.off?.( type, handler ) );
		};

		const onGesture = ( event ) => this.handleGesture( entry, event );
		[ 'pointerdown', 'touchstart', 'keydown' ].forEach( ( type ) => listen( type, onGesture ) );

		onPlayer( 'play', () => this.handlePlay( entry ) );
		onPlayer( 'pause', () => this.handlePause( entry ) );
		onPlayer( 'seeking', () => this.handleSeeking( entry ) );
		onPlayer( 'volumechange', () => this.handleVolumeChange( entry ) );
		onPlayer( 'timeupdate', () => this.handleTimeUpdate( entry ) );
		onPlayer( 'ended', () => {
			entry.lastTime = null;
		} );
		[ 'fullscreenchange', 'customfullscreenchange', 'leavepictureinpicture' ].forEach( ( type ) =>
			onPlayer( type, () => this.evaluate( entry ) ),
		);

		this.getObserver()?.observe( el );
		return entry;
	}

	/**
	 * Stop managing a player (call on dispose).
	 *
	 * @param {Object} player - Video.js player.
	 */
	unregister( player ) {
		const entry = this.entries.get( player );
		if ( ! entry ) {
			return;
		}
		entry.cleanup.forEach( ( fn ) => fn() );
		this.observer?.unobserve( entry.el );
		this.entries.delete( player );
		this.syncStylePoll();
	}

	/**
	 * Record that the visitor started or controlled this player.
	 *
	 * Called for gestures on the player, the global keyboard shortcuts, opening
	 * the lightbox and `GoDAMAPI` calls marked `userStarted`.
	 *
	 * @param {Object} player - Video.js player.
	 */
	markInteraction( player ) {
		const entry = this.entries.get( player );
		if ( ! entry ) {
			return;
		}
		entry.userStarted = true;
		entry.resumeWhenVisible = false;
	}

	/**
	 * Whether the visitor has started or controlled this player.
	 *
	 * @param {Object} player - Video.js player.
	 * @return {boolean} True once the visitor interacted.
	 */
	isUserStarted( player ) {
		return !! this.entries.get( player )?.userStarted;
	}

	/**
	 * Pause every playing GoDAM player, e.g. from a carousel's slide-change hook.
	 *
	 * Works on all players, including ones whose out-of-view setting is `off`.
	 * Pauses are flagged as automatic (reason `api`), so they don't fire
	 * `on_pause` CTA layers.
	 *
	 * @param {Object}                   [options]        - Options.
	 * @param {Object|HTMLElement|Array} [options.except] - Player(s) or element(s) to leave playing.
	 * @param {HTMLElement|string}       [options.within] - Only pause players inside this element/selector.
	 * @return {number} How many players were paused.
	 */
	pauseAll( { except = [], within = null } = {} ) {
		const container = typeof within === 'string' ? this.doc.querySelector( within ) : within;
		if ( within && ! container ) {
			return 0;
		}
		const exceptions = ( Array.isArray( except ) ? except : [ except ] ).filter( Boolean );

		let paused = 0;
		this.getPlayers().forEach( ( player ) => {
			const el = player?.el?.();
			if ( ! el || ( container && ! container.contains( el ) ) ) {
				return;
			}
			const isException = exceptions.some( ( item ) =>
				item === player || ( item?.nodeType === 1 && ( item === el || el.contains( item ) ) ),
			);
			if ( isException || player.paused() ) {
				return;
			}
			const entry = this.entries.get( player );
			if ( entry ) {
				entry.resumeWhenVisible = false;
			}
			this.autoPause( player, 'api' );
			paused++;
		} );
		return paused;
	}

	// ---------------------------------------------------------------------
	// Internals
	// ---------------------------------------------------------------------

	getObserver() {
		if ( this.observer || typeof this.win.IntersectionObserver !== 'function' ) {
			return this.observer;
		}
		this.observer = new this.win.IntersectionObserver(
			( records ) => {
				records.forEach( ( record ) => {
					const entry = this.elementEntries.get( record.target );
					if ( ! entry || ! this.entries.has( entry.player ) ) {
						return;
					}
					entry.inViewport = isRecordVisible( record );
					this.evaluate( entry );
				} );
			},
			{ root: null, rootMargin: '0px', threshold: OBSERVER_THRESHOLDS },
		);
		return this.observer;
	}

	findPagePlayers() {
		return Array.from( this.doc.querySelectorAll( PLAYER_SELECTOR ) )
			.map( ( el ) => el.player || this.win.videojs?.getPlayer?.( el ) )
			.filter( Boolean );
	}

	hasRecentGesture( entry ) {
		return this.now() - entry.lastGestureAt <= GESTURE_WINDOW_MS;
	}

	handleGesture( entry, event ) {
		if ( event?.target?.closest?.( LAYER_SELECTOR ) ) {
			return;
		}
		entry.lastGestureAt = this.now();

		// A click can commit a running hover preview to real playback without a
		// new `play` event, so check again once the preview has handled it.
		if ( entry.isPreview() ) {
			this.win.setTimeout( () => {
				if ( this.entries.has( entry.player ) && ! entry.isPreview() && ! entry.player.paused() ) {
					this.markInteraction( entry.player );
				}
			}, 50 );
		}
	}

	handlePlay( entry ) {
		entry.lastTime = null;
		const byVisitor = this.hasRecentGesture( entry ) && ! entry.isPreview();
		if ( byVisitor ) {
			this.markInteraction( entry.player );
			return;
		}
		// Something other than the visitor resumed a hidden player (a script, a
		// hover handler, a sequence): apply the out-of-view rule again.
		if ( ! this.isVisible( entry ) ) {
			this.win.setTimeout( () => this.evaluate( entry ), 0 );
		}
	}

	handlePause( entry ) {
		entry.lastTime = null;
		if ( isAutoPause( entry.player ) ) {
			return;
		}
		// A manual pause counts as interaction, so the video stays paused.
		if ( this.hasRecentGesture( entry ) ) {
			this.markInteraction( entry.player );
		}
	}

	handleSeeking( entry ) {
		entry.lastTime = null;
		if ( this.hasRecentGesture( entry ) ) {
			this.markInteraction( entry.player );
		}
	}

	handleVolumeChange( entry ) {
		const { player } = entry;
		if ( player.muted() || player.volume() === 0 ) {
			return;
		}
		// Sound is on: the visitor has unmuted (we only ever mute).
		entry.autoMuted = false;
		if ( this.hasRecentGesture( entry ) && ! entry.isPreview() ) {
			this.markInteraction( player );
		}
	}

	handleTimeUpdate( entry ) {
		const { player } = entry;
		const time = player.currentTime();

		if ( entry.lastTime !== null && ! player.paused() ) {
			const delta = time - entry.lastTime;
			if ( delta > 0 && delta <= MAX_SEGMENT_GAP ) {
				if ( entry.autoMuted && ! this.isVisible( entry ) ) {
					player.godamHiddenRanges = addRange( player.godamHiddenRanges, entry.lastTime, time );
				} else {
					player.godamVisibleRanges = addRange( player.godamVisibleRanges, entry.lastTime, time );
				}
			}
		}
		entry.lastTime = time;

		this.refreshStyleVisibility( entry );
	}

	/**
	 * Update `styleVisible` from CSS (opacity/visibility/display on the player
	 * or any ancestor). This catches fade-effect carousels, which an
	 * IntersectionObserver reports as visible. Becoming visible applies at
	 * once; becoming hidden must last STYLE_HIDDEN_DEBOUNCE_MS.
	 *
	 * @param {Object}  entry            - Player entry.
	 * @param {Object}  [options]        - Options.
	 * @param {boolean} [options.notify] - Re-evaluate the player when the state changes.
	 */
	refreshStyleVisibility( entry, { notify = true } = {} ) {
		if ( typeof entry.el.checkVisibility !== 'function' ) {
			return;
		}
		const visible = entry.el.checkVisibility( { opacityProperty: true, visibilityProperty: true } );

		if ( visible ) {
			entry.styleHiddenSince = null;
			if ( ! entry.styleVisible ) {
				entry.styleVisible = true;
				if ( notify ) {
					this.evaluate( entry );
				}
			}
			return;
		}

		if ( ! entry.styleVisible ) {
			return;
		}
		if ( entry.styleHiddenSince === null ) {
			entry.styleHiddenSince = this.now();
			this.win.setTimeout( () => {
				if ( this.entries.has( entry.player ) ) {
					this.refreshStyleVisibility( entry );
				}
			}, STYLE_HIDDEN_DEBOUNCE_MS );
			return;
		}
		if ( this.now() - entry.styleHiddenSince >= STYLE_HIDDEN_DEBOUNCE_MS ) {
			entry.styleVisible = false;
			if ( notify ) {
				this.evaluate( entry );
			}
		}
	}

	isVisible( entry ) {
		return ! this.doc.hidden && entry.inViewport && entry.styleVisible;
	}

	isExempt( entry ) {
		const { player, el } = entry;
		// Moved into a Document Picture-in-Picture window.
		if ( el.ownerDocument && el.ownerDocument !== this.doc ) {
			return true;
		}
		if ( player.isFullscreen?.() || player.isInPictureInPicture?.() ) {
			return true;
		}
		// Custom iOS fullscreen (controlsManager) only toggles classes.
		if ( el.classList?.contains( CUSTOM_FULLSCREEN_PLAYER_CLASS ) ) {
			return true;
		}
		const tech = el.querySelector?.( 'video' );
		return !! tech && (
			this.doc.pictureInPictureElement === tech ||
			tech.webkitPresentationMode === 'picture-in-picture' ||
			!! tech.webkitDisplayingFullscreen
		);
	}

	inAdBreak( player ) {
		try {
			return !! player.ads?.inAdBreak?.();
		} catch ( e ) {
			return false;
		}
	}

	/**
	 * Apply the rules to a player after its visibility may have changed.
	 *
	 * @param {Object} entry - Player entry.
	 */
	evaluate( entry ) {
		const { player } = entry;
		if ( ! this.entries.has( player ) ) {
			return;
		}

		// A stale CSS-hidden flag must never pause a player that is showing again.
		if ( ! entry.styleVisible ) {
			this.refreshStyleVisibility( entry, { notify: false } );
		}

		if ( this.isVisible( entry ) ) {
			this.handleVisible( entry );
		} else if ( ! this.isExempt( entry ) ) {
			this.handleHidden( entry );
		}
		this.syncStylePoll();
	}

	handleVisible( entry ) {
		const { player } = entry;
		if ( entry.adPausedByUs ) {
			entry.adPausedByUs = false;
			if ( ! entry.userStarted ) {
				player.ima?.resumeAd?.();
			}
		}
		if ( ! entry.resumeWhenVisible ) {
			return;
		}
		entry.resumeWhenVisible = false;
		if ( player.paused() && ! entry.userStarted ) {
			const playPromise = player.play();
			if ( playPromise && typeof playPromise.catch === 'function' ) {
				playPromise.catch( () => {} );
			}
		}
	}

	handleHidden( entry ) {
		const { player } = entry;
		const muteInstead = entry.userStarted && entry.mode === OUT_OF_VIEW_MODE.MUTE;

		if ( this.inAdBreak( player ) ) {
			const ima = player.ima;
			if ( muteInstead && typeof ima?.getAdsManager === 'function' ) {
				ima.getAdsManager()?.setVolume?.( 0 );
			} else if ( typeof ima?.pauseAd === 'function' ) {
				ima.pauseAd();
				entry.adPausedByUs = true;
			}
			return;
		}

		if ( player.paused() ) {
			return;
		}

		if ( muteInstead ) {
			if ( ! player.muted() ) {
				entry.autoMuted = true;
				player.muted( true );
			}
			return;
		}

		if ( ! entry.userStarted ) {
			// Autoplay / script playback resumes when visible; hover previews don't.
			entry.resumeWhenVisible = ! entry.isPreview();
		}
		this.autoPause( player, 'visibility' );
	}

	/**
	 * Pause a player and flag the pause as automatic while it is dispatched.
	 *
	 * The `pause` event fires asynchronously, so the flag is cleared after it
	 * (with a timeout as a safety net), not right after `pause()`.
	 *
	 * @param {Object} player - Video.js player.
	 * @param {string} reason - `visibility` or `api`.
	 */
	autoPause( player, reason ) {
		player.godamAutoPause = true;
		player.godamAutoPauseReason = reason;

		let cleared = false;
		const clear = () => {
			if ( cleared ) {
				return;
			}
			cleared = true;
			player.godamAutoPause = false;
			player.godamAutoPauseReason = null;
		};
		player.one( 'pause', () => this.win.setTimeout( clear, 0 ) );
		this.win.setTimeout( clear, AUTO_PAUSE_FLAG_TIMEOUT_MS );

		player.pause();
	}

	/**
	 * While an auto-paused player waits behind CSS (e.g. an inactive fade
	 * slide), no `timeupdate` fires, so poll its CSS visibility to know when
	 * to resume it.
	 */
	syncStylePoll() {
		const waiting = Array.from( this.entries.values() ).filter(
			( entry ) => entry.resumeWhenVisible && ! entry.styleVisible,
		);

		if ( waiting.length && ! this.stylePollTimer ) {
			this.stylePollTimer = this.win.setInterval( () => {
				this.entries.forEach( ( entry ) => {
					if ( entry.resumeWhenVisible && ! entry.styleVisible ) {
						this.refreshStyleVisibility( entry );
					}
				} );
			}, STYLE_POLL_MS );
		} else if ( ! waiting.length && this.stylePollTimer ) {
			this.win.clearInterval( this.stylePollTimer );
			this.stylePollTimer = null;
		}
	}
}

/**
 * Page-wide shared instance. Stored on `window` so every bundle that imports
 * this module (player frontend, public API) uses the same manager.
 *
 * @return {VisibilityManager} The shared manager.
 */
export function getVisibilityManager() {
	if ( ! window.godamVisibilityManager ) {
		window.godamVisibilityManager = new VisibilityManager();
	}
	return window.godamVisibilityManager;
}
