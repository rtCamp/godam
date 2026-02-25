/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-console */

/* global GODAMPlayer, godamWooVars */

/**
 * GoDAM Video Modal Core Module
 *
 * -----------------------------------------------------------------------------
 * Purpose:
 * -----------------------------------------------------------------------------
 * Manages the core video lifecycle inside the GoDAM modal system.
 * This module handles video loading, player initialization, swipe hint
 * behavior, modal reset/cleanup, and vertical scroll/swipe navigation
 * between videos.
 *
 * -----------------------------------------------------------------------------
 * Core Responsibilities:
 * -----------------------------------------------------------------------------
 * - Reset and dispose Video.js player instances when modal closes.
 * - Dynamically fetch and inject video markup via REST API.
 * - Initialize GODAMPlayer and control playback behavior.
 * - Modify player options (e.g., enforce responsive aspect ratio).
 * - Display loading states and handle graceful error fallbacks.
 * - Manage swipe hint animations using swipeAnimation helpers.
 * - Enable vertical scroll (desktop) and swipe (mobile) navigation between videos inside the modal.
 *
 * -----------------------------------------------------------------------------
 * Swipe / Scroll Navigation Requirements:
 * -----------------------------------------------------------------------------
 * For navigation to work correctly, each video trigger element inside
 * the modal MUST include:
 *
 * - `data-video-id`
 * - `data-video-attached-product-ids`
 *
 * These attributes are required to:
 * - Identify the currently active video
 * - Determine the next/previous video
 * - Load associated sidebar products when navigating
 *
 * -----------------------------------------------------------------------------
 * Integrations:
 * -----------------------------------------------------------------------------
 * - Uses @wordpress/api-fetch for REST requests
 * - Uses WordPress i18n (`__`) for translatable strings
 * - Relies on global `GODAMPlayer` and `videojs`
 * - Integrates with swipeAnimation helpers
 *
 * This module is designed to be used within the product gallery
 * modal system and assumes the modal lifecycle is managed externally.
 */

/**
 * Internal dependencies
 */
import { startSwipeAnimationLoop, stopSwipeAnimationLoop } from './swipeAnimation.js';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

/**
 * Resets and cleans up the video modal state.
 *
 * This function:
 * - Hides the modal and removes its open state.
 * - Restores the document body scroll behavior.
 * - Disposes all Video.js player instances inside the modal to prevent memory leaks and duplicate player initialization.
 *
 * Should be called whenever the modal is closed.
 *
 * @param {HTMLElement} modal - The modal element to reset and clean up.
 *
 * @return {void}
 */
export function resetVideoModal( modal ) {
	modal.classList.add( 'hidden' );
	modal.classList.remove( 'open' );

	document.body.style.overflow = '';

	const players = modal.querySelectorAll( '.video-js' );
	players.forEach( ( p ) => p?.player?.dispose?.() );
}

/**
 * Loads and initializes a new video inside the given modal.
 *
 * This function:
 * - Prevents concurrent video loads using a loading state flag.
 * - Displays a loading animation while fetching video markup.
 * - Optionally resets and prepares the sidebar (with mobile/desktop spinner logic).
 * - Fetches video HTML from the REST endpoint based on video ID and context.
 * - Adjusts player configuration (e.g., responsive aspect ratio).
 * - Injects the updated markup into the modal container.
 * - Initializes the GODAM video player.
 * - Automatically plays the video.
 * - Optionally enables swipe hint behavior when swiper is enabled.
 * - Handles player lifecycle events (play, ended, seeked).
 * - Gracefully handles errors and resets loading state.
 *
 * Swipe behavior (if enabled):
 * - Displays swipe hint overlay when the video ends.
 * - Hides swipe hint on replay or seek.
 * - Starts/stops the swipe animation loop accordingly.
 *
 * @async
 *
 * @param {number|string} newVideoId       The ID of the video to load.
 * @param {HTMLElement}   modal            The modal element where the video should be rendered.
 * @param {boolean}       hasSidebar       Whether the modal contains a product sidebar.
 * @param {string}        context          Context identifier used when requesting video HTML.
 * @param {boolean}       hasSwiperEnabled Whether swipe navigation behavior should be enabled.
 *
 * @return {Promise<void>} Resolves when the video has been loaded and initialized.
 */
