/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-console */

/**
 * GoDAM Product Modal Sidebar & Image Gallery Module
 *
 * -----------------------------------------------------------------------------
 * Purpose:
 * -----------------------------------------------------------------------------
 * Handles all sidebar and image gallery functionality within the GoDAM
 * product video modal. This module controls sidebar state management,
 * product rendering (single and multiple modes), add-to-cart interactions,
 * and interactive image gallery behavior.
 *
 * -----------------------------------------------------------------------------
 * Core Responsibilities:
 * -----------------------------------------------------------------------------
 * Sidebar Management:
 * - Open/close sidebar with layout adjustments
 * - Collapsible product information toggle
 * - Reset sidebar state when modal closes
 * - Dynamically render product content (single or multiple)
 *
 * Product Loading:
 * - Fetch full product HTML (single product mode) via admin-ajax
 * - Fetch multiple products via REST API + admin-ajax rendering
 * - Initialize Add to Cart interactions with WooCommerce
 * - Display toast notifications for cart actions
 *
 * Image Gallery:
 * - Thumbnail-based main image switching
 * - Active state synchronization
 * - Horizontal scrolling with navigation controls
 * - Mouse wheel horizontal scrolling
 * - Touch/swipe gesture navigation
 * - Keyboard accessibility (Enter/Space support, ARIA attributes)
 *
 * -----------------------------------------------------------------------------
 * Architecture Notes:
 * -----------------------------------------------------------------------------
 * - Designed to operate only when an active `.<your-modal-keyword>-modal-container.open` element exists.
 * - Integrates with WordPress data store (`@wordpress/data`) for cart updates.
 * - Uses REST API and admin-ajax for product rendering.
 * - Keeps UI logic modular and scoped to the active modal instance.
 *
 * -----------------------------------------------------------------------------
 * Exports:
 * -----------------------------------------------------------------------------
 * - initSidebar()
 * - initSidebarToggle(modal)
 * - loadSidebarProducts(productIds, sidebarModal, modal)
 * - resetSidebarState(modal, sidebarModal, modalContent)
 *
 * This module is intended to be used by the product video modal system
 * and should not be initialized globally outside the modal lifecycle.
 */

/* global godamWooVars */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';

/**
 * Initializes the sidebar functionality by attaching
 * the close button event listener.
 */
export function initSidebar() {
	addToggleCloseSidebarListener();
	addToggleOpenSidebarListener();
}

/**
 * Adds an event listener to the sidebar close button to close
 * the product sidebar and adjust modal content layout accordingly.
 */
function addToggleCloseSidebarListener() {
	const modalContainer = document.querySelector( '.godam-woo-global-modal-container.open' );

	// If modal is not present return immediately FAAAAAAAH.
	if ( ! modalContainer ) {
		return;
	}

	// Get sidebar close and open button.
	const sidebarClose = modalContainer.querySelector( '.godam-sidebar-close' );
	const sidebarOpenButton = modalContainer.querySelector( '.sidebar-collapsible-open-button.hidden' );

	sidebarClose?.addEventListener( 'click', () => {
		// Close the sidebar.
		const sidebarElement = modalContainer.querySelector( '.godam-product-sidebar' );
		sidebarElement?.classList.add( 'close' );

		// Update Modal.
		modalContainer?.querySelector( '.godam-woo-global-modal-content' )?.classList?.add( 'no-sidebar' );
		modalContainer?.querySelector( '.godam-woo-global-modal-content' )?.classList?.remove( 'sidebar' );

		// Display the sidebar open button.
		sidebarOpenButton?.classList.remove( 'hidden' );
	} );
}

/**
 * Adds an event listener to the sidebar open button to open
 * the product sidebar and adjust modal content layout accordingly.
 */
function addToggleOpenSidebarListener() {
	const modalContainer = document.querySelector( '.godam-woo-global-modal-container.open' );

	// If modal is not present return immediately.
	if ( ! modalContainer ) {
		return;
	}

	// Get the sidebar open button.
	const sidebarOpen = modalContainer.querySelector( '.sidebar-collapsible-open-button' );

	sidebarOpen?.addEventListener( 'click', () => {
		// Get the sidebar.
		const sidebarElement = modalContainer.querySelector( '.godam-product-sidebar' );
		sidebarElement?.classList.remove( 'close' );

		// Update the modal.
		modalContainer?.querySelector( '.godam-woo-global-modal-content' )?.classList?.remove( 'no-sidebar' );
		modalContainer?.querySelector( '.godam-woo-global-modal-content' )?.classList?.add( 'sidebar' );

		// Hide the sidebar open button.
		sidebarOpen?.classList.add( 'hidden' );
	} );
}

