/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable jsdoc/check-indentation */

/**
 * GoDAM Product Gallery Video Modal Module
 *
 * -----------------------------------------------------------------------------
 * Purpose:
 * -----------------------------------------------------------------------------
 * Manages the complete lifecycle of product gallery video modals in GoDAM.
 * This includes modal opening, video loading, timestamp seeking, sidebar
 * product rendering, swipe/scroll navigation, and cleanup logic.
 *
 * -----------------------------------------------------------------------------
 * Responsibilities:
 * -----------------------------------------------------------------------------
 * - Delegates click handling for play, unmute, and timestamp buttons.
 * - Dynamically resolves video IDs and attached product IDs.
 * - Opens and initializes the corresponding product video modal.
 * - Loads and controls Video.js playback instances.
 * - Handles timestamp-based seeking for deep-linked product videos.
 * - Conditionally initializes and resets the product sidebar (CTA logic).
 * - Registers and unregisters Escape key handlers via Escape Manager.
 * - Supports swipe/scroll navigation between gallery videos.
 * - Applies Safari-specific DOM handling to prevent rendering issues.
 * - Ensures proper teardown to prevent memory leaks.
 *
 * -----------------------------------------------------------------------------
 * Architecture Notes:
 * -----------------------------------------------------------------------------
 * - Uses event delegation for scalability and dynamic content support.
 * - Relies on shared utilities from the global video popup system.
 * - Separates concerns across sidebar, modal, navigation, and escape manager modules.
 *
 * This module is designed to be initialized once on DOM ready.
 */

/**
 * Internal dependencies
 */
import { initSidebar, loadSidebarProducts, resetSidebarState } from '../global-video-popup/sidebar.js';
import { parseTimestamp, isSafari } from '../global-video-popup/utility.js';
import { resetVideoModal, loadNewVideo, initScrollSwipeNavigation } from '../global-video-popup/video-modal.js';
import { registerEscapeHandler, unregisterEscapeHandler } from '../global-video-popup/escapeManager.js';

/**
 * Initializes product gallery video modal interactions.
 *
 * Attaches a delegated click listener to the document that:
 * - Detects clicks on play buttons, unmute buttons, or timestamp buttons.
 * - Resolves the associated video ID, attached product IDs, and CTA configuration.
 * - Locates and opens the corresponding product video modal.
 * - Handles Safari-specific DOM adjustments for timestamped modals.
 * - Initializes sidebar (if CTA is enabled and displayed inside the modal).
 * - Registers close behaviors:
 *    - Close button click
 *    - Outside click
 *    - Escape key press
 * - Loads and plays the selected video.
 * - Loads associated sidebar products (when applicable).
 * - Handles timestamp-based seeking for product-linked videos.
 * - Initializes scroll/swipe navigation for gallery videos inside the modal.
 *
 * This function ensures all product gallery video interactions are
 * dynamically handled via event delegation after DOM initialization.
 *
 * @return {void}
 */