export async function loadNewVideo( newVideoId, modal, hasSidebar, context, hasSwiperEnabled ) {
	if ( modal.dataset.isLoading === 'true' ) {
		return;
	}

	modal.dataset.isLoading = 'true';
	modal.dataset.currentVideoId = newVideoId;

	if ( hasSidebar ) {
		/* Determine if user is on mobile or desktop */
		const isMobile = window.matchMedia( '(pointer: coarse)' ).matches;

		const sidebarElement = modal.querySelector( '.godam-sidebar-product' );

		/* Don't show spinner on mobile */
		const sidebarSpinner = sidebarElement?.querySelector( '.spinner' );

		if ( isMobile ) {
			sidebarSpinner?.classList.add( 'hidden' );
		} else {
			sidebarSpinner?.classList.remove( 'hidden' );
		}

		if ( sidebarElement ) {
			if ( isMobile ) {
				sidebarElement.innerHTML = '<div class="spinner hidden"></div>';
			} else {
				sidebarElement.innerHTML = '<div class="spinner"></div>';
			}
		}
	}

	const container = modal.querySelector( '.video-container' );
	if ( container ) {
		const videoContainer = modal.querySelector( '.video-container' );
		if ( videoContainer ) {
			videoContainer.classList.remove( 'is-landscape', 'is-portrait' );
		}

		container.innerHTML = `
			<div class="animate-video-loading">
				<div class="animate-play-btn">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
						<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
					</svg>
				</div>
			</div>
		`;

		container.classList.add( 'animate-video-loading' ); // check this later
	}

	try {
		const data = await apiFetch( { path: `${ godamWooVars.namespaceRoot }${ godamWooVars.videoShortcodeEP }?id=${ newVideoId }&godam_context=${ context }` } );

		if ( data.status === 'success' && data.html ) {
			let html = data.html;

			// Modify player options in `data-options` attribute.
			html = html.replace( /data-options="([^"]+)"/, ( match, jsonEncoded ) => {
				const decoded = jsonEncoded.replace( /&quot;/g, '"' );

				try {
					const json = JSON.parse( decoded );
					json.aspectRatio = 'woo-responsive';

					// re-encode to match format.
					const updatedJson = JSON.stringify( json ).replace( /"/g, '&quot;' );
					return `data-options="${ updatedJson }"`;
				} catch ( err ) {
					console.warn( 'Could not parse/replace data-options:', decoded );
					return match;
				}
			} );

			// Update CSS aspect ratio variable.
			html = html.replace(
				/--rtgodam-video-aspect-ratio:\s*[^;"]+/,
				'--rtgodam-video-aspect-ratio: woo-responsive',
			);

			// Inject updated HTML.
			container.innerHTML = html;
			container.classList.remove( 'animate-video-loading' );

			// Initialize GODAM player.
			if ( typeof GODAMPlayer === 'function' ) {
				GODAMPlayer( modal );

				const videoPlayerElement = modal.querySelector( '.video-js' );
				const videojs = window.videojs;

				if ( videojs && videoPlayerElement ) {
					const attachSwipeLogic = ( player ) => {
						const swipeHint = modal.querySelector( '.godam-swipe-hint' );
						const swipeOverlay = modal.querySelector( '.godam-swipe-overlay' );

						// Reset swipe animation
						stopSwipeAnimationLoop();
						swipeHint?.classList.remove( 'show' );
						swipeOverlay?.classList.remove( 'visible' );

						// PLAY video
						player.play();

						// When video ends → show swipe hint
						player.on( 'ended', () => {
							const videoContainer = modal.querySelector( '.video-container' );

							if ( videoContainer && swipeOverlay ) {
								swipeOverlay.classList.remove( 'is-landscape', 'is-portrait' );

								if ( videoContainer.classList.contains( 'is-landscape' ) ) {
									swipeOverlay.classList.add( 'is-landscape' );
								}

								if ( videoContainer.classList.contains( 'is-portrait' ) ) {
									swipeOverlay.classList.add( 'is-portrait' );
								}
							}

							swipeHint?.classList.add( 'show' );
							swipeOverlay?.classList.add( 'visible' );

							startSwipeAnimationLoop( swipeHint, swipeOverlay );
						} );

						// Hide swipe on replay
						player.on( 'play', () => {
							swipeHint?.classList.remove( 'show' );
							swipeOverlay?.classList.remove( 'visible' );
							stopSwipeAnimationLoop();
						} );

						// Hide swipe on seek
						player.on( 'seeked', () => {
							swipeHint?.classList.remove( 'show' );
							swipeOverlay?.classList.remove( 'visible' );
							stopSwipeAnimationLoop();
						} );
					};

					// Case 1: Player already exists
					const existingPlayer = videojs.getPlayer( videoPlayerElement );

					if ( existingPlayer ) {
						if ( hasSwiperEnabled ) {
							attachSwipeLogic( existingPlayer );
						} else {
							existingPlayer.play();
						}
					} else {
						// Case 2: Wait for custom ready event
						const onPlayerReady = ( event ) => {
							if ( event.detail.videoElement === videoPlayerElement ) {
								if ( hasSwiperEnabled ) {
									attachSwipeLogic( event.detail.player );
								} else {
									event.detail.player.play();
								}
								document.removeEventListener( 'godamPlayerReady', onPlayerReady );
								modal._galleryPlayerReadyHandler = null;
							}
						};

						modal._galleryPlayerReadyHandler = onPlayerReady;
						document.addEventListener( 'godamPlayerReady', onPlayerReady );
					}
				} else {
					console.error( 'Video.js is not loaded. Cannot initialize player.' );
				}
			}
		} else {
			// Show error message if video can't be loaded.
			container.innerHTML = `<div class="godam-error-message">${ __( 'Video could not be loaded.', 'godam' ) }</div>`;
			container.classList.remove( 'animate-video-loading' );
		}
	} catch ( error ) {
		console.error( 'Fetch or parsing failed:', error );
		container.classList.remove( 'animate-video-loading' );
	} finally {
		modal.dataset.isLoading = 'false';
	}
}