/**
 * Initializes the image gallery functionality within the open product modal.
 *
 * Features:
 * - Thumbnail selection with active state
 * - Horizontal scroll navigation
 * - Touch/swipe gestures for image switching
 * - Mouse wheel horizontal scrolling
 * - Accessibility (keyboard navigation and ARIA labels)
 */
function initImageGallery() {
	const modalContainer = document.querySelector( '.godam-woo-global-modal-container.open' );

	if ( ! modalContainer ) {
		return;
	}

	// Get gallery elements.
	const mainImage = modalContainer.querySelector( '.godam-main-image img' );
	const thumbnails = modalContainer.querySelectorAll( '.godam-thumbnail-item' );

	if ( ! mainImage || thumbnails.length === 0 ) {
		return;
	}

	// Hide thumbnail carousel if there's only one image.
	const thumbnailCarousel = modalContainer.querySelector( '.godam-thumbnail-carousel' );
	if ( thumbnails.length === 1 && thumbnailCarousel ) {
		thumbnailCarousel.style.display = 'none';
		return;
	}

	const thumbnailImages = modalContainer.querySelectorAll( '.godam-thumbnail-image' );
	const thumbnailTrack = modalContainer.querySelector( '.godam-thumbnail-track' );
	const prevBtn = modalContainer.querySelector( '.godam-thumbnail-prev' );
	const nextBtn = modalContainer.querySelector( '.godam-thumbnail-next' );

	/**
	 * Initializes the gallery with thumbnail, scroll, touch, and mouse support.
	 */
	function initGallery() {
		thumbnails.forEach( ( thumbnail, index ) => {
			thumbnail.addEventListener( 'click', () => {
				showImage( index );
			} );

			// Add keyboard support.
			thumbnail.setAttribute( 'tabindex', '0' );
			thumbnail.setAttribute( 'role', 'button' );
			thumbnail.setAttribute( 'aria-label', `View image ${ index + 1 }` );

			thumbnail.addEventListener( 'keydown', ( e ) => {
				if ( e.key === 'Enter' || e.key === ' ' ) {
					e.preventDefault();
					showImage( index );
				}
			} );
		} );

		// Initialize horizontal scroll navigation.
		initHorizontalScroll();

		// Add touch/swipe support for mobile.
		initTouchSupport();

		// Add mouse wheel support.
		initMouseWheelSupport();
	}

	/**
	 * Updates the main image based on selected thumbnail.
	 *
	 * @param {number} index - Index of the selected thumbnail.
	 */
	function showImage( index ) {
		thumbnails.forEach( ( thumb ) => {
			thumb.classList.remove( 'active' );
		} );

		if ( thumbnails[ index ] ) {
			thumbnails[ index ].classList.add( 'active' );
		}

		// Update main image.
		if ( thumbnailImages[ index ] ) {
			mainImage.src = thumbnailImages[ index ].src;
			mainImage.alt = thumbnailImages[ index ].alt;
		}

		mainImage.style.opacity = '0';
		setTimeout( () => {
			mainImage.style.opacity = '1';
		}, 150 );
	}

	/**
	 * Enables horizontal scrolling for thumbnails with navigation buttons.
	 */
	function initHorizontalScroll() {
		const scrollStep = 120;
		let currentScrollLeft = 0;
		const maxScrollLeft = thumbnailTrack.scrollWidth - thumbnailTrack.clientWidth;

		function updateNavigationButtons() {
			if ( prevBtn ) {
				prevBtn.disabled = currentScrollLeft <= 0;
				prevBtn.style.opacity = currentScrollLeft <= 0 ? '0.3' : '1';
			}
			if ( nextBtn ) {
				nextBtn.disabled = currentScrollLeft >= maxScrollLeft;
				nextBtn.style.opacity = currentScrollLeft >= maxScrollLeft ? '0.3' : '1';
			}
		}

		function scrollThumbnails( direction ) {
			const newScrollLeft = currentScrollLeft + ( direction * scrollStep );

			// Clamp scroll position.
			currentScrollLeft = Math.max( 0, Math.min( newScrollLeft, maxScrollLeft ) );

			thumbnailTrack.scrollTo( {
				left: currentScrollLeft,
				behavior: 'smooth',
			} );

			updateNavigationButtons();
		}

		// Add click event listeners to navigation buttons.
		if ( prevBtn ) {
			prevBtn.addEventListener( 'click', () => {
				scrollThumbnails( -1 );
			} );
		}

		if ( nextBtn ) {
			nextBtn.addEventListener( 'click', () => {
				scrollThumbnails( 1 );
			} );
		}

		// Update scroll position on manual scroll.
		thumbnailTrack.addEventListener( 'scroll', () => {
			currentScrollLeft = thumbnailTrack.scrollLeft;
			updateNavigationButtons();
		} );

		// Initialize button states.
		updateNavigationButtons();
	}

	/**
	 * Adds mouse wheel support for horizontal thumbnail scrolling.
	 */
	function initMouseWheelSupport() {
		thumbnailTrack.addEventListener( 'wheel', ( e ) => {
			e.preventDefault();

			const scrollAmount = e.deltaY > 0 ? 1 : -1;
			const scrollStep = 60; // Smaller step for wheel scrolling.

			const currentScrollLeft = thumbnailTrack.scrollLeft;
			const newScrollLeft = currentScrollLeft + ( scrollAmount * scrollStep );
			const maxScrollLeft = thumbnailTrack.scrollWidth - thumbnailTrack.clientWidth;

			thumbnailTrack.scrollTo( {
				left: Math.max( 0, Math.min( newScrollLeft, maxScrollLeft ) ),
				behavior: 'smooth',
			} );
		} );
	}

	/**
	 * Adds touch/swipe gesture support for switching main images.
	 */
	function initTouchSupport() {
		let startX = 0;
		let endX = 0;
		const mainImageContainer = modalContainer.querySelector( '.godam-main-image' );

		if ( ! mainImageContainer ) {
			return;
		}

		mainImageContainer.addEventListener( 'touchstart', ( e ) => {
			startX = e.touches[ 0 ].clientX;
		} );

		mainImageContainer.addEventListener( 'touchend', ( e ) => {
			endX = e.changedTouches[ 0 ].clientX;
			handleSwipe();
		} );

		function handleSwipe() {
			const swipeThreshold = 50;
			const diff = startX - endX;
			const currentActiveIndex = Array.from( thumbnails ).findIndex( ( thumb ) =>
				thumb.classList.contains( 'active' ),
			);

			if ( Math.abs( diff ) > swipeThreshold ) {
				if ( diff > 0 && currentActiveIndex < thumbnails.length - 1 ) {
					// Swipe left - next image.
					showImage( currentActiveIndex + 1 );
				} else if ( diff < 0 && currentActiveIndex > 0 ) {
					// Swipe right - previous image.
					showImage( currentActiveIndex - 1 );
				}
			}
		}
	}

	// Initialize the gallery.
	initGallery();
}

