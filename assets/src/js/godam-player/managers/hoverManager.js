/**
 * HoverManager
 *
 * A utility class for managing hover-based video interactions using Video.js.
 * It supports two primary behaviors:
 *
 * 1. **Preview Mode (`hover-select="start-preview"`)**
 * - Plays a muted preview on mouse hover.
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
class HoverManager {
	constructor( player, videoElement, options = {} ) {
		this.player = player;
		this.videoElement = videoElement;
		this.hoverSelect = videoElement.dataset.hoverSelect || 'none';
		this.isVideoClicked = false;
		this.isPreview = false;
		this.isHovered = false; // Track hover state
		this.options = options;

		this.init();
	}

	/**
	 * Initializes the hover manager based on the hoverSelect type.
	 * Sets up event listeners for the appropriate behavior.
	 */
	init() {
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
		this.videoElement.addEventListener( 'mouseenter', this.handleMouseEnter.bind( this ) );
		this.videoElement.addEventListener( 'mouseleave', this.handleMouseLeave.bind( this ) );
		this.videoElement.addEventListener( 'click', this.handleVideoClick.bind( this ) );
	}

	/**
	 * Sets up event listeners for controls visibility mode.
	 * Manages showing/hiding controls based on hover and playback state.
	 */
	setupControlsVisibility() {
		this.videoElement.addEventListener( 'mouseenter', this.handleShowControls.bind( this ) );
		this.videoElement.addEventListener( 'mouseleave', this.handleHideControls.bind( this ) );

		// Show controls when paused
		this.player.on( 'pause', this.handlePause.bind( this ) );
		this.player.on( 'play', this.handlePlay.bind( this ) );
	}

	/**
	 * Handles mouse enter events - starts preview if conditions are met.
	 */
	handleMouseEnter() {
		this.isHovered = true;

		if ( this.player.currentTime() > 0 || this.isVideoClicked ) {
			return;
		}
		this.startPreview();
	}

	/**
	 * Handles mouse leave events - stops preview if currently active.
	 */
	handleMouseLeave() {
		this.isHovered = false;

		if ( this.isPreview ) {
			this.stopPreview();
		}
	}

	/**
	 * Handles video click events - switches from preview to normal playback.
	 */
	handleVideoClick() {
		if ( this.isPreview ) {
			this.isVideoClicked = true;
			this.isPreview = false;

			// Unmute and continue playing
			this.player.volume( 1 );
			this.player.play(); // Ensures playback continues

			// Show controls
			const controlBar = this.player.controlBar?.el();
			if ( controlBar ) {
				controlBar.classList.remove( 'hide' );
			}

			return; // Prevent default pause
		}

		this.isVideoClicked = true;
	}

	/**
	 * Shows video controls when mouse enters the video element.
	 */
	handleShowControls() {
		this.isHovered = true;
		this.player.addClass( 'vjs-has-started' );
		this.player.controls( true );
	}

	/**
	 * Hides video controls when mouse leaves the video element.
	 */
	handleHideControls() {
		this.isHovered = false;
		this.player.removeClass( 'vjs-has-started' );
	}

	/**
	 * Keeps controls visible when video is paused.
	 */
	handlePause() {
		this.player.controls( true );
	}

	/**
	 * Hides controls when video starts playing (if not hovered).
	 */
	handlePlay() {
		if ( ! this.isHovered ) {
			this.player.controls( false );
		}
	}

	/**
	 * Starts muted preview playback from the beginning.
	 */
	startPreview() {
		this.player.volume( 0 );
		this.player.currentTime( 0 );

		const controlBar = this.player.controlBar?.el();
		if ( controlBar ) {
			controlBar.classList.add( 'hide' );
		}

		this.isPreview = true;
		this.player.play();
	}

	/**
	 * Stops preview, resets video to start, and shows controls.
	 */
	stopPreview() {
		const controlBar = this.player.controlBar?.el();
		if ( controlBar ) {
			controlBar.classList.remove( 'hide' );
		}

		this.isPreview = false;
		this.player.pause();
		this.player.currentTime( 0 );
	}
}

export default HoverManager;