/**
 * Initializes vertical scroll (desktop) and swipe (mobile) navigation
 * for switching between videos inside an open modal.
 *
 * This function:
 * - Detects scroll (mouse wheel) on desktop and touch swipe on mobile.
 * - Determines the current active video using `modal.dataset.currentVideoId`.
 * - Navigates to the next/previous video based on scroll/swipe direction.
 * - Prevents rapid switching using a cooldown mechanism.
 * - Loads the new video dynamically via `loadNewVideo()`.
 * - Optionally triggers a callback (e.g., sidebar reload) after video change.
 * - Updates UI elements such as swipe hints and sidebar header visibility.
 *
 * ⚠️ IMPORTANT REQUIREMENT:
 * For scroll/swipe navigation to function correctly,
 * every currentVideoItems element in the video modal MUST include:
 *
 * - `data-video-id` (unique video identifier)
 * - `data-video-attached-product-ids` (comma-separated product IDs/Single product ID)
 *
 * These attributes are used to:
 * - Identify the current video
 * - Determine the next/previous video in sequence
 * - Load associated sidebar products during navigation
 *
 * @param {HTMLElement}                 modal             The main modal element.
 * @param {HTMLElement}                 videoModal        The container element that listens for scroll/swipe events.
 * @param {NodeList|Array<HTMLElement>} currentVideoItems Collection of video trigger elements containing required data attributes.
 * @param {boolean}                     hasSidebar        Whether the modal includes a sidebar.
 * @param {string}                      context           Context identifier used when loading new videos.
 * @param {boolean}                     hasSwiperEnabled  Whether swipe hint behavior is enabled.
 * @param {Function}                    onVideoChange     Optional async callback triggered after video change (e.g., to reload sidebar products).
 *
 * @return {void}
 */

