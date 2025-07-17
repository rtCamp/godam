/* global GODAMPlayer */

/**
 * External dependencies
 */
import DOMPurify from 'isomorphic-dompurify';

/* Autoplay Product Gallery videos only for 5 seconds */
document.addEventListener( 'DOMContentLoaded', function() {
	const gallery = document.querySelector( '.godam-product-gallery' );
	if ( ! gallery ) {
		return;
	}

	const videos = gallery.querySelectorAll( 'video' );

	// Initial autoplay loop setup.
	videos.forEach( ( video ) => {
		if ( video.hasAttribute( 'autoplay' ) ) {
			setInterval( () => {
				if ( video.currentTime >= 5 ) {
					video.pause();
					video.currentTime = 0;
					video.play();
				}
			}, 1000 );
		}
	} );
} );

/* Show GoDAM video Popup */
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

	const videoProductIds = getProductIds;
	const ctaEnabled = getCTAEnabled;
	const ctaDisplayPosition = getCTADisplayPosition;

	const currentGallery = ( playButton || timestampBtn ).closest( '.godam-product-gallery' );

	let modal = document.getElementById( 'godam-product-modal' );
	if ( ! modal ) {
		modal = document.createElement( 'div' );
		modal.id = 'godam-product-modal';
		modal.className = 'godam-product-modal';
		document.body.appendChild( modal );
	}

	modal.dataset.currentVideoId = videoId;
	modal.dataset.isLoading = 'false';

	modal.innerHTML = `
		<div class="godam-product-sidebar"></div>
		<div class="godam-product-modal-content">
			<div class="godam-product-modal-close"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" style="fill: rgba(255, 255, 255, 1);transform: ;msFilter:;"><path d="m16.192 6.344-4.243 4.242-4.242-4.242-1.414 1.414L10.535 12l-4.242 4.242 1.414 1.414 4.242-4.242 4.243 4.242 1.414-1.414L13.364 12l4.242-4.242z"></path></svg></div>
			<div class="video-container animate-video-loading" style="aspect-ratio:responsive;">
				<div class="animate-play-btn">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
						<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
					</svg>
				</div>
			</div>
			<div class="godam-swipe-overlay">
				<div class="godam-swipe-hint">
					<div class="chevron chevron-up"></div>
					<div class="chevron chevron-down"></div>
					<span>Swipe up/down for more</span>
				</div>
			</div>
		</div>
	`;

	modal.classList.remove( 'hidden' );

	const sidebarModal = modal.querySelector( '.godam-product-sidebar' );
	// sidebarModal.classList.add( 'hidden' );

	document.body.style.overflow = 'hidden';

	const loadNewVideo = async ( newVideoId ) => {
		if ( modal.dataset.isLoading === 'true' ) {
			return;
		}

		modal.dataset.isLoading = 'true';
		modal.dataset.currentVideoId = newVideoId;

		const container = modal.querySelector( '.video-container' );
		if ( container ) {
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
			const res = await fetch( `/wp-json/godam/v1/video-shortcode?id=${ newVideoId }` );
			const data = await res.json();

			if ( data.status === 'success' && data.html ) {
				let html = data.html;

				// Match and modify the `data-options` JSON string inside the HTML
				html = html.replace( /data-options="([^"]+)"/, ( match, jsonEncoded ) => {
					const decoded = jsonEncoded.replace( /&quot;/g, '"' );

					try {
						const json = JSON.parse( decoded );
						json.aspectRatio = 'responsive'; // update
						json.playerSkin = 'Minimal'; // optionally change skin

						// re-encode to match format
						const updatedJson = JSON.stringify( json ).replace( /"/g, '&quot;' );
						return `data-options="${ updatedJson }"`;
					} catch ( err ) {
						console.warn( 'Could not parse/replace data-options:', decoded );
						return match; // fallback to original if it fails
					}
				} );

				html = html.replace(
					/--rtgodam-video-aspect-ratio:\s*[^;"]+/,
					'--rtgodam-video-aspect-ratio: responsive',
				);

				// ✅ Inject updated HTML with properly escaped attributes
				container.innerHTML = html;
				container.classList.remove( 'animate-video-loading' );

				// player
				if ( typeof GODAMPlayer === 'function' ) {
					GODAMPlayer( modal );

					const player = modal.querySelector( '.video-js' );
					if ( player?.player ) {
						player.player.play();

						const swipeHint = modal.querySelector( '.godam-swipe-hint' );
						const swipeOverlay = modal.querySelector( '.godam-swipe-overlay' );

						// Clear any running swipe animations for previous videos.
						stopSwipeAnimationLoop();

						// Hide swipe hint and overlay initially.
						swipeHint?.classList.remove( 'show' );
						swipeOverlay?.classList.remove( 'visible' );

						// Restart swipe animation loop only when current video ends.
						player.player.on( 'ended', () => {
							swipeHint?.classList.add( 'show' );
							swipeOverlay?.classList.add( 'visible' );

							startSwipeAnimationLoop( swipeHint, swipeOverlay );
						} );

						// Hide and stop swipe hint on play (user replays).
						player.player.on( 'play', () => {
							swipeHint?.classList.remove( 'show' );
							swipeOverlay?.classList.remove( 'visible' );

							stopSwipeAnimationLoop(); // prevent overlapping loops
						} );

						// Hide and stop swipe hint on seek.
						player.player.on( 'seeked', () => {
							swipeHint?.classList.remove( 'show' );
							swipeOverlay?.classList.remove( 'visible' );

							stopSwipeAnimationLoop(); // prevent overlapping loops
						} );
					}
				}
			} else {
				container.innerHTML = `<div class="godam-error-message">Video could not be loaded.</div>`;
				container.classList.remove( 'animate-video-loading' );
			}
		} catch ( error ) {
			console.error( 'Fetch or parsing failed:', error );
			container.classList.remove( 'animate-video-loading' );
		} finally {
			modal.dataset.isLoading = 'false';
		}
	};

	let swipeAnimationInterval = null;

	function startSwipeAnimationLoop( swipeHint, swipeOverlay ) {
		stopSwipeAnimationLoop(); // prevent multiple intervals

		const showHint = () => {
			swipeHint.classList.add( 'show' );
			swipeOverlay.classList.add( 'visible' );

			setTimeout( () => {
				swipeHint.classList.remove( 'show' );
				swipeOverlay.classList.remove( 'visible' );
			}, 5000 ); // show for 5s
		};

		showHint(); // run immediately

		swipeAnimationInterval = setInterval( () => {
			showHint();
		}, 13000 ); // 5s show + 8s pause
	}

	function stopSwipeAnimationLoop() {
		if ( swipeAnimationInterval ) {
			clearInterval( swipeAnimationInterval );
			swipeAnimationInterval = null;
		}
	}

	function showAddToCartNotification( message, isError = false ) {
		const toast = document.getElementById( 'godam-add-to-cart-toast' );
		if ( ! toast ) {
			return;
		}

		toast.textContent = message;
		toast.className = ''; // clear previous classes
		toast.classList.add( 'visible' );
		if ( isError ) {
			toast.classList.add( 'error' );
		}

		clearTimeout( toast._timeout );
		toast._timeout = setTimeout( () => {
			toast.classList.remove( 'visible', 'error' );
		}, 3000 );
	}

	async function loadSidebarProducts( productIds, sidebarElement ) {
		if ( ! productIds || ! sidebarElement ) {
			return;
		}

		if ( ! ctaEnabled ) {
			return;
		}

		if ( ctaDisplayPosition !== 'below-inside' && ctaDisplayPosition !== 'inside' ) {
			return;
		}

		const idsArray = productIds
			.split( ',' )
			.map( ( id ) => parseInt( id ) )
			.filter( Boolean );

		// If only one product, fetch the full product page
		if ( idsArray.length === 1 ) {
			try {
				const productId = idsArray[ 0 ];

				const response = await fetch(
					`/wp-admin/admin-ajax.php?action=godam_get_product_html&product_id=${ productId }`,
				);

				const result = await response.json();

				if ( result.success ) {
					const productHtml = result.data;

					sidebarElement.innerHTML = `
						<div class="godam-sidebar-header">
							<button class="godam-sidebar-close" aria-label="Close sidebar">&times;</button>
						</div>
						<div class="godam-sidebar-full-product">
							${ productHtml }
						</div>
					`;

					attachAddToCartListeners( sidebarElement );

					requestAnimationFrame( () => {
						sidebarElement.classList.add( 'active' );
						modal.classList.add( 'sidebar-active' );
					} );
				} else {
					console.warn( 'Product content not found:', result.data );
				}
			} catch ( err ) {
				console.error( 'Failed to load full product page:', err );
			}
			return;
		}

		try {
			const res = await fetch( '/wp-json/godam/v1/wcproducts-by-ids', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify( { ids: idsArray } ),
			} );

			const products = await res.json();

			if ( Array.isArray( products ) ) {
				sidebarElement.innerHTML = `
					<div class="godam-sidebar-header">
						<h3>Products seen in the video</h3>
						<button class="godam-sidebar-close" aria-label="Close sidebar">&times;</button>
					</div>
					<div class="godam-sidebar-products">
						${ products.map(
		( product ) => `
								<div class="godam-sidebar-product-details">
									<a href="${ product.link }" target="_blank">
										<img src="${ product.image }" alt="${ product.name }" />
										<h4>${ product.name }</h4>
										<p>${ product.price }</p>
									</a>
									<button class="product-sidebar-add-to-cart-button" data-product-id="${ product.id }">Add to Cart</button>
								</div>
							`,
	).join( '' ) }
					</div>
				`;

				attachAddToCartListeners( sidebarElement );

				// Slide in the sidebar
				requestAnimationFrame( () => {
					// sidebarModal.classList.remove( 'hidden' );
					sidebarElement.classList.add( 'active' );
					modal.classList.add( 'sidebar-active' );
				} );
			}
		} catch ( err ) {
			console.error( 'Failed to load sidebar products:', err );
		}

		function attachAddToCartListeners( containerElement ) {
			if ( ! containerElement ) {
				return;
			}

			const buttons = containerElement.querySelectorAll( '.product-sidebar-add-to-cart-button' );

			buttons.forEach( ( button ) => {
				button.addEventListener( 'click', async ( e ) => {
					console.log( 'yes' );

					const productId = button.dataset.productId;
					if ( ! productId ) {
						return;
					}

					if ( ! document.getElementById( 'godam-add-to-cart-toast' ) ) {
						const toast = document.createElement( 'div' );
						toast.id = 'godam-add-to-cart-toast';
						document.body.appendChild( toast );
					}

					try {
						const response = await fetch( '/?wc-ajax=add_to_cart', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/x-www-form-urlencoded',
							},
							body: new URLSearchParams( {
								product_id: productId,
								quantity: 1,
							} ),
						} );

						const result = await response.json();

						if ( result && result.fragments ) {
							Object.entries( result.fragments ).forEach( ( [ selector, html ] ) => {
								const el = document.querySelector( selector );
								if ( el ) {
									el.innerHTML = html;
								}
							} );
							showAddToCartNotification( 'Product added successfully!' );
						} else {
							showAddToCartNotification( 'Something went wrong. Try again.', true );
						}
					} catch ( err ) {
						console.error( 'Add to cart failed', err );
						showAddToCartNotification( 'Error adding product.', true );
					}
				} );
			} );
		}
	}

	const close = () => {
		modal.classList.add( 'hidden' );
		document.body.style.overflow = '';
		const players = modal.querySelectorAll( '.video-js' );
		players.forEach( ( p ) => p?.player?.dispose?.() );

		sidebarModal?.classList.remove( 'active' );
	};

	const closeSidebar = () => {
		sidebarModal?.classList.remove( 'active' );
	};

	modal.querySelector( '.godam-product-modal-close' )?.addEventListener( 'click', close );
	sidebarModal.addEventListener( 'click', ( ev ) => {
		const closeBtn = ev.target.closest( '.godam-sidebar-close' );
		if ( closeBtn ) {
			closeSidebar();
		}
	} );
	modal.addEventListener( 'click', ( ev ) => {
		if (
			! ev.target.closest( '.godam-product-modal-content' ) &&
			! ev.target.closest( '.godam-product-sidebar' )
		) {
			close();
		}
	} );

	await loadNewVideo( videoId );

	await loadSidebarProducts( videoProductIds, sidebarModal );

	// Timestamp button logic.
	function parseTimestamp( raw ) {
		if ( ! raw ) {
			return 0;
		}
		if ( raw.includes( ':' ) ) {
			return raw.split( ':' ).reduce( ( acc, time ) => ( 60 * acc ) + Number( time ), 0 );
		}
		return parseFloat( raw );
	}

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
	const SCROLL_COOLDOWN = 800;
	let lastScrollTime = 0;
	let scrollTimeout;

	// Utility: fetch current video items fresh from gallery
	const getCurrentVideoItems = () => {
		return currentGallery?.querySelectorAll( '.godam-product-video' ) || [];
	};

	// Navigation handler
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
			// Already at last, attempt dynamic load if needed (optional)
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
			await loadNewVideo( newVideoId );
			await loadSidebarProducts( newProductIds, sidebarModal );
		}
	};

	// Scroll (wheel) for desktop
	modal.addEventListener( 'wheel', ( ev ) => {
		ev.preventDefault();
		ev.stopPropagation();

		clearTimeout( scrollTimeout );
		scrollTimeout = setTimeout( () => {
			const direction = ev.deltaY > 0 ? 'next' : 'prev';
			handleScrollOrSwipe( direction );
		}, 150 );
	}, { passive: false } );

	// Touch swipe for mobile
	let touchStartY = 0;
	let touchEndY = 0;

	modal.addEventListener( 'touchstart', ( ev ) => {
		touchStartY = ev.touches[ 0 ].clientY;
	}, { passive: false } );

	modal.addEventListener( 'touchmove', ( ev ) => {
		ev.preventDefault();
		ev.stopPropagation();
	}, { passive: false } );

	modal.addEventListener( 'touchend', ( ev ) => {
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
} );

/* Carousel arrow function logic */
document.addEventListener( 'DOMContentLoaded', function() {
	const wrappers = document.querySelectorAll( '.godam-carousel-wrapper' );

	wrappers.forEach( ( wrapper ) => {
		const track = wrapper.querySelector( '.carousel-track' );
		if ( ! track ) {
			return;
		}

		const leftBtn = wrapper.querySelector( '.carousel-arrow.left' );
		const rightBtn = wrapper.querySelector( '.carousel-arrow.right' );

		if ( leftBtn ) {
			leftBtn.addEventListener( 'click', () => {
				track.scrollBy( { left: -300, behavior: 'smooth' } );
			} );
		}
		if ( rightBtn ) {
			rightBtn.addEventListener( 'click', () => {
				track.scrollBy( { left: 300, behavior: 'smooth' } );
			} );
		}
	} );
} );

/* Mini cart and CTA add to cart functionality */
document.addEventListener( 'DOMContentLoaded', () => {
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
} );

