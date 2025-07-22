/**
 * Mini Cart and CTA Dropdown Functionality
 *
 * This module handles the "Add to Cart" interactions for both:
 * - Mini cart sidebar (displayed after clicking a CTA or dropdown add button).
 * - Conditional dropdowns that appear under CTA buttons for product variations or options.
 *
 * Core Features:
 * - Binds click events to `.main-cta` buttons.
 * - Displays and positions dynamic dropdown menus for products with additional options.
 * - Sends AJAX request to add products to WooCommerce cart via `godamVars.addToCartAjax`.
 * - Displays a mini-cart sidebar with live cart fragments on successful addition.
 * - Falls back to redirection if the mini-cart fails or is not applicable.
 * - Creates and manages the mini-cart DOM structure and overlay backdrop if not already present.
 * - Allows users to close the mini-cart via close buttons, backdrop click, or continue shopping.
 *
 * Requires:
 * - WordPress WooCommerce AJAX API for adding product to cart.
 * - Global `godamVars` object containing the `addToCartAjax` endpoint.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/* global godamVars */
/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @wordpress/no-unused-vars-before-return */

export function initMinicartAndCtaDropdown() {
	let activeDropdown = null;
	let activeButton = null;

	document.querySelectorAll( '.main-cta' ).forEach( ( button ) => {
		button.addEventListener( 'click', ( e ) => {
			const wrapper = e.target.closest( '.godam-product-cta' );
			const dropdown = e.target.dataset.productDropdown;
			const productId = e.target.dataset.productId;
			const cartAction = e.target.dataset.productCart;
			const productPageURL = e.target.dataset.productPageUrl;

			if ( dropdown === '1' ) {
				if ( activeButton === e.target ) {
					if ( activeDropdown ) {
						activeDropdown.remove();
						activeDropdown = null;
						activeButton = null;
					}
					return;
				}

				if ( activeDropdown ) {
					activeDropdown.remove();
				}

				const originalDropdown = wrapper.querySelector( '.cta-dropdown' );
				if ( ! originalDropdown ) {
					return;
				}

				const cloned = originalDropdown.cloneNode( true );
				cloned.classList.add( 'visible' );
				cloned.style.position = 'absolute';
				cloned.style.zIndex = 9990;
				document.body.appendChild( cloned );

				activeDropdown = cloned;
				activeButton = e.target;

				const rect = wrapper.getBoundingClientRect();
				cloned.style.top = `${ rect.bottom + window.scrollY }px`;
				cloned.style.left = `${ rect.left + window.scrollX }px`;
				cloned.style.width = `${ rect.width }px`;

				cloned.querySelectorAll( '.cta-add-to-cart' ).forEach( ( btn ) => {
					btn.addEventListener( 'click', ( event ) => {
						const productDataset = event.target.dataset;
						addToCart( productDataset.productId, cartAction, productDataset.productPageUrl );
					} );
				} );
			} else {
				addToCart( productId, cartAction, productPageURL );
			}
		} );
	} );

	document.addEventListener( 'click', ( e ) => {
		if ( ! e.target.closest( '.main-cta' ) && ! e.target.closest( '.cta-dropdown' ) ) {
			if ( activeDropdown ) {
				activeDropdown.remove();
				activeDropdown = null;
				activeButton = null;
			}
		}
	} );

	/* --------------------------------------------- Helper Functions ------------------------------------------------ */

	let cartTab = null;

	/**
	 * Adds a product to the WooCommerce cart via AJAX and handles the UI response.
	 *
	 * Depending on the `cartAction`, this function either:
	 * - Redirects the user to the cart page in a new tab.
	 * - Displays a mini-cart popup with updated cart content.
	 *
	 * If the product cannot be added via AJAX (e.g., due to validation errors), the user is redirected
	 * to the product page to complete the action.
	 *
	 * @param {number|string} productId                - The ID of the product to add to the cart.
	 * @param {string}        [cartAction='mini-cart'] - The action after adding to cart. Either 'mini-cart' or 'redirect'.
	 * @param {string}        [productURL]             - The fallback product URL to redirect to if add-to-cart fails.
	 */
	function addToCart( productId, cartAction = 'mini-cart', productURL ) {
		fetch( godamVars.addToCartAjax, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams( { product_id: productId, quantity: 1 } ),
		} )
			.then( ( res ) => res.json() )
			.then( ( data ) => {
				if ( data.error ) {
					// Redirect to product page in new tab.
					if ( productURL ) {
						window.open( productURL, '_blank' );
					}
					return;
				}

				// Skip mini cart if cartAction is redirect.
				if ( cartAction === 'redirect' ) {
					if ( cartTab && ! cartTab.closed ) {
						cartTab.location.href = '/cart/';
						cartTab.focus();
					} else {
						cartTab = window.open( '/cart/', '_blank' );
					}
					return;
				}

				// Show mini-cart.
				const miniCartWrapper = getOrCreateMiniCartWrapper();
				const themeCartFragment = data.fragments[ 'div.widget_shopping_cart_content' ];

				let cartContentHTML = `
					<div class="mini-cart-header">
						<h3>${ __( 'Cart', 'godam' ) }</h3>
						<button id="close-mini-cart" aria-label="${ __( 'Close cart', 'godam' ) }">×</button>
					</div>
				`;

				if ( themeCartFragment ) {
					cartContentHTML += themeCartFragment;
				} else {
					// Full fallback UI (View Cart + Checkout + Continue).
					cartContentHTML += `
						<p>${ __( 'Your cart has been updated.', 'godam' ) }</p>
						<p><a href="/cart/">${ __( 'Go to cart', 'godam' ) }</a></p>
						<div class="mini-cart-footer">
							<a href="/cart/" class="button view-cart" aria-label="${ __( 'View Cart', 'godam' ) }">${ __( 'View Cart', 'godam' ) }</a>
							<a href="/checkout/" class="button checkout" aria-label="${ __( 'Checkout', 'godam' ) }">${ __( 'Checkout', 'godam' ) }</a>
							<button class="button continue-shopping" id="continue-shopping-btn" aria-label="${ __( 'Continue Shopping', 'godam' ) }">${ __( 'Continue Shopping', 'godam' ) }</button>
						</div>
					`;
				}

				miniCartWrapper.innerHTML = cartContentHTML;
				document.body.classList.add( 'mini-cart-open' );

				document.getElementById( 'close-mini-cart' ).addEventListener( 'click', closeMiniCart );
				document.querySelector( '.mini-cart-backdrop' )?.addEventListener( 'click', closeMiniCart );
				document.getElementById( 'continue-shopping-btn' )?.addEventListener( 'click', closeMiniCart );
			} );
	}

	/**
	 * Retrieves the existing mini cart sidebar and backdrop elements,
	 * or creates and appends them to the DOM if they don't exist.
	 *
	 * @return {HTMLElement} The mini cart sidebar element.
	 */
	function getOrCreateMiniCartWrapper() {
		let sidebar = document.querySelector( '#mini-cart-sidebar' );
		let backdrop = document.querySelector( '.mini-cart-backdrop' );

		if ( ! sidebar ) {
			sidebar = document.createElement( 'div' );
			sidebar.id = 'mini-cart-sidebar';
			sidebar.className = 'mini-cart-sidebar';
			document.body.appendChild( sidebar );
		}

		if ( ! backdrop ) {
			backdrop = document.createElement( 'div' );
			backdrop.className = 'mini-cart-backdrop';
			document.body.appendChild( backdrop );
		}

		return sidebar;
	}

	/**
	 * Closes the mini cart by removing the `mini-cart-open` class from the body.
	 * Typically used to hide the sidebar and backdrop.
	 */
	function closeMiniCart() {
		document.body.classList.remove( 'mini-cart-open' );
	}
}
