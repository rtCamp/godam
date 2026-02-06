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
 * - Displays a mini-cart sidebar with WooCommerce Mini Cart.
 * - Falls back to redirection if the mini-cart fails or is not applicable.
 *
 * Requires:
 * - WordPress WooCommerce AJAX API for adding product to cart.
 * - Global `godamVars` object containing the `addToCartAjax` endpoint.
 */

/**
 * WordPress dependencies
 */
import { dispatch } from '@wordpress/data';

/* global godamVars */
/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @wordpress/no-unused-vars-before-return */

export function initMinicartAndCtaDropdown() {
	let activeDropdown = null;
	let activeButton = null;

	document.querySelectorAll( '.main-cta' ).forEach( ( button ) => {
		button.addEventListener( 'click', ( e ) => {
			e.stopPropagation();

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

				// Set a unique ID on the original dropdown and pass it to the clone.
				const dropdownId = `dropdown-${ productId }`;
				originalDropdown.dataset.sourceDropdownId = dropdownId;

				const cloned = originalDropdown.cloneNode( true );
				cloned.classList.add( 'visible' );
				cloned.dataset.sourceDropdownId = dropdownId;
				cloned.style.position = 'absolute';
				cloned.style.zIndex = 9990;
				document.body.appendChild( cloned );

				activeDropdown = cloned;
				activeButton = e.target;

				const items = cloned.querySelectorAll( '.cta-dropdown-item' );

				// Handle scrollable dropdown if more than 3 items.
				if ( items.length > 3 ) {
					let totalHeight = 0;

					for ( let i = 0; i < 3; i++ ) {
						if ( items[ i ] ) {
							totalHeight += items[ i ].getBoundingClientRect().height;
						}
					}

					const computedStyles = window.getComputedStyle( originalDropdown );

					const paddingTop = parseFloat( computedStyles.paddingTop ) || 0;
					const paddingBottom = parseFloat( computedStyles.paddingBottom ) || 0;

					const extraHeight = paddingTop + paddingBottom;

					cloned.style.maxHeight = `${ totalHeight + extraHeight }px`;
					cloned.style.overflowY = 'auto';
				}

				const rect = wrapper.getBoundingClientRect();
				cloned.style.top = `${ rect.bottom + window.scrollY }px`;
				cloned.style.left = `${ rect.left + window.scrollX }px`;
				cloned.style.width = `${ rect.width }px`;

				cloned.querySelectorAll( '.cta-add-to-cart' ).forEach( ( btn ) => {
					btn.addEventListener( 'click', ( event ) => {
						const productDataset = event.target.dataset;
						addToCart( event.target, productDataset.productId, cartAction, productDataset.productPageUrl );
					} );
				} );
			} else {
				addToCart( e.target, productId, cartAction, productPageURL );
			}
		} );
	} );

	// Close dropdown on click outside dropdown.
	document.addEventListener( 'click', ( e ) => {
		if ( ! e.target.closest( '.main-cta' ) && ! e.target.closest( '.cta-dropdown' ) ) {
			if ( activeDropdown ) {
				activeDropdown.remove();
				activeDropdown = null;
				activeButton = null;
			}
		}
	} );

	// Close dropdown on scroll outside dropdown.
	window.addEventListener( 'scroll', ( event ) => {
		if ( activeDropdown && ! activeDropdown.contains( event.target ) && ! activeButton?.contains( event.target ) ) {
			activeDropdown.remove();
			activeDropdown = null;
			activeButton = null;
		}
	}, true );

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
	 * @param {button}        button
	 * @param {number|string} productId                - The ID of the product to add to the cart.
	 * @param {string}        [cartAction='mini-cart'] - The action after adding to cart. Either 'mini-cart' or 'redirect'.
	 * @param {string}        [productURL]             - The fallback product URL to redirect to if add-to-cart fails.
	 */
	function addToCart( button, productId, cartAction = 'mini-cart', productURL ) {
		button.classList.add( 'loading' );

		dispatch( godamVars.addToCartAjax ).addItemToCart( productId, 1 )
			.then( () => {
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

				button.classList.remove( 'loading' );

				// Show mini-cart.
				const miniCartButton = document.querySelector( '.wc-block-mini-cart__button' );
				if ( miniCartButton ) {
					// Open mini cart of woocommerce.
					miniCartButton.click();
				}
			} )
			.catch( () => {
				button.classList.remove( 'loading' );
				// Redirect to product page in new tab.
				if ( productURL ) {
					window.open( productURL, '_blank' );
				}
			} );
	}
}
