/**
 * External dependencies
 */
import DOMPurify from 'isomorphic-dompurify';
/* global GODAMPlayer */

document.addEventListener( 'DOMContentLoaded', function() {
	const gallery = document.querySelector( '.godam-product-gallery' );
	if ( ! gallery ) {
		return;
	}

	const videos = gallery.querySelectorAll( 'video' );
	// const playButtons = gallery.querySelectorAll( '.godam-play-button' );
	// const unmuteButtons = gallery.querySelectorAll( '.godam-unmute-button' );

	// let loopingIntervals = [];
	// const userControlledVideos = new WeakSet(); // Track videos that should NOT loop

	// function stopAllVideos( except = null ) {
	// 	videos.forEach( ( vid ) => {
	// 		if ( vid !== except ) {
	// 			vid.pause();
	// 			vid.currentTime = 0;
	// 		}
	// 	} );
	// 	loopingIntervals.forEach( clearInterval );
	// 	loopingIntervals = [];
	// }

	// function removePlayButtons( except = null ) {
	// 	playButtons.forEach( ( btn ) => {
	// 		if ( ! except || btn !== except ) {
	// 			btn.style.display = 'flex';
	// 		}
	// 	} );
	// }

	// function createLoop( video ) {
	// 	// Skip loop if video is user-controlled
	// 	if ( userControlledVideos.has( video ) ) {
	// 		return;
	// 	}

	// 	const interval = setInterval( () => {
	// 		if ( ! video.paused && video.currentTime >= 5 ) {
	// 			video.pause();
	// 			video.currentTime = 0;
	// 			video.play();
	// 		}
	// 	}, 1000 );

	// 	loopingIntervals.push( interval );
	// 	return interval;
	// }

	// 	// Play button click
	// 	playButtons.forEach( ( btn ) => {
	// 		btn.addEventListener( 'click', function() {
	// 			const container = btn.closest( '.godam-product-video-item' );
	// 			const video = container.querySelector( 'video' );

	// 			userControlledVideos.add( video );
	// 			stopAllVideos( video );
	// 			removePlayButtons( btn );

	// 			video.muted = false;
	// 			video.play();
	// 			btn.style.display = 'none';

	// 			// Video click toggles play/pause
	// 			video.onclick = function() {
	// 				if ( video.paused ) {
	// 					video.play();
	// 					btn.style.display = 'none';
	// 					stopAllVideos( video );
	// 				} else {
	// 					video.pause();
	// 					btn.style.display = 'flex';

	// 					videos.forEach( ( vid ) => {
	// 						if ( vid !== video && ! userControlledVideos.has( vid ) ) {
	// 							vid.muted = true;
	// 							vid.play();
	// 							createLoop( vid );
	// 						}
	// 					} );
	// 				}
	// 			};
	// 		} );
	// 	} );

	// 	// Unmute button click
	// 	unmuteButtons.forEach( ( btn ) => {
	// 		btn.addEventListener( 'click', function() {
	// 			const container = btn.closest( '.godam-product-video-item' );
	// 			const video = container.querySelector( 'video' );

	// 			// First: reset all other videos & unmute buttons to "muted" state
	// 			unmuteButtons.forEach( ( otherBtn ) => {
	// 				const otherContainer = otherBtn.closest( '.godam-product-video-item' );
	// 				const otherVideo = otherContainer.querySelector( 'video' );

	// 				if ( otherBtn !== btn ) {
	// 					otherVideo.muted = true;
	// 					updateUnmuteIcon( otherBtn, true ); // show cross
	// 				}
	// 			} );

	// 			const isNowMuted = ! video.muted;
	// 			video.muted = isNowMuted;
	// 			updateUnmuteIcon( btn, isNowMuted );

	// 			if ( isNowMuted ) {
	// 				video.pause();
	// 				video.currentTime = 0;

	// 				videos.forEach( ( vid ) => {
	// 					if ( vid !== video && ! userControlledVideos.has( vid ) ) {
	// 						vid.muted = true;
	// 						vid.play();
	// 						createLoop( vid );
	// 					}
	// 				} );
	// 			} else {
	// 				userControlledVideos.add( video );
	// 				stopAllVideos( video );
	// 				video.play();

	// 				const playBtn = container.querySelector( '.godam-play-button' );
	// 				if ( playBtn ) {
	// 					playBtn.style.display = 'none';
	// 				}
	// 			}
	// 		} );
	// 	} );

	// 	// Update SVG icon (mute/unmute)
	// 	function updateUnmuteIcon( button, isMuted ) {
	// 		const svg = button.querySelector( 'svg' );
	// 		if ( ! svg ) {
	// 			return;
	// 		}
	// 		const cross = svg.querySelector( 'g' );
	// 		if ( cross ) {
	// 			cross.style.display = isMuted ? 'block' : 'none';
	// 		}
	// 	}

	// Initial autoplay loop setup
	videos.forEach( ( video ) => {
		if ( video.hasAttribute( 'autoplay' ) ) {
			// createLoop( video );
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

document.addEventListener( 'click', async function( e ) {
	const playButton = e.target.closest( '.godam-play-button' ) || e.target.closest( '.godam-unmute-button' );
	if ( ! playButton ) {
		return;
	}

	const productVideo = playButton.previousElementSibling;
	const videoId = productVideo?.classList.contains( 'godam-product-video' )
		? productVideo.getAttribute( 'data-video-id' )
		: null;

	if ( ! videoId ) {
		return;
	}

	const currentGallery = playButton.closest( '.godam-product-gallery' );

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
		<div class="godam-product-modal-overlay"></div>
		<div class="godam-product-modal-content">
			<span class="godam-product-modal-close">&times;</span>
			<div class="easydam-video-container animate-video-loading" style="aspect-ratio:9/16;">
				<div class="animate-play-btn">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
						<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
					</svg>
				</div>
			</div>
			<div class="godam-modal-footer">
				<div class="godam-video-info">
					<h3 class="godam-video-title"></h3>
					<span class="godam-video-date"></span>
				</div>
			</div>
		</div>
	`;

	modal.classList.remove( 'hidden' );
	document.body.style.overflow = 'hidden';

	const loadNewVideo = async ( newVideoId ) => {
		if ( modal.dataset.isLoading === 'true' ) {
			return;
		}

		modal.dataset.isLoading = 'true';
		modal.dataset.currentVideoId = newVideoId;

		const container = modal.querySelector( '.easydam-video-container' );
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

		// try {
		// 	const res = await fetch( `/wp-json/godam/v1/video-shortcode?id=${ newVideoId }` );
		// 	const data = await res.json();

		// 	if ( data.status === 'success' && data.html ) {
		// 		container.innerHTML = data.html;
		// 		container.classList.remove( 'animate-video-loading' );

		// 		const title = modal.querySelector( '.godam-video-title' );
		// 		const date = modal.querySelector( '.godam-video-date' );
		// 		if ( title ) {
		// 			title.innerHTML = DOMPurify.sanitize( data.title || '' );
		// 		}
		// 		if ( date ) {
		// 			date.textContent = data.date || '';
		// 		}

		// 		if ( typeof GODAMPlayer === 'function' ) {
		// 			GODAMPlayer( modal );
		// 			const player = modal.querySelector( '.video-js' );
		// 			if ( player?.player ) {
		// 				player.player.play();
		// 			}
		// 		}
		// 	} else {
		// 		container.innerHTML = `<div class="godam-error-message">Video could not be loaded.</div>`;
		// 		container.classList.remove( 'animate-video-loading' );
		// 	}
		// } catch ( err ) {
		// 	container.innerHTML = `<div class="godam-error-message">Video could not be loaded.</div>`;
		// 	container.classList.remove( 'animate-video-loading' );
		// } finally {
		// 	modal.dataset.isLoading = 'false';
		// }

		try {
			const res = await fetch( `/wp-json/godam/v1/video-shortcode?id=${ newVideoId }` );
			const data = await res.json();

			if ( data.status === 'success' && data.html ) {
				let html = data.html;

				// 🔁 Match and modify the `data-options` JSON string inside the HTML
				html = html.replace( /data-options="([^"]+)"/, ( match, jsonEncoded ) => {
					const decoded = jsonEncoded.replace( /&quot;/g, '"' );

					try {
						const json = JSON.parse( decoded );
						json.aspectRatio = '9/16'; // update
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
					'--rtgodam-video-aspect-ratio: 9/16',
				);

				// ✅ Inject updated HTML with properly escaped attributes
				container.innerHTML = html;
				container.classList.remove( 'animate-video-loading' );

				// title + date
				const title = modal.querySelector( '.godam-video-title' );
				const date = modal.querySelector( '.godam-video-date' );
				if ( title ) {
					title.innerHTML = DOMPurify.sanitize( data.title || '' );
				}
				if ( date ) {
					date.textContent = data.date || '';
				}

				// player
				if ( typeof GODAMPlayer === 'function' ) {
					GODAMPlayer( modal );

					const player = modal.querySelector( '.video-js' );
					if ( player?.player ) {
						player.player.play();
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

	const close = () => {
		modal.classList.add( 'hidden' );
		document.body.style.overflow = '';
		const players = modal.querySelectorAll( '.video-js' );
		players.forEach( ( p ) => p?.player?.dispose?.() );
	};

	modal.querySelector( '.godam-product-modal-close' )?.addEventListener( 'click', close );
	modal.addEventListener( 'click', ( ev ) => {
		if ( ! ev.target.closest( '.godam-product-modal-content' ) ) {
			close();
		}
	} );

	await loadNewVideo( videoId );

	/** Scroll/swipe nav for modal */
	const getVideoItems = () => currentGallery?.querySelectorAll( '.godam-product-video' ) || [];
	const SCROLL_COOLDOWN = 800;
	let lastScroll = 0;

	const handleNextPrev = async ( direction ) => {
		const videos = getVideoItems();
		const currentId = modal.dataset.currentVideoId;
		const index = Array.from( videos ).findIndex( ( el ) =>
			el.getAttribute( 'data-video-id' ) === currentId,
		);
		if ( index === -1 ) {
			return;
		}

		const newIndex = direction === 'next' ? index + 1 : index - 1;
		const newVideo = videos[ newIndex ];
		if ( ! newVideo ) {
			return;
		}

		const newId = newVideo.getAttribute( 'data-video-id' );
		if ( newId && newId !== currentId ) {
			lastScroll = Date.now();
			await loadNewVideo( newId );
		}
	};

	// Wheel nav (desktop)
	let scrollTimeout;
	modal.addEventListener( 'wheel', ( ev ) => {
		ev.preventDefault();
		clearTimeout( scrollTimeout );
		scrollTimeout = setTimeout( () => {
			if ( Date.now() - lastScroll < SCROLL_COOLDOWN ) {
				return;
			}
			handleNextPrev( ev.deltaY > 0 ? 'next' : 'prev' );
		}, 150 );
	}, { passive: false } );

	// Swipe nav (mobile)
	let touchStartY = 0;
	modal.addEventListener( 'touchstart', ( ev ) => {
		touchStartY = ev.touches[ 0 ].clientY;
	}, { passive: false } );

	modal.addEventListener( 'touchend', ( ev ) => {
		const touchEndY = ev.changedTouches[ 0 ].clientY;
		const diff = touchStartY - touchEndY;
		if ( Math.abs( diff ) > 50 && Date.now() - lastScroll > SCROLL_COOLDOWN ) {
			handleNextPrev( diff > 0 ? 'next' : 'prev' );
		}
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
			const icon = e.target.textContent.trim();
			const productId = e.target.dataset.productId;

			if ( icon === '▾' ) {
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
				cloned.style.zIndex = 9999;
				document.body.appendChild( cloned );

				activeDropdown = cloned;
				activeButton = e.target;

				const rect = wrapper.getBoundingClientRect();
				cloned.style.top = `${ rect.bottom + window.scrollY }px`;
				cloned.style.left = `${ rect.left + window.scrollX }px`;
				cloned.style.width = `${ rect.width }px`;

				cloned.querySelectorAll( '.cta-add-to-cart' ).forEach( ( btn ) => {
					btn.addEventListener( 'click', ( event ) => {
						addToCart( event.target.dataset.productId );
					} );
				} );
			} else {
				addToCart( productId );
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

	// function addToCart( productId ) {
	// 	console.log( godamVars.api_nonce );
	// 	fetch( '/wp-json/wc/store/cart/add-item', {
	// 		method: 'POST',
	// 		headers: {
	// 			'Content-Type': 'application/json',
	// 			Nonce: godamVars.api_nonce,
	// 		},
	// 		body: JSON.stringify( {
	// 			id: parseInt( productId ),
	// 			quantity: 1,
	// 		} ),
	// 	} )
	// 		.then( ( response ) => {
	// 			if ( ! response.ok ) {
	// 				throw new Error( 'Network response was not OK' );
	// 			}
	// 			return response.json();
	// 		} )
	// 		.then( ( data ) => {
	// 			if ( data ) {
	// 				console.log( 'yes' );
	// 				// Open WooCommerce Mini Cart drawer
	// 				// const openCartEvent = new CustomEvent( 'wc-blocks_mini-cart_toggle', {
	// 				// 	detail: { isOpen: true },
	// 				// } );
	// 				// document.dispatchEvent( openCartEvent );
	// 				refreshMiniCart();
	// 				openMiniCartDrawer();
	// 			}
	// 		} )
	// 		.catch( ( error ) => {
	// 			console.error( 'Add to cart failed:', error );
	// 		} );
	// }

	// function openMiniCartDrawer() {
	// 	const cartButton = document.querySelector( '.wc-block-mini-cart__button' );
	// 	if ( cartButton ) {
	// 		cartButton.click();
	// 	}
	// }

	// function refreshMiniCart() {
	// 	fetch( '/?wc-ajax=get_refreshed_fragments', {
	// 		method: 'POST',
	// 		headers: {
	// 			'Content-Type': 'application/x-www-form-urlencoded',
	// 		},
	// 	} )
	// 		.then( ( res ) => res.json() )
	// 		.then( ( data ) => {
	// 			// Replace with the selector you confirmed exists
	// 			// const html = data.fragments[ 'div.widget_shopping_cart_content' ];
	// 			const target = document.querySelector( 'div.wp-block-woocommerce-mini-cart-contents' );

	// 			if ( target ) {
	// 				// target.innerHTML = html;
	// 				console.log( '✅ Mini cart content updated' );
	// 				jQuery( document.body ).trigger( 'wc_fragments_loaded' );
	// 			} else {
	// 				console.warn( '⚠️ Mini cart container not found or HTML missing' );
	// 			}
	// 		} );
	// }

	function addToCart( productId ) {
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