export function initProductGalleryVideoModal() {
	document.addEventListener( 'click', async function( e ) {
		const playButton = e.target.closest( '.godam-play-button' ) || e.target.closest( '.godam-unmute-button' );
		const timestampBtn = e.target.closest( '.product-play-timestamp-button' );

		if ( ! playButton && ! timestampBtn ) {
			return;
		}

		let getVideoId = null;
		let getProductIds = null;
		let getCTAEnabled = null;
		let getCTADisplayPosition = null;

		if ( playButton ) {
			const productVideo = playButton.previousElementSibling;
			getVideoId = productVideo && ( productVideo.classList.contains( 'godam-product-video' ) || productVideo.classList.contains( 'godam-product-video-thumbnail' ) )
				? productVideo.getAttribute( 'data-video-id' )
				: null;
			getProductIds = productVideo && ( productVideo.classList.contains( 'godam-product-video' ) || productVideo.classList.contains( 'godam-product-video-thumbnail' ) )
				? productVideo.getAttribute( 'data-video-attached-product-ids' )
				: null;
			getCTAEnabled = productVideo && ( productVideo.classList.contains( 'godam-product-video' ) || productVideo.classList.contains( 'godam-product-video-thumbnail' ) )
				? productVideo.getAttribute( 'data-cta-enabled' )
				: null;
			getCTADisplayPosition = productVideo && ( productVideo.classList.contains( 'godam-product-video' ) || productVideo.classList.contains( 'godam-product-video-thumbnail' ) )
				? productVideo.getAttribute( 'data-cta-display-position' )
				: null;
		}

		if ( timestampBtn ) {
			getVideoId = timestampBtn?.getAttribute( 'data-video-id' );
			getProductIds = timestampBtn?.getAttribute( 'data-video-attached-product-id' );
			getCTAEnabled = timestampBtn?.getAttribute( 'data-cta-enabled' );
			getCTADisplayPosition = timestampBtn?.getAttribute( 'data-cta-display-position' );
		}

		const videoId = getVideoId;

		if ( ! videoId ) {
			return;
		}

		const videoProductIds = getProductIds; // Timestamped product id.
		const ctaEnabled = getCTAEnabled;
		const ctaDisplayPosition = getCTADisplayPosition;

		let gallery = ( playButton || timestampBtn ).closest( '.godam-product-gallery' );

		let getModal = null;

		if ( timestampBtn ) {
			const activeDropdown = document.querySelector( '.cta-dropdown.visible' );
			getModal = activeDropdown?.querySelector(
				`.godam-product-modal-container[data-modal-video-id="${ videoId }"][data-modal-timestamped="1"][data-modal-attached-product-id="${ videoProductIds }"]`,
			);

			if ( gallery === null ) {
				const sourceId = activeDropdown?.dataset.sourceDropdownId;
				const originalDropdown = document.querySelector( `.cta-dropdown[data-source-dropdown-id="${ sourceId }"]` );
				gallery = originalDropdown?.closest( '.godam-product-gallery' );
			}
		} else {
			getModal = gallery.querySelector(
				`.godam-product-modal-container[data-modal-video-id="${ videoId }"]:not([data-modal-timestamped]),
				 .godam-product-modal-container[data-modal-video-id="${ videoId }"][data-modal-timestamped="0"]`,
			);
		}

		const currentGallery = gallery;

		const modal = getModal;

		if ( isSafari() && timestampBtn ) {
			document.body.appendChild( modal );
		}

		modal.querySelector( '.godam-sidebar-header-actions' )?.classList.add( 'hide' );

		modal.classList.add( 'open' );

		if ( ctaEnabled && ( ctaDisplayPosition === 'below-inside' || ctaDisplayPosition === 'inside' ) ) {
			initSidebar();
		}

		modal.dataset.currentVideoId = videoId;
		modal.dataset.isLoading = 'false';
		modal.dataset.ctaEnabled = String( ctaEnabled );
		modal.dataset.ctaDisplayPosition = ctaDisplayPosition;

		const sidebarModal = modal.querySelector( '.godam-product-sidebar' );

		/* Close Modal and Product sidebar on clicking x */
		modal.querySelector( '.godam-product-modal-close' )?.addEventListener( 'click', () => close( modal, sidebarModal, ctaEnabled, ctaDisplayPosition ) );

		/* Clicking outside the modal content and sidebar closes the Modal */
		modal.addEventListener( 'click', ( ev ) => {
			if (
				! ev.target.closest( '.godam-product-modal-content' ) &&
				! ev.target.closest( '.godam-product-sidebar' )
			) {
				close( modal, sidebarModal, ctaEnabled, ctaDisplayPosition );
			}
		} );

		const handleEscapeClose = () => {
			close( modal, sidebarModal, ctaEnabled, ctaDisplayPosition );
			unregisterEscapeHandler( handleEscapeClose );
		};

		modal._escapeHandler = handleEscapeClose;

		registerEscapeHandler( handleEscapeClose );

		/* Loads the video, Opens popup screen */
		modal.classList.remove( 'hidden' );
		await loadNewVideo( videoId, modal, true, 'godam-product-gallery', true );

		// /* Loads Product Sidebar */
		await loadProductGallerySidebar( videoProductIds, sidebarModal, ctaEnabled, ctaDisplayPosition, modal );

		/* Timestamp button logic. */
		if ( timestampBtn ) {
			const timestamp = parseTimestamp( timestampBtn.getAttribute( 'data-timestamp' ) );

			if ( ! isNaN( timestamp ) ) {
				const trySeek = () => {
					const player = modal.querySelector( '.video-js' );
					if ( player?.player ) {
						player.player.ready( () => {
							player.player.currentTime( timestamp );
							player.player.play();
						} );
					} else {
						setTimeout( trySeek, 200 );
					}
				};
				trySeek();
			}
		}

		/** Scroll/swipe nav for modal */
		initProductGalleryScrollSwipeNavigation( modal, currentGallery, sidebarModal, ctaEnabled, ctaDisplayPosition );
	} );
}

