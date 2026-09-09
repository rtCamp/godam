/**
 * HoverManager
 *
 * A utility class for managing hover-based video interactions using Video.js.
 * It supports two primary behaviors:
 *
 * 1. **Preview Mode (`hover-select="start-preview"`)**
 * - Plays a muted preview after a short hover-intent delay (the pointer must
 * linger on the video), so a pointer merely passing over it does nothing.
 * - Stops and resets the preview when the mouse leaves.
 * - On click during preview, switches to normal playback (unmuted, with controls).
 *
 * 2. **Controls Visibility Mode (`hover-select="show-player-controls"`)**
 * - Shows Video.js controls when hovering over the video.
 * - Hides controls when the mouse leaves while the video is playing.
 * - Keeps controls visible when paused.
 *
 * The class uses `mouseenter`, `mouseleave`, `click`, `play`, and `pause` events
 * to manage state transitions, controls, and playback.
 *
 * @class HoverManager
 * @param {Object}      player       - The Video.js player instance.
 * @param {HTMLElement} videoElement - The target video element.
 * @param {Object}      [options={}] - Optional configuration for extra behaviors.
 *
 * @example
 * const hoverManager = new HoverManager(playerInstance, videoElement);
 */
// How long the pointer must linger over the video before a hover preview
// actually starts. Prevents play/pause churn when the pointer merely passes
// across the video on its way somewhere else.
const PREVIEW_START_DELAY_MS = 700;

// Shared across every hover preview on the page: once the viewer unmutes any
// preview, later previews start unmuted too (reel-like), and vice-versa. Lives
// for the page session only. Previews always begin muted at the browser level
// so autoplay is never blocked; this preference is re-applied once playback
// has actually started.
let previewSessionMuted = true;

// Video.js mute-toggle volume-state classes. Reusing them (plus the Video.js
// button/icon-placeholder markup) means the preview toggle renders with the
// exact same volume glyph as the player's own control bar for every skin: the
// bundled Video.js icon font drives the default and bubble skins, and the
// classic skin's SVG override is extended to this button in its own stylesheet.
const VJS_VOL_MUTED = 'vjs-vol-0';
const VJS_VOL_ON = 'vjs-vol-3';

class HoverManager {
	constructor( player, videoElement, options = {} ) {
		this.player = player;
		this.videoElement = videoElement;
		this.hoverSelect = videoElement.dataset.hoverSelect || 'none';
		this.isVideoClicked = false;
		this.isHovered = false;
		// Delay (ms) before a lingering hover starts the preview, and the handle of
		// the pending timer so `mouseleave`/click can cancel a start that has not
		// fired yet.
		this.previewDelay = options.previewDelay ?? PREVIEW_START_DELAY_MS;
		this.previewTimer = null;
		// True while an uncommitted hover preview is running. Interactive layers
		// are suppressed for its duration – a preview is a playback teaser, not
		// a place to show forms/CTAs/hotspots.
		this.isPreviewPlaying = false;
		// Set by `startPreview()` immediately before it calls `player.play()`, so
		// the preview's own (asynchronous) `play` event can be told apart from a
		// `play` event that signals real, committed playback. Consumed once in the
		// `play` handler.
		this.isPreviewInitiatedPlay = false;
		this.options = options;

		this.init();
	}

	/**
	 * Initializes the hover manager based on the hoverSelect type.
	 * Sets up event listeners for the appropriate behavior.
	 */
	init() {
		// Hover behaviour is incompatible with autoplay – skip initialisation
		// entirely so shortcodes/WPBakery/cached blocks with a stale hoverSelect
		// value cannot start hover mode on an autoplay-enabled player.
		if ( this.videoElement.dataset.autoplayOnView === 'true' || this.player.autoplay() ) {
			return;
		}

		if ( this.hoverSelect === 'start-preview' ) {
			this.setupPreview();
		} else if ( this.hoverSelect === 'show-player-controls' ) {
			this.setupControlsVisibility();
		}
	}