export function initScrollSwipeNavigation( modal, videoModal, currentVideoItems, hasSidebar, context, hasSwiperEnabled, onVideoChange ) {
	const SCROLL_COOLDOWN = 800;
	let lastScrollTime = 0;
	let scrollTimeout;

	/* Determine if user is on mobile or desktop */
	const isMobile = window.matchMedia( '(pointer: coarse)' ).matches;

	const scrollOrSwipeText = isMobile
		? __( 'Swipe up/down for more', 'godam' )
		: __( 'Scroll up/down for more', 'godam' );

	const textSpan = modal.querySelector( '.godam-scroll-or-swipe-text' );
	if ( textSpan ) {
		textSpan.textContent = scrollOrSwipeText;
	}

	// Navigation handler.
	const handleScrollOrSwipe = async ( direction ) => {
		const currentTime = Date.now();
		if ( currentTime - lastScrollTime < SCROLL_COOLDOWN ) {
			return;
		}

		const videoItems = currentVideoItems;
		const currentId = modal.dataset.currentVideoId;
		const currentIndex = Array.from( videoItems ).findIndex( ( el ) =>
			el.getAttribute( 'data-video-id' ) === currentId,
		);
		if ( currentIndex === -1 ) {
			return;
		}

		let newIndex;
		if ( direction === 'next' ) {
			if ( currentIndex === videoItems.length - 1 ) {
				// Already at last.
				return;
			}
			newIndex = currentIndex + 1;
		} else {
			if ( currentIndex === 0 ) {
				return;
			}
			newIndex = currentIndex - 1;
		}

		const newVideo = videoItems[ newIndex ];
		const newVideoId = newVideo?.getAttribute( 'data-video-id' );
		if ( newVideoId && newVideoId !== currentId ) {
			lastScrollTime = currentTime;
			const newProductIds = newVideo.getAttribute( 'data-video-attached-product-ids' );

			modal.querySelector( '.godam-swipe-hint' ).classList.remove( 'show' );
			modal.querySelector( '.godam-swipe-overlay' ).classList.remove( 'visible' );
			modal.querySelector( '.godam-sidebar-header-actions' )?.classList.add( 'hide' );
			await loadNewVideo( newVideoId, modal, hasSidebar, context, hasSwiperEnabled );

			if ( typeof onVideoChange === 'function' ) { // eg. load Sidebar.
				await onVideoChange( newProductIds );
			}
		}
	};

	// Scroll (wheel) for desktop.
	videoModal.addEventListener( 'wheel', ( ev ) => {
		ev.preventDefault();
		ev.stopPropagation();

		clearTimeout( scrollTimeout );
		scrollTimeout = setTimeout( () => {
			const direction = ev.deltaY > 0 ? 'next' : 'prev';
			handleScrollOrSwipe( direction );
		}, 150 );
	}, { passive: false } );

	// Touch swipe for mobile.
	let touchStartY = 0;
	let touchEndY = 0;

	videoModal.addEventListener( 'touchstart', ( ev ) => {
		touchStartY = ev.touches[ 0 ].clientY;
	}, { passive: false } );

	videoModal.addEventListener( 'touchmove', ( ev ) => {
		ev.preventDefault();
		ev.stopPropagation();
	}, { passive: false } );

	videoModal.addEventListener( 'touchend', ( ev ) => {
		touchEndY = ev.changedTouches[ 0 ].clientY;
		const diff = touchStartY - touchEndY;

		if ( Math.abs( diff ) < 50 ) {
			return;
		}

		clearTimeout( scrollTimeout );
		scrollTimeout = setTimeout( () => {
			const direction = diff > 0 ? 'next' : 'prev';
			handleScrollOrSwipe( direction );
		}, 150 );
	}, { passive: false } );
}
