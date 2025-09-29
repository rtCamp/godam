/**
 * Preview Manager
 * Handles video preview functionality and state management
 */
export default class PreviewManager {
	constructor( player, video, config ) {
		this.player = player;
		this.video = video;
		this.config = config;
		this.isPreview = null;
		this.previewTimeoutId = null;
		this.isVideoClicked = false;
		this.previewWatcher = null;

		if ( config.isPreviewEnabled ) {
			this.initialize();
		}
	}

	/**
	 * Initialize preview functionality
	 */
	initialize() {
		this.setupPreviewWatcher();
		this.setupPreviewEventListeners();
	}

	/**
	 * Setup preview state watcher
	 */
	setupPreviewWatcher() {
		const self = this;
		this.previewWatcher = {
			set value( newValue ) {
				if ( self.isPreview !== newValue ) {
					self.isPreview = newValue;
					self.handlePreviewStateChange( newValue );
				}
			},
			get value() {
				return self.isPreview;
			},
		};
	}

	/**
	 * Handle preview state changes
	 *
	 * @param {boolean} newValue - New preview state value
	 */
	handlePreviewStateChange( newValue ) {
		// This will be called by the layers manager when needed
		if ( this.onPreviewStateChange ) {
			this.onPreviewStateChange( newValue );
		}
	}

	/**
	 * Set callback for preview state changes
	 *
	 * @param {Function} callback - Callback function to handle state changes
	 */
	setPreviewStateChangeCallback( callback ) {
		this.onPreviewStateChange = callback;
	}

	/**
	 * Setup preview event listeners
	 */
	setupPreviewEventListeners() {
		this.video.addEventListener( 'click', () => this.handleVideoClick() );
		this.video.addEventListener( 'mouseenter', () => this.handleVideoMouseEnter() );
		this.video.addEventListener( 'mouseleave', ( e ) => this.handleVideoMouseLeave( e ) );
	}

	/**
	 * Handle video click for preview
	 */
	handleVideoClick() {
		this.isVideoClicked = true;
		this.clearPreviewTimeout();

		if ( this.previewWatcher.value ) {
			this.player.currentTime( 0 );
		}

		this.previewWatcher.value = false;
		this.removeControlBarHide();
		this.removeMuteButton();
	}

	/**
	 * Handle video mouse enter for preview
	 */
	handleVideoMouseEnter() {
		if ( this.video.currentTime > 0 || this.isVideoClicked ) {
			return;
		}

		this.startPreview();
		this.previewTimeoutId = setTimeout( () => {
			if ( this.previewWatcher.value && this.config.isPreviewEnabled ) {
				this.stopPreview();
				this.previewWatcher.value = false;
			}
		}, 10000 );
	}

	/**
	 * Handle video mouse leave for preview
	 *
	 * @param {Event} e - Mouse event object
	 */
	handleVideoMouseLeave( e ) {
		const relatedElement = e.relatedTarget || e.toElement;
		const hasEasydamPlayer = relatedElement?.parentElement?.className?.indexOf( 'easydam-player' ) !== -1;

		if ( ! this.previewWatcher.value || hasEasydamPlayer ) {
			return;
		}

		this.player.currentTime( 0 );
		this.player.pause();
		this.stopPreview();
	}

	/**
	 * Start preview mode
	 */
	startPreview() {
		this.player.volume( 0 );
		this.player.currentTime( 0 );

		const controlBarElement = this.player.controlBar.el();
		controlBarElement?.classList.add( 'hide' );

		this.previewWatcher.value = true;
		this.player.play();
	}

	/**
	 * Stop preview mode
	 */
	stopPreview() {
		this.removeControlBarHide();
		this.removeMuteButton();
		this.player.pause();
		this.player.currentTime( 0 );
	}

	/**
	 * Remove control bar hide class
	 */
	removeControlBarHide() {
		const controlBarElement = this.player.controlBar.el();
		controlBarElement?.classList.remove( 'hide' );
	}

	/**
	 * Remove mute button styling
	 */
	removeMuteButton() {
		const muteButton = document.querySelector( '.mute-button' );
		muteButton?.classList.remove( 'mute-button' );
	}

	/**
	 * Clear preview timeout
	 */
	clearPreviewTimeout() {
		if ( this.previewTimeoutId ) {
			clearTimeout( this.previewTimeoutId );
			this.previewTimeoutId = null;
		}
	}

	/**
	 * Get preview watcher
	 *
	 * @return {Object} Preview watcher object
	 */
	getPreviewWatcher() {
		return this.previewWatcher;
	}
}