/**
 * Initializes the sidebar toggle behavior inside the given modal.
 *
 * This function:
 * - Finds the sidebar toggle button (.godam-sidebar-product-toggle)
 * - Finds all elements currently marked as collapsed (.is-collapsed)
 * - Attaches a click listener to the toggle button
 * - Toggles the `data-expanded` state on the button
 * - Adds/removes the `is-collapsed` class on target elements
 *
 * @param {HTMLElement} modal - The modal element containing the sidebar toggle and collapsible targets.
 *
 * @return {void}
 */
export function initSidebarToggle( modal ) {
	const toggle = modal.querySelector( '.godam-sidebar-product-toggle' );
	const targets = modal.querySelectorAll( '.is-collapsed' );

	if ( ! toggle || ! targets ) {
		return;
	}

	toggle.addEventListener( 'click', () => {
		const expanded = toggle.getAttribute( 'data-expanded' ) === 'true';
		toggle.setAttribute( 'data-expanded', ! expanded );

		targets.forEach( ( target ) => {
			target.classList.toggle( 'is-collapsed' );
		} );
	} );
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
	let toast = document.getElementById( 'godam-add-to-cart-toast' );

	// Create toast if it doesn't exist yet.
	if ( ! toast ) {
		toast = document.createElement( 'div' );
		toast.id = 'godam-add-to-cart-toast';
		document.body.appendChild( toast );
	}

	toast.textContent = message;

	// Reset only state classes, not any base styling class.
	toast.classList.remove( 'visible', 'error' );

	// Force reflow so CSS transition re-triggers properly.
	void toast.offsetWidth;

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
 * Builds the inline variation selector UI inside the given wrapper element.
 *
 * Reads variation data from the button's data attributes, constructs pill-based
 * attribute selectors, and wires up add-to-cart logic using the WooCommerce Store API.
 *
 * @param {HTMLElement} button  - The `.godam-product-sidebar-add-to-cart-button` that holds variation data.
 * @param {HTMLElement} wrapper - The `.godam-sidebar-variation-selector-wrapper` to populate.
 */
function buildSidebarVariationSelector( button, wrapper ) {
	// Don't rebuild if already populated.
	if ( wrapper.querySelector( '.rtgodam-variation-selector' ) ) {
		return;
	}

	const variationsRaw = button.dataset.variations;
	const attributesRaw = button.dataset.variationAttributes;
	const preselectedRaw = button.dataset.preselectedAttrs;

	if ( ! variationsRaw || ! attributesRaw ) {
		return;
	}

	let variations, attributes, preselected;
	try {
		variations = JSON.parse( variationsRaw );
		attributes = JSON.parse( attributesRaw );
		preselected = preselectedRaw ? JSON.parse( preselectedRaw ) : {};
	} catch ( e ) {
		return;
	}

	if ( ! variations.length || ! attributes.length ) {
		return;
	}

	const selector = document.createElement( 'div' );
	selector.className = 'rtgodam-variation-selector';

	attributes.forEach( ( attr ) => {
		const row = document.createElement( 'div' );
		row.className = 'rtgodam-variation-attr-row';

		const label = document.createElement( 'span' );
		label.className = 'rtgodam-variation-attr-label';
		label.textContent = attr.label;
		row.appendChild( label );

		const optionsWrap = document.createElement( 'div' );
		optionsWrap.className = 'rtgodam-variation-attr-options';

		attr.options.forEach( ( opt ) => {
			const pill = document.createElement( 'button' );
			pill.type = 'button';
			pill.className = 'rtgodam-variation-pill';
			pill.textContent = opt.label;
			pill.dataset.attrSlug = attr.slug;
			pill.dataset.attrValue = opt.value;

			// Pre-select if WooCommerce default attributes match.
			// WC default_attributes keys are slugs without 'pa_' or 'attribute_' prefix.
			const normalizedAttrSlug = attr.slug.toLowerCase().replace( /^(pa_|attribute_)/, '' );
			const preselectedValue =
				preselected[ attr.slug ] ??
				preselected[ normalizedAttrSlug ] ??
				preselected[ 'pa_' + normalizedAttrSlug ] ??
				preselected[ 'attribute_' + normalizedAttrSlug ];

			if ( preselectedValue !== undefined && preselectedValue === opt.value ) {
				pill.classList.add( 'is-selected' );
			}

			optionsWrap.appendChild( pill );
		} );

		row.appendChild( optionsWrap );
		selector.appendChild( row );
	} );

	// "Add to Cart" confirm button.
	const addBtn = document.createElement( 'button' );
	addBtn.type = 'button';
	addBtn.className = 'rtgodam-variation-add-btn is-disabled';
	addBtn.textContent = __( 'Add to Cart', 'godam' );
	addBtn.disabled = true;
	selector.appendChild( addBtn );

	// Price display area.
	const priceEl = document.createElement( 'span' );
	priceEl.className = 'rtgodam-variation-price';
	selector.appendChild( priceEl );

	// Close button — top-right corner.
	const closeBtn = document.createElement( 'button' );
	closeBtn.type = 'button';
	closeBtn.className = 'rtgodam-variation-close-btn';
	closeBtn.setAttribute( 'aria-label', 'Close variation selector' );
	closeBtn.innerHTML = '&times;';
	closeBtn.addEventListener( 'click', () => {
		wrapper.classList.remove( 'is-open' );
	} );
	selector.prepend( closeBtn );

	wrapper.appendChild( selector );

	// If defaults were pre-selected, show initial price and enable add button.
	const initialMatch = findSidebarMatchingVariation( selector, attributes, variations );
	if ( initialMatch ) {
		const v = variations.find( ( vr ) => vr.id === initialMatch );
		if ( v && v.price_html ) {
			priceEl.innerHTML = v.price_html;
		}
		addBtn.disabled = false;
		addBtn.classList.remove( 'is-disabled' );
	}

	// ---- Pill click: update selection + price preview ----
	selector.addEventListener( 'click', ( e ) => {
		const pill = e.target.closest( '.rtgodam-variation-pill' );
		if ( ! pill ) {
			return;
		}

		const row = pill.closest( '.rtgodam-variation-attr-row' );
		row.querySelectorAll( '.rtgodam-variation-pill' ).forEach( ( p ) => p.classList.remove( 'is-selected' ) );
		pill.classList.add( 'is-selected' );

		const matchedId = findSidebarMatchingVariation( selector, attributes, variations );
		if ( matchedId ) {
			const v = variations.find( ( vr ) => vr.id === matchedId );
			if ( v && v.price_html ) {
				priceEl.innerHTML = v.price_html;
			}
			addBtn.disabled = false;
			addBtn.classList.remove( 'is-disabled' );
		} else {
			priceEl.innerHTML = '';
			addBtn.disabled = true;
			addBtn.classList.add( 'is-disabled' );
		}
	} );

	// ---- Add to Cart click ----
	addBtn.addEventListener( 'click', async () => {
		const matchedId = findSidebarMatchingVariation( selector, attributes, variations );
		if ( ! matchedId ) {
			showAddToCartNotification( __( 'Please select all options.', 'godam' ), true );
			return;
		}

		const v = variations.find( ( vr ) => vr.id === matchedId );
		if ( v && ! v.in_stock ) {
			showAddToCartNotification( __( 'Selected variation is out of stock.', 'godam' ), true );
			return;
		}

		const cartStore = dispatch( godamWooVars.addToCartAjax );
		if ( ! cartStore ) {
			showAddToCartNotification( __( 'Cart not available.', 'godam' ), true );
			return;
		}

		const originalText = addBtn.textContent;
		addBtn.disabled = true;
		addBtn.classList.add( 'loading' );
		addBtn.textContent = __( 'Adding…', 'godam' );

		try {
			const variationData = [];
			attributes.forEach( ( attr ) => {
				const selectedPill = selector.querySelector(
					`.rtgodam-variation-pill.is-selected[data-attr-slug="${ attr.slug }"]`,
				);
				if ( selectedPill ) {
					const normalizedSlug = attr.slug.toLowerCase().replace( /^(pa_|attribute_)/, '' );
					variationData.push( {
						attribute: normalizedSlug,
						value: selectedPill.dataset.attrValue,
					} );
				}
			} );

			await cartStore.addItemToCart( matchedId, 1, variationData );
			showAddToCartNotification( __( 'Product added successfully!', 'godam' ) );
			wrapper.classList.remove( 'is-open' );
		} catch ( err ) {
			console.error( err );
			showAddToCartNotification( __( 'Failed to add to cart.', 'godam' ), true );
		} finally {
			addBtn.disabled = false;
			addBtn.classList.remove( 'loading' );
			addBtn.textContent = originalText;
		}
	} );
}

/**
 * Finds the matching variation ID from the currently selected pills.
 *
 * @param {HTMLElement} selector   - The `.rtgodam-variation-selector` container.
 * @param {Array}       attributes - The attribute definitions.
 * @param {Array}       variations - The available variations.
 * @return {number|null} The matching variation ID, or null if not all attributes are selected.
 */
function findSidebarMatchingVariation( selector, attributes, variations ) {
	const selected = {};
	let allSelected = true;

	attributes.forEach( ( attr ) => {
		const pill = selector.querySelector(
			`.rtgodam-variation-pill.is-selected[data-attr-slug="${ attr.slug }"]`,
		);
		if ( pill ) {
			// Strip only 'attribute_' prefix so 'pa_color' becomes 'attribute_pa_color',
			// matching the keys WooCommerce stores in get_available_variations() attributes.
			const normalizedSlug = attr.slug.toLowerCase().replace( /^attribute_/, '' );
			selected[ 'attribute_' + normalizedSlug ] = pill.dataset.attrValue;
		} else {
			allSelected = false;
		}
	} );

	if ( ! allSelected ) {
		return null;
	}

	for ( const variation of variations ) {
		let match = true;
		for ( const [ key, val ] of Object.entries( selected ) ) {
			const varVal = variation.attributes[ key ];
			// An empty string in WC means "Any" — matches any value.
			if ( varVal !== '' && varVal !== val ) {
				match = false;
				break;
			}
		}
		if ( match ) {
			return variation.id;
		}
	}

	return null;
}

/**
 * Attaches "Add to Cart" click listeners to buttons inside the given container.
 *
 * - For simple products: fires the WooCommerce Store API directly.
 * - For variable products: toggles an inline variation selector panel.
 * - Displays a toast notification for success or failure.
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
			const productType = button.dataset.productType;

			// VARIABLE PRODUCT — toggle the inline variation selector.
			if ( productType === 'variable' ) {
				// Find the sidebar container and place/reuse the wrapper right after godam-sidebar-header.
				const productSidebar = button.closest( '.godam-product-sidebar' );
				let wrapper = productSidebar?.querySelector( ':scope > .godam-sidebar-variation-selector-wrapper' );

				if ( ! wrapper && productSidebar ) {
					wrapper = document.createElement( 'div' );
					wrapper.className = 'godam-sidebar-variation-selector-wrapper';
					const header = productSidebar.querySelector( '.godam-sidebar-header' );
					if ( header ) {
						header.insertAdjacentElement( 'afterend', wrapper );
					} else {
						productSidebar.prepend( wrapper );
					}
				}

				if ( wrapper ) {
					// Rebuild selector for the new product if button changed.
					if ( wrapper._sourceButton !== button ) {
						wrapper.innerHTML = '';
						wrapper._sourceButton = button;
					}
					buildSidebarVariationSelector( button, wrapper );
					wrapper.classList.toggle( 'is-open' );
				}
				return;
			}

			// SIMPLE PRODUCT.
			button.classList.add( 'loading' );

			const productId = button.dataset.productId;
			if ( ! productId ) {
				return;
			}

			try {
				dispatch( godamWooVars.addToCartAjax ).addItemToCart( productId, 1 ).then( () => {
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
 * Fetches and renders the complete product HTML inside the sidebar
 * when operating in single product mode.
 *
 * This function:
 * - Requests full product markup via WordPress admin-ajax
 * - Switches sidebar into single-product UI mode
 * - Injects returned HTML into the sidebar container
 * - Initializes interactive features (Add to Cart, Image Gallery, Toggle)
 * - Ensures header actions are visible
 *
 * @async
 *
 * @param {number}      productId      - ID of the product to load.
 * @param {HTMLElement} sidebarModal   - The sidebar modal wrapper element.
 * @param {HTMLElement} sidebarElement - The sidebar content container.
 * @param {HTMLElement} modal          - The main product modal element.
 *
 * @return {Promise<void>}
 */
async function loadSingleProductSidebar( productId, sidebarModal, sidebarElement, modal ) {
	try {
		const videoId = modal?.dataset?.modalVideoId || '';
		const response = await fetch(
			`${ godamWooVars.ajaxUrl }?action=${ godamWooVars.getSingleProductHtmlAction }&product_id=${ productId }&video_id=${ videoId }&_wpnonce=${ godamWooVars.getSingleProductHtmlNonce }`,
		);

		const result = await response.json();

		// UI state.
		sidebarModal.classList.add( 'single-product-sidebar' );
		sidebarElement.classList.add( 'godam-product-sidebar-single' );

		if ( result.success ) {
			sidebarElement.innerHTML = result.data;

			attachAddToCartListeners( sidebarModal );
			initImageGallery();
			initSidebarToggle( sidebarModal );

			modal.querySelector( '.godam-sidebar-header-actions' )?.classList.remove( 'hide' );
		} else {
			console.warn( 'Product content not found:', result.data );
		}
	} catch ( err ) {
		console.error( 'Failed to load full product page:', err );
	}
}

/**
 * Fetches and renders multiple products inside the sidebar
 * when operating in multi-product mode.
 *
 * This function:
 * - Retrieves product data via REST API using provided IDs
 * - Requests rendered sidebar HTML for the filtered products via admin-ajax
 * - Switches sidebar into multi-product UI mode
 * - Injects returned HTML into the sidebar container
 * - Initializes interactive features (Add to Cart, Toggle)
 * - Ensures header actions are visible
 *
 * @async
 *
 * @param {number[]}    idsArray       - Array of product IDs to load.
 * @param {HTMLElement} sidebarModal   - The sidebar modal wrapper element.
 * @param {HTMLElement} sidebarElement - The sidebar content container.
 * @param {HTMLElement} modal          - The main product modal element.
 *
 * @return {Promise<void>}
 */
async function loadMultipleProductsSidebar( idsArray, sidebarModal, sidebarElement, modal ) {
	try {
		const products = await apiFetch( {
			path: `${ godamWooVars.namespaceRoot }${ godamWooVars.productByIdsEP }`,
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( { ids: idsArray } ),
		} );

		// UI state.
		sidebarModal.classList.remove( 'single-product-sidebar' );
		sidebarElement.classList.remove( 'godam-product-sidebar-single' );

		if ( ! Array.isArray( products ) || ! products.length ) {
			return;
		}

		const ids = products
			.map( ( product ) => parseInt( product.id ) )
			.filter( Boolean );

		const videoId = modal?.dataset?.modalVideoId || '';

		const response = await fetch(
			`${ godamWooVars.ajaxUrl }?action=${ godamWooVars.getMultipleProductHtmlAction }&products=${ encodeURIComponent(
				ids.join( ',' ),
			) }&video_id=${ videoId }&_wpnonce=${ godamWooVars.getMultipleProductHtmlNonce }`,
		);

		const result = await response.json();

		if ( result.success ) {
			sidebarElement.innerHTML = result.data;
		}

		attachAddToCartListeners( sidebarModal );
		initSidebarToggle( sidebarModal );

		modal.querySelector( '.godam-sidebar-header-actions' )?.classList.remove( 'hide' );
	} catch ( err ) {
		console.error( 'Failed to load sidebar products:', err );
	}
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
 * @param {string}      productIds   - Comma-separated string of WooCommerce product IDs.
 * @param {HTMLElement} sidebarModal - DOM element where the sidebar product content will be rendered.
 * @param {HTMLElement} modal        - DOM element where the product content will be rendered.
 */
export async function loadSidebarProducts( productIds, sidebarModal, modal ) {
	const sidebarElement = sidebarModal.querySelector( '.godam-sidebar-product' );

	const idsArray = productIds
		.split( ',' )
		.map( ( id ) => parseInt( id ) )
		.filter( Boolean );

	// Single product mode: fetch full HTML from admin-ajax.
	if ( idsArray.length === 1 ) {
		await loadSingleProductSidebar( idsArray[ 0 ], sidebarModal, sidebarElement, modal );
		return;
	}

	// Multiple products mode: fetch lightweight data from REST API.
	await loadMultipleProductsSidebar( idsArray, sidebarModal, sidebarElement, modal );
}

/**
 * Resets the sidebar UI state when the modal is closed.
 *
 * - Reopens sidebar if previously collapsed
 * - Restores modal layout to sidebar mode
 * - Hides collapsible open button
 *
 * @param {HTMLElement} modal
 * @param {HTMLElement} sidebarModal
 * @param {HTMLElement} modalContent
 */
export function resetSidebarState( modal, sidebarModal, modalContent ) {
	sidebarModal?.classList.remove( 'close' );

	if ( modalContent ) {
		modalContent.classList.remove( 'no-sidebar' );
		modalContent.classList.add( 'sidebar' );
	}

	const collapsibleButton = modal.querySelector( '.sidebar-collapsible-open-button' );
	if ( collapsibleButton ) {
		collapsibleButton.classList.add( 'hidden' );
	}
}
