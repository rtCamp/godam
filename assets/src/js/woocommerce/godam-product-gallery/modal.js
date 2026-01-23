/*
 * GoDAM Video Modal Initialization Script
 *
 * Description: Handles video modal popups, swipe navigation, and related product display for GoDAM product videos.
 *
 * Requires:
 * - Global GODAMPlayer function
 * - Localized godamVars variables
 * - WordPress REST and AJAX APIs for fetching videos and WooCommerce products
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { initImageGallery } from './sidebar.js';

/* global GODAMPlayer, godamVars */
/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-console */

export function initVideoModal() {
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

		modal.dataset.currentVideoId = videoId;
		modal.dataset.isLoading = 'false';
		modal.dataset.ctaEnabled = String( ctaEnabled );
		modal.dataset.ctaDisplayPosition = ctaDisplayPosition;

		const sidebarModal = modal.querySelector( '.godam-product-sidebar' );
		/* Determine if user is on mobile or desktop */
		const isMobile = window.matchMedia( '(pointer: coarse)' ).matches;

		const scrollOrSwipeText = isMobile
			? __( 'Swipe up/down for more', 'godam' )
			: __( 'Scroll up/down for more', 'godam' );

		const textSpan = modal.querySelector( '.godam-scroll-or-swipe-text' );
		if ( textSpan ) {
			textSpan.textContent = scrollOrSwipeText;
		}

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

		/* Loads the video, Opens popup screen */
		modal.classList.remove( 'hidden' );
		await loadNewVideo( videoId, modal );

		// /* Loads Product Sidebar */
		await loadSidebarProducts( videoProductIds, sidebarModal, ctaEnabled, ctaDisplayPosition, modal );

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
		initScrollSwipeNavigation( modal, currentGallery, sidebarModal, ctaEnabled, ctaDisplayPosition );
	} );
}

/* ---------------------------------------- Helper Functions --------------------------------------------- */

let swipeAnimationInterval = null;

/**
 * Checks if the current browser is Safari.
 *
 * This function uses the `navigator.userAgent` string to detect
 * whether the user is browsing with Safari. It excludes Chrome
 * and Android browsers to avoid false positives.
 *
 * @return {boolean} True if the browser is Safari, false otherwise.
 */
