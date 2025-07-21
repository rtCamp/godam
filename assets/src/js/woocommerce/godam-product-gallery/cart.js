/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @wordpress/no-unused-vars-before-return */
/* Mini cart and CTA add to cart functionality */
export function initMinicartAndCtaDropdown() {
	let activeDropdown = null;
	let activeButton = null;

	document.querySelectorAll( '.main-cta' ).forEach( ( button ) => {
		button.addEventListener( 'click', ( e ) => {
			const wrapper = e.target.closest( '.godam-product-cta' );
			const dropdown = e.target.dataset.productDropdown;
			const productId = e.target.dataset.productId;
			const cartAction = e.target.dataset.productCart;

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
						addToCart( event.target.dataset.productId, e.target.dataset.productCart );
					} );
				} );
			} else {
				addToCart( productId, cartAction );
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

	let cartTab = null;

	function addToCart( productId, cartAction = 'mini-cart' ) {
		fetch( '/?wc-ajax=add_to_cart', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams( { product_id: productId, quantity: 1 } ),
		} )
			.then( ( res ) => res.json() )
			.then( ( data ) => {
				if ( data.error ) {
					alert( 'Error adding product to cart.' );
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
						<h3>Cart</h3>
						<button id="close-mini-cart" aria-label="Close cart">×</button>
					</div>
				`;

				if ( themeCartFragment ) {
					cartContentHTML += themeCartFragment;
				} else {
					// Full fallback UI (View Cart + Checkout + Continue)
					cartContentHTML += `
						<p>Your cart has been updated.</p>
						<p><a href="/cart/">Go to cart</a></p>
						<div class="mini-cart-footer">
							<a href="/cart/" class="button view-cart">View Cart</a>
							<a href="/checkout/" class="button checkout">Checkout</a>
							<button class="button continue-shopping" id="continue-shopping-btn">Continue Shopping</button>
						</div>
					`;
				}

				miniCartWrapper.innerHTML = cartContentHTML;
				document.body.classList.add( 'mini-cart-open' );

				document.getElementById( 'close-mini-cart' ).addEventListener( 'click', closeMiniCart );
				document.querySelector( '.mini-cart-backdrop' ).addEventListener( 'click', closeMiniCart );
				// document.getElementById( 'continue-shopping-btn' ).addEventListener( 'click', closeMiniCart );
			} );
	}

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

	function closeMiniCart() {
		document.body.classList.remove( 'mini-cart-open' );
	}
}