/**
 * Closes the product video modal and performs necessary cleanup.
 *
 * Responsibilities:
 * - Unregisters the modal-specific escape key handler.
 * - Resets the video modal state (stops playback, clears UI states).
 * - Resets sidebar state when CTA is enabled and displayed inside the modal.
 * - Removes the modal from the DOM in Safari (to handle rendering quirks).
 *
 * @param {HTMLElement}      modal              The main modal element.
 * @param {HTMLElement|null} sidebarModal       The sidebar modal element (if present).
 * @param {boolean}          ctaEnabled         Whether CTA functionality is enabled.
 * @param {string}           ctaDisplayPosition CTA display position (e.g., 'below-inside', 'inside').
 */
function close( modal, sidebarModal, ctaEnabled, ctaDisplayPosition ) {
	if ( modal._escapeHandler ) {
		unregisterEscapeHandler( modal._escapeHandler );
		modal._escapeHandler = null;
	}

	resetVideoModal( modal );

	if ( ctaEnabled && ( ctaDisplayPosition === 'below-inside' || ctaDisplayPosition === 'inside' ) ) {
		const modalContent = modal.querySelector( '.godam-product-modal-content' );
		resetSidebarState( modal, sidebarModal, modalContent );
	}

	if ( isSafari() && modal.parentElement === document.body ) {
		modal.remove();
	}
}

/**
 * Loads and renders the product gallery sidebar inside the video modal
 * when CTA is enabled and configured to display within the modal.
 *
 * Execution conditions:
 * - `productIds` and `sidebarModal` must be provided.
 * - CTA must be enabled.
 * - CTA display position must be either 'below-inside' or 'inside'.
 *
 * If all conditions are met, it asynchronously loads the sidebar products
 * into the provided sidebar modal container.
 *
 * @async
 * @param {Array<number>|string} productIds         List of product IDs associated with the gallery.
 * @param {HTMLElement}          sidebarModal       The sidebar modal container element.
 * @param {boolean}              ctaEnabled         Whether CTA functionality is enabled.
 * @param {string}               ctaDisplayPosition CTA display position configuration.
 * @param {HTMLElement}          modal              The main video modal element.
 *
 * @return {Promise<void>}                     Resolves when sidebar products are loaded.
 */
async function loadProductGallerySidebar( productIds, sidebarModal, ctaEnabled, ctaDisplayPosition, modal ) {
	if ( ! productIds || ! sidebarModal ) {
		return;
	}

	if ( ! ctaEnabled ) {
		return;
	}

	if ( ctaDisplayPosition !== 'below-inside' && ctaDisplayPosition !== 'inside' ) {
		return;
	}

	await loadSidebarProducts( productIds, sidebarModal, modal );
}

/**
 * Initializes scroll and swipe navigation for the product gallery video modal.
 *
 * This sets up gesture-based navigation (scroll/swipe) between product videos
 * within the current gallery. On slide change, it optionally reloads the
 * associated sidebar products when CTA is enabled and configured to display
 * inside the modal.
 *
 * Responsibilities:
 * - Dynamically retrieves current video items from the gallery.
 * - Configures scroll/swipe navigation for the modal video container.
 * - Triggers sidebar product reload when the active product changes.
 *
 * @param {HTMLElement}      modal              The main product video modal element.
 * @param {HTMLElement}      currentGallery     The active product gallery container.
 * @param {HTMLElement|null} sidebarModal       The sidebar modal container (if present).
 * @param {boolean}          ctaEnabled         Whether CTA functionality is enabled.
 * @param {string}           ctaDisplayPosition CTA display position configuration.
 */
function initProductGalleryScrollSwipeNavigation( modal, currentGallery, sidebarModal, ctaEnabled, ctaDisplayPosition ) {
	// Utility: fetch current video items fresh from gallery.
	const getCurrentVideoItems = () => {
		const videos = currentGallery?.querySelectorAll( '.godam-product-video' );
		if ( videos?.length ) {
			return videos;
		}

		return currentGallery?.querySelectorAll( '.godam-product-video-thumbnail' ) || [];
	};

	const videoModal = modal.querySelector( '.godam-product-video-container' );
	const currentVideoItems = getCurrentVideoItems();

	initScrollSwipeNavigation(
		modal,
		videoModal,
		currentVideoItems,
		true,
		'godam-product-gallery',
		true,
		async ( newProductIds ) => {
			await loadProductGallerySidebar(
				newProductIds,
				sidebarModal,
				ctaEnabled,
				ctaDisplayPosition,
				modal,
			);
		},
	);
}