function isSafari() {
	return /^((?!chrome|android).)*safari/i.test( navigator.userAgent );
}

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
function startSwipeAnimationLoop( swipeHint, swipeOverlay ) {
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
function stopSwipeAnimationLoop() {
	if ( swipeAnimationInterval ) {
		clearInterval( swipeAnimationInterval );
		swipeAnimationInterval = null;
	}
}

document.addEventListener( 'keydown', ( e ) => {
	if ( e.key === 'Escape' || e.key === 'Esc' ) {
		const openModal = document.querySelector( '.godam-product-modal-container.open' );
		if ( ! openModal ) {
			return;
		}
		const sidebarModal = openModal.querySelector( '.godam-product-sidebar' );
		const ctaEnabled = openModal.dataset.ctaEnabled === 'true' || openModal.dataset.ctaEnabled === '1';
		const ctaDisplayPosition = openModal.dataset.ctaDisplayPosition;

		close( openModal, sidebarModal, ctaEnabled, ctaDisplayPosition );
	}
} );

/**
 * Closes the main modal and optional sidebar modal.
 *
 * - Hides the main modal by adding the 'hidden' class.
 * - Resets the body's overflow style to restore scrolling.
 * - Disposes of any video.js player instances inside the modal to free up resources.
 * - Optionally removes the 'close' class from the sidebar modal if cta is enabled and is inside.
 *
 * @param {HTMLElement} modal              - The main modal element to be closed.
 * @param {HTMLElement} [sidebarModal]     - Optional Product sidebar modal element to be deactivated.
 * @param {boolean}     ctaEnabled         - Whether the call-to-action sidebar should be displayed.
 * @param {string}      ctaDisplayPosition - Where the CTA should be shown (`'inside'` or `'below-inside'`).
 */
function close( modal, sidebarModal, ctaEnabled, ctaDisplayPosition ) {
	modal.classList.add( 'hidden' );
	modal.classList.remove( 'open' );

	document.body.style.overflow = '';
	document.querySelector( '.cta-dropdown.visible' )?.classList.remove( 'visible' );

	const players = modal.querySelectorAll( '.video-js' );
	players.forEach( ( p ) => p?.player?.dispose?.() );

	if ( ctaEnabled && ( ctaDisplayPosition === 'below-inside' || ctaDisplayPosition === 'inside' ) ) {
		sidebarModal?.classList.remove( 'close' );

		modal.querySelector( '.godam-product-modal-content' ).classList.remove( 'no-sidebar' );
		modal.querySelector( '.godam-product-modal-content' ).classList.add( 'sidebar' );

		modal.querySelector( '.sidebar-collapsible-open-button' ).classList.add( 'hidden' );
	}

	if ( isSafari() && modal.parentElement === document.body ) {
		modal.remove();
	}
}

/**
 * Loads a new video into the modal and initializes playback and swipe hint logic.
 *
 * - Prevents duplicate requests by checking and setting a loading state on the modal.
 * - Shows a loading animation while fetching the video HTML from a custom REST API endpoint.
 * - Parses and modifies the returned HTML to enforce a responsive aspect ratio and apply a minimal player skin.
 * - Injects the modified HTML into the modal's container and initializes the GODAMPlayer instance.
 * - Automatically plays the video and manages swipe hint animation :
 * - Shows the swipe hint after video ends.
 * - Hides the hint and stops the loop when the user plays or seeks.
 * - Displays an error message if the video cannot be loaded or parsed.
 *
 * @async
 * @param {string}      newVideoId - The ID of the video to be loaded.
 * @param {HTMLElement} modal      - The modal element containing the video container.
 */
async function loadNewVideo( newVideoId, modal ) {
	if ( modal.dataset.isLoading === 'true' ) {
		return;
	}

	modal.dataset.isLoading = 'true';
	modal.dataset.currentVideoId = newVideoId;

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

		container.classList.add( 'animate-video-loading' );
	}

	try {
		const data = await apiFetch( { path: `${ godamVars.namespaceRoot }${ godamVars.videoShortcodeEP }?id=${ newVideoId }` } );

		if ( data.status === 'success' && data.html ) {
			let html = data.html;

			// Modify player options in `data-options` attribute.
			html = html.replace( /data-options="([^"]+)"/, ( match, jsonEncoded ) => {
				const decoded = jsonEncoded.replace( /&quot;/g, '"' );

				try {
					const json = JSON.parse( decoded );
					json.aspectRatio = 'responsive';

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
				'--rtgodam-video-aspect-ratio: responsive',
			);

			// Inject updated HTML.
			container.innerHTML = html;
			container.classList.remove( 'animate-video-loading' );

			// Initialize GODAM player.
			if ( typeof GODAMPlayer === 'function' ) {
				GODAMPlayer( modal );

				const player = modal.querySelector( '.video-js' );
				if ( player?.player ) {
					player.player.play();

					const swipeHint = modal.querySelector( '.godam-swipe-hint' );
					const swipeOverlay = modal.querySelector( '.godam-swipe-overlay' );

					// Reset swipe animation.
					stopSwipeAnimationLoop();
					swipeHint?.classList.remove( 'show' );
					swipeOverlay?.classList.remove( 'visible' );

					// Restart swipe animation loop only when current video ends.
					player.player.on( 'ended', () => {
						const videoContainer = modal.querySelector( '.video-container' );
						const classList = videoContainer.classList;
						classList.forEach( ( className ) => {
							if ( className.includes( 'is-landscape' ) ) {
								swipeOverlay.classList.remove( 'is-portrait' );
								swipeOverlay.classList.add( 'is-landscape' );
							}
							if ( className.includes( 'is-portrait' ) ) {
								swipeOverlay.classList.remove( 'is-landscape' );
								swipeOverlay.classList.add( 'is-portrait' );
							}
						} );
						swipeHint?.classList.add( 'show' );
						swipeOverlay?.classList.add( 'visible' );

						startSwipeAnimationLoop( swipeHint, swipeOverlay );
					} );

					// Hide and stop swipe hint on play (user replays).
					player.player.on( 'play', () => {
						swipeHint?.classList.remove( 'show' );
						swipeOverlay?.classList.remove( 'visible' );

						stopSwipeAnimationLoop();
					} );

					// Hide and stop swipe hint on seek.
					player.player.on( 'seeked', () => {
						swipeHint?.classList.remove( 'show' );
						swipeOverlay?.classList.remove( 'visible' );

						stopSwipeAnimationLoop();
					} );
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
 * Displays a temporary toast notification for "Add to Cart" actions.
 *
 * - Shows a toast message with success or error styling.
 * - Automatically hides the notification after 3 seconds.
 * - Cancels any previous timeout to avoid overlapping animations.
 *
 * @param {string}  message         - The message to display in the toast.
 * @param {boolean} [isError=false] - Whether the message indicates an error (adds `error` class if true).
 */
function showAddToCartNotification( message, isError = false ) {
	const toast = document.getElementById( 'godam-add-to-cart-toast' );
	if ( ! toast ) {
		return;
	}

	toast.textContent = message;
	toast.className = ''; // Reset existing classes.
	toast.classList.add( 'visible' );
	if ( isError ) {
		toast.classList.add( 'error' );
	}

	clearTimeout( toast._timeout );
	toast._timeout = setTimeout( () => {
		toast.classList.remove( 'visible', 'error' ); // Hide the toast after 3s.
	}, 3000 );
}

/**
 * Attaches "Add to Cart" click listeners to buttons inside the given container.
 *
 * - Targets elements with the `.godam-product-sidebar-add-to-cart-button` class.
 * - On click, retrieves the associated product ID and sends an AJAX request to WooCommerce.
 * - If successful, updates WooCommerce fragments (e.g. cart count) on the page.
 * - Displays a toast notification for success or failure.
 * - Dynamically creates the toast element if it doesn't already exist in the DOM.
 *
 * @param {HTMLElement} containerElement - The container within which to look for add-to-cart buttons.
 */
function attachAddToCartListeners( containerElement ) {
	if ( ! containerElement ) {
		return;
	}

	const buttons = containerElement.querySelectorAll( '.godam-product-sidebar-add-to-cart-button' );

	buttons.forEach( ( button ) => {
		button.addEventListener( 'click', async () => {
			button.classList.add( 'loading' );

			const productId = button.dataset.productId;
			if ( ! productId ) {
				return;
			}

			// Ensure toast element exists.
			if ( ! document.getElementById( 'godam-add-to-cart-toast' ) ) {
				const toast = document.createElement( 'div' );
				toast.id = 'godam-add-to-cart-toast';
				document.body.appendChild( toast );
			}

			try {
				dispatch( godamVars.addToCartAjax ).addItemToCart( productId, 1 ).then( () => {
					button.classList.remove( 'loading' );
					showAddToCartNotification( __( 'Product added successfully!', 'godam' ) );
				} ).catch( () => {
					button.classList.remove( 'loading' );
					showAddToCartNotification( __( 'Something went wrong. Try again.', 'godam' ), true );
				} );
			} catch ( err ) {
				console.error( 'Add to cart failed', err );
				button.classList.remove( 'loading' );
				showAddToCartNotification( __( 'Error adding product.', 'godam' ), true );
			}
		} );
	} );
}

/**
 * Loads and displays products in a sidebar based on a list of product IDs.
 *
 * - Validates input parameters including product IDs, sidebar element, CTA status, and display position.
 * - Supports two modes:
 * 1. **Single Product**: Fetches full product HTML via an AJAX call and renders it in the sidebar.
 * 2. **Multiple Products**: Fetches minimal product details via REST API and lists them with "Add to Cart" buttons.
 * - Dynamically attaches "Add to Cart" listeners to rendered buttons.
 * - Adds animation classes to reveal the sidebar after content is rendered.
 *
 * @async
 * @param {string}      productIds         - Comma-separated string of WooCommerce product IDs.
 * @param {HTMLElement} sidebarModal       - DOM element where the sidebar product content will be rendered.
 * @param {boolean}     ctaEnabled         - Whether the call-to-action sidebar should be displayed.
 * @param {string}      ctaDisplayPosition - Where the CTA should be shown (`'inside'` or `'below-inside'`).
 * @param {HTMLElement} modal              - DOM element where the product content will be rendered.
 */
async function loadSidebarProducts( productIds, sidebarModal, ctaEnabled, ctaDisplayPosition, modal ) {
	if ( ! productIds || ! sidebarModal ) {
		return;
	}

	if ( ! ctaEnabled ) {
		return;
	}

	if ( ctaDisplayPosition !== 'below-inside' && ctaDisplayPosition !== 'inside' ) {
		return;
	}

	const sidebarElement = sidebarModal.querySelector( '.godam-sidebar-product' );

	const idsArray = productIds
		.split( ',' )
		.map( ( id ) => parseInt( id ) )
		.filter( Boolean );

	// Single product mode: fetch full HTML from admin-ajax.
	if ( idsArray.length === 1 ) {
		try {
			const productId = idsArray[ 0 ];

			const response = await fetch(
				`${ godamVars.ajaxUrl }?action=${ godamVars.getProductHtmlAction }&product_id=${ productId }&_wpnonce=${ godamVars.productGalleryNonce }`,
			);

			sidebarModal.classList.add( 'single-product-sidebar' );

			const result = await response.json();

			sidebarElement.classList.remove( 'godam-product-sidebar-grid' );
			sidebarElement.classList.add( 'godam-product-sidebar-single' );

			if ( result.success ) {
				const productHtml = result.data;

				sidebarElement.innerHTML = productHtml;

				attachAddToCartListeners( sidebarModal );

				initImageGallery();

				requestAnimationFrame( () => {
					const headerText = sidebarModal.querySelector( '.godam-header-text' );
					headerText.classList.add( 'hidden' );
				} );

				modal.querySelector( '.godam-sidebar-header-actions' )?.classList.remove( 'hide' );
			} else {
				console.warn( 'Product content not found:', result.data );
			}
		} catch ( err ) {
			console.error( 'Failed to load full product page:', err );
		}
		return;
	}

	// Multiple products mode: fetch lightweight data from REST API.
	try {
		const products = await apiFetch( {
			path: `${ godamVars.namespaceRoot }${ godamVars.productByIdsEP }`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify( { ids: idsArray } ),
		} );

		sidebarModal.classList.remove( 'single-product-sidebar' );

		sidebarElement.classList.remove( 'godam-product-sidebar-single' );
		sidebarElement.classList.add( 'godam-product-sidebar-grid' );

		if ( Array.isArray( products ) ) {
			sidebarElement.innerHTML = `
				${ products.map( ( product ) => `
				<div class="godam-sidebar-product-item">
					<div class="godam-sidebar-product-image">${ product.image }</div>
					<div class="godam-sidebar-product-content">
						<div class="godam-sidebar-product-title">${ product.name }</div>
						<div class="godam-sidebar-product-price">${ product.price }</div>
						${ renderRatingStars( product.rating_average, product.rating_customer_count ) }
						${ [ 'variable', 'grouped', 'external' ].includes( product.type ) || ! product.in_stock ? `<a class="godam-product-sidebar-view-product-button" href="${ product.link }" target="_blank" aria-label="${ __( 'View Product', 'godam' ) }">${ __( 'View Product', 'godam' ) }</a>` : `<button class="godam-product-sidebar-add-to-cart-button" data-product-id="${ product.id }" aria-label="${ __( 'Add to Cart', 'godam' ) }">${ __( 'Add to Cart', 'godam' ) }</button>` }
					</div>
				</div>` ).join( '' ) }`;

			attachAddToCartListeners( sidebarModal );

			requestAnimationFrame( () => {
				const headerText = sidebarModal.querySelector( '.godam-header-text' );
				headerText.classList.remove( 'hidden' );
			} );
			modal.querySelector( '.godam-sidebar-header-actions' )?.classList.remove( 'hide' );
		}
	} catch ( err ) {
		console.error( 'Failed to load sidebar products:', err );
	}
}

/**
 * Renders a star rating component as SVGs based on the average rating and rating count.
 *
 * - Displays up to 5 stars.
 * - If no ratings exist, shows 5 empty stars.
 * - Fills stars fully or partially depending on the average rating value.
 * - Uses linear gradients for partial stars to represent fractional ratings.
 *
 * @param {number} average     - The average rating (e.g., 3.7).
 * @param {number} ratingCount - The total number of ratings.
 * @return {string} HTML string containing a div with the star rating markup.
 */
function renderRatingStars( average, ratingCount ) {
	const fullStarSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#FFC107" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.858L19.335 24 12 20.01 4.665 24l1.335-8.719-6-5.858 8.332-1.268z"/></svg>`;
	const emptyStarSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#e0e0e0" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.858L19.335 24 12 20.01 4.665 24l1.335-8.719-6-5.858 8.332-1.268z"/></svg>`;

	const partialStarSVG = ( percentage ) => `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
            <defs>
                <linearGradient id="halfGradient${ Math.random() }" x1="0" x2="100%" y1="0" y2="0">
                    <stop offset="${ percentage }%" stop-color="#FFC107"/>
                    <stop offset="${ percentage }%" stop-color="#e0e0e0"/>
                </linearGradient>
            </defs>
            <path fill="url(#halfGradient${ Math.random() })" d="M12 .587l3.668 7.568L24 9.423l-6 5.858L19.335 24 12 20.01 4.665 24l1.335-8.719-6-5.858 8.332-1.268z"/>
        </svg>`;

	let starsHTML = '';

	// If no rating, render 5 empty stars.
	if ( ! average || ratingCount === 0 ) {
		for ( let i = 1; i <= 5; i++ ) {
			starsHTML += emptyStarSVG;
		}
	} else {
		for ( let i = 1; i <= 5; i++ ) {
			if ( average >= i ) {
				starsHTML += fullStarSVG;
			} else if ( average > i - 1 ) {
				const partial = ( average - ( i - 1 ) ) * 100;
				starsHTML += partialStarSVG( partial );
			} else {
				starsHTML += emptyStarSVG;
			}
		}
	}

	return `<div class="godam-sidebar-product-rating">${ starsHTML }</div>`;
}

/**
 * Parses a raw timestamp string and converts it into total seconds.
 *
 * - If the input is falsy (e.g. null, undefined, empty), returns 0.
 * - If the input contains a colon (`:`), it is treated as a time format (`hh:mm:ss` or `mm:ss`) and converted to seconds using a reducer.
 * - If the input is a plain number string (e.g. `"12.5"`), it is parsed as a float.
 *
 * @param {string} raw - The raw timestamp string (e.g. "1:30", "00:01:45", "12.5").
 * @return {number} The total number of seconds as a float.
 */
function parseTimestamp( raw ) {
	if ( ! raw ) {
		return 0;
	}
	if ( raw.includes( ':' ) ) {
		return raw.split( ':' ).reduce( ( acc, time ) => ( 60 * acc ) + Number( time ), 0 );
	}
	return parseFloat( raw );
}

/**
 * Initializes scroll and swipe navigation for switching between videos in a modal.
 *
 * Features:
 * - Enables vertical scrolling (desktop) and swipe gestures (mobile) to navigate between videos.
 * - Ensures scroll/swipe doesn't trigger too frequently with a cooldown.
 * - Loads the new video and updates the product sidebar on navigation.
 * - Handles swipe hint overlay visibility.
 *
 * @param {HTMLElement} modal              - The modal container element showing the current video.
 * @param {HTMLElement} currentGallery     - The gallery element containing video items.
 * @param {HTMLElement} sidebarModal       - The sidebar modal for showing related products.
 * @param {boolean}     ctaEnabled         - Flag to enable/disable Call-To-Action content.
 * @param {string}      ctaDisplayPosition - The display position of the CTA content.
 */
function initScrollSwipeNavigation( modal, currentGallery, sidebarModal, ctaEnabled, ctaDisplayPosition ) {
	const SCROLL_COOLDOWN = 800;
	let lastScrollTime = 0;
	let scrollTimeout;

	// Utility: fetch current video items fresh from gallery.
	const getCurrentVideoItems = () => {
		const videos = currentGallery?.querySelectorAll( '.godam-product-video' );
		if ( videos?.length ) {
			return videos;
		}

		return currentGallery?.querySelectorAll( '.godam-product-video-thumbnail' ) || [];
	};

	const videoModal = modal.querySelector( '.godam-product-video-container' );

	// Navigation handler.
	const handleScrollOrSwipe = async ( direction ) => {
		const currentTime = Date.now();
		if ( currentTime - lastScrollTime < SCROLL_COOLDOWN ) {
			return;
		}

		const videoItems = getCurrentVideoItems();
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
			await loadNewVideo( newVideoId, modal );
			await loadSidebarProducts( newProductIds, sidebarModal, ctaEnabled, ctaDisplayPosition, modal );
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