	/**
	 * Sets up event listeners for preview mode behavior.
	 * Handles mouseenter, mouseleave, and click events for video previews.
	 */
	setupPreview() {
		this.buildPreviewOverlays();

		// Hover is tracked on the player root, not the <video>, so moving the
		// pointer onto an overlay control (the mute button) does not fire a
		// `mouseleave` on the video and tear the preview down mid-hover.
		this.hoverTarget = this.player.el() || this.videoElement;
		this.hoverTarget.addEventListener( 'mouseenter', this.handleMouseEnter.bind( this ) );
		this.hoverTarget.addEventListener( 'mouseleave', this.handleMouseLeave.bind( this ) );
		this.videoElement.addEventListener( 'click', this.handleVideoClick.bind( this ) );

		// Advance the reel progress stripe as the preview plays.
		this.player.on( 'timeupdate', this.updatePreviewProgress.bind( this ) );

		// Any `play` event other than the preview's own means real, committed
		// playback has begun – e.g. the big play button, the control bar, the
		// spacebar/keyboard handler, or a programmatic `player.play()`, none of
		// which reach the <video> element to run `handleVideoClick`. Clear the
		// preview flag so layers resume working.
		//
		// The preview's OWN `play` (queued by `startPreview()`) must not clear the
		// flag: on a fast hover-flick that `play` can land after `mouseleave` has
		// already queued the preview's `pause`, and clearing here would let the
		// `on_pause` CTA slip through over the preview the pointer just left.
		// `isPreviewInitiatedPlay` distinguishes the two regardless of hover
		// state, which also covers real playback committed while still hovering.
		this.player.on( 'play', () => {
			if ( this.isPreviewInitiatedPlay ) {
				this.isPreviewInitiatedPlay = false;
				return;
			}
			// Real, committed playback. Lift suppression and mark the player as
			// committed so a later hover cannot restart a preview over it – the
			// big play button / control bar never reach `handleVideoClick`, so
			// `isVideoClicked` would otherwise stay false and re-enable preview.
			this.isPreviewPlaying = false;
			this.isVideoClicked = true;
			this.togglePreviewOverlays( false );
		} );
	}

	/**
	 * Sets up event listeners for controls visibility mode.
	 * Manages showing/hiding controls based on hover and playback state.
	 */
	setupControlsVisibility() {
		this.player.addClass( 'godam-show-controls-on-hover' ); // Add class to manage controls visibility on hover
	}

	/**
	 * Builds the preview-only overlay chrome: a reel-style progress stripe along
	 * the bottom edge and a mute/unmute toggle in the top-right corner. Both are
	 * created once, hidden, and appended to the player root; they are shown only
	 * while a preview is actually playing.
	 */
	buildPreviewOverlays() {
		const root = this.player.el();
		if ( ! root ) {
			return;
		}

		// The overlay share / transcript buttons live on this ancestor container
		// (outside `.video-js`), so they are toggled from here while previewing.
		this.previewContainer = root.closest( '.easydam-video-container' );

		// Reel-style progress stripe (presentational – no scrubbing).
		this.previewProgress = document.createElement( 'div' );
		this.previewProgress.className = 'godam-preview-progress';
		this.previewProgress.setAttribute( 'aria-hidden', 'true' );

		this.previewProgressFill = document.createElement( 'div' );
		this.previewProgressFill.className = 'godam-preview-progress__fill';
		this.previewProgress.appendChild( this.previewProgressFill );

		// Mute / unmute toggle. Built with the same markup and classes as
		// Video.js's own MuteToggle (`vjs-mute-control` + a `vjs-icon-placeholder`
		// span) so the active skin styles its glyph exactly like the control bar.
		this.previewMuteButton = document.createElement( 'button' );
		this.previewMuteButton.type = 'button';
		this.previewMuteButton.className = 'godam-preview-mute vjs-mute-control vjs-control vjs-button';
		this.previewMuteButton.innerHTML =
			'<span class="vjs-icon-placeholder" aria-hidden="true"></span>' +
			'<span class="vjs-control-text" aria-live="polite"></span>';
		this.previewMuteIcon = this.previewMuteButton.querySelector( '.vjs-control-text' );
		this.previewMuteButton.addEventListener( 'click', this.handleMuteToggle.bind( this ) );

		root.appendChild( this.previewProgress );
		root.appendChild( this.previewMuteButton );

		this.updateMuteButton();
		this.togglePreviewOverlays( false );
	}

