/**
 * GoDAM Media Preview Page
 *
 * Handles two things on the shared front-end preview page: sizing the video
 * player container to the video's aspect ratio, and a Desktop / Mobile
 * device-view toggle that clamps the preview width. The toggle is shared across
 * all three media types (video, image, audio) — video width is clamped here,
 * while image and audio previews shrink to the narrowed wrapper purely via CSS.
 *
 * @since 1.5.0
 */

document.addEventListener( 'DOMContentLoaded', () => {
	const STORAGE_KEY = 'godamPreviewDeviceView';
	// Keep MOBILE_MAX_WIDTH in sync with --godam-preview-mobile-width in the SCSS.
	const MOBILE_MAX_WIDTH = 390;
	const DESKTOP_MAX_WIDTH = 768; // Max width as per design.

	const previewMain = document.querySelector( '.godam-video-preview-main' );
	const toggleButtons = document.querySelectorAll( '.godam-view-toggle__button' );

	// Active device view ('desktop' | 'mobile'). Read by the video sizing logic
	// below so the player width stays in sync with the toggle.
	let currentView = 'desktop';

	try {
		const storedView = window.localStorage.getItem( STORAGE_KEY );
		if ( 'mobile' === storedView || 'desktop' === storedView ) {
			currentView = storedView;
		}
	} catch ( error ) {
		// localStorage unavailable (private mode / disabled) — default to desktop.
	}

	// --- Video aspect-ratio sizing -------------------------------------------

	// Re-runnable sizing callbacks, one per video on the page. Called again on
	// window resize and whenever the device view changes.
	const resizeHandlers = [];

	const videoContainers = document.querySelectorAll(
		'.godam-video-preview .easydam-video-container',
	);

	videoContainers.forEach( ( container ) => {
		const videoElement = container.querySelector( 'video' );

		if ( ! videoElement ) {
			return;
		}

		// Get the Video.js player instance using getPlayer() to avoid creating
		// duplicate player instances.
		const playerId = videoElement.id;
		let player = null;

		if ( playerId && window.videojs ) {
			try {
				player = window.videojs.getPlayer( playerId );
			} catch ( error ) {
				// Player instance not found, continue without it.
			}
		}

		/**
		 * Sets the Video.js player aspect ratio and container width, clamped to
		 * the active device view.
		 */
		const setAspectRatio = () => {
			const videoWidth = videoElement.videoWidth;
			const videoHeight = videoElement.videoHeight;

			if ( ! videoWidth || ! videoHeight ) {
				return;
			}

			// Set the aspect ratio on the Video.js player.
			if ( player ) {
				const aspectRatio = `${ videoWidth }:${ videoHeight }`;
				player.aspectRatio( aspectRatio );
			}

			// Get the parent preview container.
			const previewContainer = container.closest( '.godam-video-preview' );
			if ( ! previewContainer ) {
				return;
			}

			// Desired max height for the video (matches video editor).
			const targetHeight = 450;

			// Calculate width based on aspect ratio.
			const calculatedWidth = Math.round( targetHeight * ( videoWidth / videoHeight ) );

			// Clamp to the active device view: a narrow column in mobile view,
			// the full design width in desktop view.
			const deviceMaxWidth = 'mobile' === currentView ? MOBILE_MAX_WIDTH : DESKTOP_MAX_WIDTH;

			// Get max width from parent container.
			const parentWidth = previewContainer.offsetWidth;
			const maxWidth = Math.min( parentWidth, deviceMaxWidth );

			// Constrain the width.
			const constrainedWidth = Math.min( calculatedWidth, maxWidth );

			// Set the container width.
			container.style.width = `${ constrainedWidth }px`;
			container.style.maxHeight = `${ targetHeight }px`;
		};

		// Fallback if Video.js player is not available.
		if ( videoElement.readyState >= 1 ) {
			setAspectRatio();
		} else {
			videoElement.addEventListener( 'loadedmetadata', setAspectRatio );
		}

		// Store resize handler for re-layout and cleanup.
		resizeHandlers.push( setAspectRatio );
		window.addEventListener( 'resize', setAspectRatio );
	} );

	// --- Device-view toggle ---------------------------------------------------

	/**
	 * Apply a device view: update the layout class, the button states, re-clamp
	 * the video width and persist the choice.
	 *
	 * @param {string} view Either 'mobile' or 'desktop'.
	 */
	const applyView = ( view ) => {
		currentView = 'mobile' === view ? 'mobile' : 'desktop';

		if ( previewMain ) {
			previewMain.classList.toggle( 'is-mobile-view', 'mobile' === currentView );
		}

		toggleButtons.forEach( ( button ) => {
			const isActive = button.dataset.godamView === currentView;
			button.classList.toggle( 'is-active', isActive );
			button.setAttribute( 'aria-pressed', isActive ? 'true' : 'false' );
		} );

		// Re-run the video sizing so the player re-clamps to the new width.
		resizeHandlers.forEach( ( handler ) => handler() );

		try {
			window.localStorage.setItem( STORAGE_KEY, currentView );
		} catch ( error ) {
			// Ignore persistence failures.
		}
	};

	toggleButtons.forEach( ( button ) => {
		button.addEventListener( 'click', () => {
			applyView( button.dataset.godamView );
		} );
	} );

	// Apply the initial (possibly persisted) view once listeners are wired up.
	applyView( currentView );

	// Cleanup function to remove all resize listeners.
	window.addEventListener( 'beforeunload', () => {
		resizeHandlers.forEach( ( handler ) => {
			window.removeEventListener( 'resize', handler );
		} );
	} );
} );