	/**
	 * Shows or hides the preview overlay chrome, and flags the video container so
	 * the share / transcript overlay buttons are hidden for the preview's
	 * duration (a preview is a teaser, not a place to share or read transcripts).
	 *
	 * @param {boolean} visible - Whether the preview chrome should be visible.
	 */
	togglePreviewOverlays( visible ) {
		if ( this.previewProgress ) {
			this.previewProgress.classList.toggle( 'is-visible', visible );
		}
		if ( this.previewMuteButton ) {
			this.previewMuteButton.classList.toggle( 'is-visible', visible );
		}
		if ( this.previewContainer ) {
			this.previewContainer.classList.toggle( 'godam-hover-preview-active', visible );
		}
	}

	/**
	 * Redraws the reel progress stripe from the current playback position.
	 * No-ops unless a preview is actively playing.
	 */
	updatePreviewProgress() {
		if ( ! this.isPreviewPlaying || ! this.previewProgressFill ) {
			return;
		}

		const duration = this.player.duration();
		if ( ! duration || ! isFinite( duration ) ) {
			return;
		}

		const percent = Math.min( 100, ( this.player.currentTime() / duration ) * 100 );
		this.previewProgressFill.style.width = `${ percent }%`;
	}

	/**
	 * Applies the session mute preference to the player and syncs the button
	 * icon. Kept separate from `player.muted()` so preview start (always muted
	 * for autoplay) and the viewer's stored choice stay in one place.
	 */
	applyPreviewMute() {
		this.player.muted( previewSessionMuted );
		this.updateMuteButton();
	}

	/**
	 * Reflects the current mute state on the toggle button. Only the Video.js
	 * volume-state class is swapped (`vjs-vol-0` ↔ `vjs-vol-3`) so the skin's CSS
	 * paints the matching glyph; the label/ARIA describe the action available.
	 */
	updateMuteButton() {
		if ( ! this.previewMuteButton ) {
			return;
		}

		this.previewMuteButton.classList.toggle( VJS_VOL_MUTED, previewSessionMuted );
		this.previewMuteButton.classList.toggle( VJS_VOL_ON, ! previewSessionMuted );

		const label = previewSessionMuted ? 'Unmute' : 'Mute';
		this.previewMuteButton.setAttribute( 'aria-label', label );
		this.previewMuteButton.setAttribute( 'title', label );
		this.previewMuteButton.setAttribute( 'aria-pressed', String( ! previewSessionMuted ) );
		if ( this.previewMuteIcon ) {
			this.previewMuteIcon.textContent = label;
		}
	}

	/**
	 * Toggles preview sound without committing to full playback.
	 *
	 * Stops the click from reaching the <video> (which would switch to normal
	 * playback) and persists the choice for the rest of the page session so
	 * later previews honour it.
	 *
	 * @param {Event} event - The click event on the mute button.
	 */
	handleMuteToggle( event ) {
		event.preventDefault();
		event.stopPropagation();

		previewSessionMuted = ! previewSessionMuted;
		this.applyPreviewMute();
	}

	/**
	 * Handles mouse enter events - starts preview if conditions are met.
	 */
	handleMouseEnter() {
		if ( this.isVideoClicked ) {
			return;
		}

		this.isHovered = true;

		// Defer the actual preview so a pointer that only grazes the video never
		// starts playback. The visual "started" state is flipped alongside the
		// play in the timer callback so the poster/controls do not change until
		// the preview truly begins.
		this.clearPreviewTimer();
		this.previewTimer = setTimeout( () => {
			this.previewTimer = null;

			// A leave or click may have landed during the delay window.
			if ( ! this.isHovered || this.isVideoClicked ) {
				return;
			}

			this.player.addClass( 'vjs-has-started' );
			this.player.removeClass( 'godam-hover-started' );

			this.startPreview();
		}, this.previewDelay );
	}

	/**
	 * Handles mouse leave events - stops preview if currently active.
	 */
	handleMouseLeave() {
		if ( this.isVideoClicked ) {
			return;
		}

		if ( this.isHovered ) {
			this.isHovered = false;

			// Cancel a preview that was still waiting out the hover delay.
			this.clearPreviewTimer();

			// Only tear down the "started" visual state and playback if the
			// preview actually began; otherwise nothing was ever changed.
			if ( this.isPreviewPlaying ) {
				this.player.removeClass( 'vjs-has-started' );
				this.player.addClass( 'godam-hover-started' );
				this.stopPreview();
			}
		}
	}

	/**
	 * Cancels a pending (delayed) preview start, if any.
	 */
	clearPreviewTimer() {
		if ( this.previewTimer ) {
			clearTimeout( this.previewTimer );
			this.previewTimer = null;
		}
	}

	/**
	 * Handles video click events - switches from preview to normal playback.
	 */
	handleVideoClick() {
		if ( this.isVideoClicked ) {
			return;
		}

		if ( this.isHovered ) {
			this.isVideoClicked = true;
			this.isPreviewPlaying = false;

			// A click within the hover-delay window commits straight to real
			// playback – drop the still-pending preview start.
			this.clearPreviewTimer();

			// Real playback: unmute and hand the chrome back to the control bar.
			this.togglePreviewOverlays( false );
			this.player.muted( false );
			this.player.volume( 1 );
			this.player.play();

			const controlBar = this.player.controlBar?.el();
			if ( controlBar ) {
				controlBar.classList.remove( 'hide' );
			}
		}
	}

	/**
	 * Starts the video preview by playing the video muted and hiding controls.
	 */
	startPreview() {
		this.isPreviewPlaying = true;
		// Mark the play() below as preview-initiated so the `play` handler ignores
		// it and does not lift layer suppression for the preview itself.
		this.isPreviewInitiatedPlay = true;

		// Always begin muted so the hover-triggered autoplay is never blocked;
		// the session preference is re-applied once playback has started.
		this.player.muted( true );
		this.player.volume( 1 );
		this.player.currentTime( 0 );

		const controlBar = this.player.controlBar?.el();
		if ( controlBar ) {
			controlBar.classList.add( 'hide' );
		}

		// Reset and reveal the reel chrome for this preview.
		if ( this.previewProgressFill ) {
			this.previewProgressFill.style.width = '0%';
		}
		this.updateMuteButton();
		this.togglePreviewOverlays( true );

		const played = this.player.play();
		Promise.resolve( played )
			.then( () => this.applyPreviewMute() )
			.catch( () => {} );
	}

	/**
	 * Stops preview, resets video to start, and shows controls.
	 */
	stopPreview() {
		this.togglePreviewOverlays( false );
		this.player.pause();
		this.player.currentTime( 0 );
	}

	/**
	 * Whether an uncommitted hover preview is in progress.
	 *
	 * Deliberately keyed off the live preview flag rather than `hoverSelect`, so
	 * autoplay players (where `init()` bails out) and `show-player-controls`
	 * mode can never report a preview. The flag is intentionally NOT cleared by
	 * `stopPreview()`: `pause()` emits its event asynchronously, so clearing it
	 * there would let an `on_pause` CTA slip through as the pointer leaves.
	 *
	 * @return {boolean} True while a hover preview is active.
	 */
	isPreviewActive() {
		return this.isPreviewPlaying;
	}
}

export default HoverManager;
