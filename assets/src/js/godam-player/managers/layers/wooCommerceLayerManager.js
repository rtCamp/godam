/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';

/**
 * WooCommerce Layer Manager
 * Handles WooCommerce layer functionality including creation, positioning, and interaction
 */
export default class WooCommerceLayerManager {
	static BASE_WIDTH = 800;
	static BASE_HEIGHT = 600;

	constructor( player, isDisplayingLayers, currentPlayerVideoInstanceId ) {
		this.player = player;
		this.wooLayers = [];
		this.wasPlayingBeforeHover = false;
		this.isDisplayingLayers = isDisplayingLayers;
		this.currentPlayerVideoInstanceId = currentPlayerVideoInstanceId;
	}

	/**
	 * Setup WooCommerce layer
	 *
	 * @param {Object}      layer        - Layer configuration object
	 * @param {HTMLElement} layerElement - Layer DOM element
	 */
	setupWooCommerceLayer( layer, layerElement ) {
		const layerObj = {
			layerElement,
			displayTime: parseFloat( layer.displayTime ),
			duration: layer.duration ? parseInt( layer.duration ) : 0,
			show: true,
			productHotspots: layer.productHotspots || [],
			pauseOnHover: layer.pauseOnHover || false,
			miniCart: layer.miniCart || false,
		};

		this.wooLayers.push( layerObj );
	}

	/**
	 * Handle WooCommerce layers time update
	 *
	 * @param {number} currentTime - Current video time in seconds
	 */
	handleWooCommerceLayersTimeUpdate( currentTime ) {
		const blockedByLayer = this.isDisplayingLayers?.[ this.currentPlayerVideoInstanceId ] === true;

		this.wooLayers.forEach( ( layerObj ) => {
			if ( ! layerObj.show ) {
				return;
			}

			const endTime = layerObj.displayTime + layerObj.duration;
			const isActive = currentTime >= layerObj.displayTime && currentTime < endTime;

			if ( blockedByLayer ) {
				if ( ! layerObj.layerElement.classList.contains( 'overlapped' ) ) {
					layerObj.layerElement.classList.add( 'overlapped' );
				}
			} else if ( layerObj.layerElement.classList.contains( 'overlapped' ) ) {
				layerObj.layerElement.classList.remove( 'overlapped' );
			}

			if ( isActive ) {
				if ( layerObj.layerElement.classList.contains( 'hidden' ) ) {
					layerObj.layerElement.classList.remove( 'hidden' );
					if ( ! layerObj.layerElement.dataset?.productHotspotsInitialized ) {
						this.createProductHotspots( layerObj );
						layerObj.layerElement.dataset.productHotspotsInitialized = true;
					}
				}
			} else if ( ! layerObj.layerElement.classList.contains( 'hidden' ) ) {
				layerObj.layerElement.classList.add( 'hidden' );
			}
		} );
	}

	/**
	 * Handle fullscreen changes for WooCommerce layers
	 *
	 * @param {boolean}     isFullscreen   - Whether player is in fullscreen
	 * @param {HTMLElement} videoContainer - Video container element
	 */
	handleFullscreenChange( isFullscreen, videoContainer ) {
		this.wooLayers.forEach( ( layerObj ) => {
			if ( isFullscreen && ! videoContainer.contains( layerObj.layerElement ) ) {
				videoContainer.appendChild( layerObj.layerElement );

				// Move cart message to fullscreen.
				const msg = document.querySelector( '.mini-cart-product-message' );
				if ( msg ) {
					videoContainer.appendChild( msg );
				}
			}
		} );

		this.updateProductHotspotPositions();
	}

	/**
	 * Create Product hotspots for WooCommerce layer
	 *
	 * @param {Object} layerObj - Layer object containing Product hotspots and configuration
	 */
	createProductHotspots( layerObj ) {
		const videoContainer = this.player.el();
		const containerWidth = videoContainer?.offsetWidth;
		const containerHeight = videoContainer?.offsetHeight;

		const baseWidth = WooCommerceLayerManager.BASE_WIDTH;
		const baseHeight = WooCommerceLayerManager.BASE_HEIGHT;

		const miniCart = layerObj.miniCart;

		layerObj.productHotspots.forEach( ( hotspot ) => {
			const hotspotDiv = this.createProductHotspotElement( hotspot, miniCart, containerWidth, containerHeight, baseWidth, baseHeight );

			if ( layerObj.pauseOnHover ) {
				this.setupProductHotspotHoverEvents( hotspotDiv );
			}

			layerObj.layerElement.appendChild( hotspotDiv );

			const productBoxDiv = hotspotDiv.querySelector( '.product-hotspot-box' );
			if ( productBoxDiv ) {
				requestAnimationFrame( () => {
					this.positionProductBox( hotspotDiv, productBoxDiv );
				} );
			}
		} );
	}

	/**
	 * Create Product hotspot element
	 *
	 * @param {Object}  hotspot         - Product Hotspot configuration object
	 * @param {boolean} miniCart        - Minicart toggle value
	 * @param {number}  containerWidth  - Width of the video container
	 * @param {number}  containerHeight - Height of the video container
	 * @param {number}  baseWidth       - Base width for calculations
	 * @param {number}  baseHeight      - Base height for calculations
	 * @return {HTMLElement} Created hotspot element
	 */
	createProductHotspotElement( hotspot, miniCart, containerWidth, containerHeight, baseWidth, baseHeight ) {
		const hotspotDiv = document.createElement( 'div' );
		hotspotDiv.classList.add( 'hotspot', 'circle' );
		hotspotDiv.style.position = 'absolute';

		// Positioning
		const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
		const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;
		const pixelX = ( fallbackPosX / baseWidth ) * containerWidth;
		const pixelY = ( fallbackPosY / baseHeight ) * containerHeight;

		hotspotDiv.style.left = `${ pixelX }px`;
		hotspotDiv.style.top = `${ pixelY }px`;

		// Sizing
		const fallbackDiameter = hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? 48;
		const pixelDiameter = ( fallbackDiameter / baseWidth ) * containerWidth;
		hotspotDiv.style.width = `${ pixelDiameter }px`;
		hotspotDiv.style.height = `${ pixelDiameter }px`;

		// Background color
		hotspotDiv.style.backgroundColor = hotspot.icon ? 'white' : ( hotspot.backgroundColor || '#0c80dfa6' );

		// Create content
		const hotspotContent = this.createProductHotspotContent( hotspot, miniCart );
		hotspotDiv.appendChild( hotspotContent );

		return hotspotDiv;
	}

	/**
	 * Create hotspot content
	 *
	 * @param {Object}  hotspot  - Product Hotspot configuration object
	 * @param {boolean} miniCart - Minicart toggle value
	 * @return {HTMLElement} Created content element
	 */
	createProductHotspotContent( hotspot, miniCart ) {
		const hotspotContent = document.createElement( 'div' );
		hotspotContent.classList.add( 'hotspot-content' );
		hotspotContent.style.position = 'relative';
		hotspotContent.style.width = '100%';
		hotspotContent.style.height = '100%';

		if ( hotspot.icon ) {
			const iconEl = this.createProductHotspotIcon( hotspot.icon );
			hotspotContent.appendChild( iconEl );
		} else {
			hotspotContent.classList.add( 'no-icon' );
		}

		const productBoxDiv = this.createProductHotspotProductBox( hotspot, miniCart );
		hotspotContent.appendChild( productBoxDiv );

		return hotspotContent;
	}

	/**
	 * Create Product hotspot icon
	 *
	 * @param {string} icon - Icon configuration or path
	 * @return {HTMLElement} Created icon element
	 */
	createProductHotspotIcon( icon ) {
		const iconEl = document.createElement( 'i' );
		iconEl.className = `fa-solid fa-${ icon }`;
		iconEl.style.width = '50%';
		iconEl.style.height = '50%';
		iconEl.style.fontSize = '1.6em';
		iconEl.style.display = 'flex';
		iconEl.style.alignItems = 'center';
		iconEl.style.justifyContent = 'center';
		iconEl.style.margin = 'auto';
		iconEl.style.color = '#000';

		return iconEl;
	}

	/**
	 * Create Product Hotspot Product Box
	 *
	 * @param {Object}  hotspot  - Product Hotspot configuration object
	 * @param {boolean} miniCart - Minicart toggle value
	 * @return {HTMLElement} Created product box element
	 */
	createProductHotspotProductBox( hotspot, miniCart ) {
		// Product box
		const productBoxDiv = document.createElement( 'div' );
		productBoxDiv.classList.add( 'product-hotspot-box' );

		// No product
		const noProductDiv = document.createElement( 'div' );
		noProductDiv.textContent = __( 'No product here', 'godam' );

		// Product display
		const productDisplayDiv = document.createElement( 'div' );
		productDisplayDiv.classList.add( 'product-hotspot-woo-display' );

		if ( hotspot?.productDetails ) {
			productBoxDiv.appendChild( productDisplayDiv );
		} else {
			productBoxDiv.appendChild( noProductDiv );
		}

		// Image wrapper
		const imageWrapperDiv = document.createElement( 'div' );
		imageWrapperDiv.classList.add( 'product-hotspot-woo-image-wrapper' );
		productDisplayDiv.appendChild( imageWrapperDiv );

		// Image
		const imageBox = document.createElement( 'img' );
		imageBox.classList.add( 'product-hotspot-woo-image' );
		imageBox.src = hotspot.productDetails.image;
		imageBox.alt = hotspot.productDetails.name;
		imageWrapperDiv.appendChild( imageBox );

		// Product details
		const productDetailsDiv = document.createElement( 'div' );
		productDetailsDiv.classList.add( 'product-hotspot-woo-details' );
		productDisplayDiv.appendChild( productDetailsDiv );

		// Product name
		const productNameDiv = document.createElement( 'div' );
		productNameDiv.classList.add( 'product-hotspot-woo-name' );
		productNameDiv.textContent = hotspot.productDetails.name;
		productDetailsDiv.appendChild( productNameDiv );

		// Redirect image + name to product page if addToCart is false
		if ( ! hotspot.addToCart ) {
			imageBox.style.cursor = 'pointer';
			productNameDiv.style.cursor = 'pointer';

			// Add interactive classes for animation.
			imageBox.classList.add( 'product-hotspot-image-clickable' );
			productNameDiv.classList.add( 'product-hotspot-name-clickable' );

			// Dynamic hover color.
			productNameDiv.addEventListener( 'mouseenter', () => {
				productNameDiv.style.color = hotspot.backgroundColor || '#ab3a6c';
			} );
			productNameDiv.addEventListener( 'mouseleave', () => {
				productNameDiv.style.color = '';
			} );

			const goToProduct = () => {
				window.open( hotspot.productDetails.link, '_blank' );
			};

			imageBox.addEventListener( 'click', goToProduct );
			productNameDiv.addEventListener( 'click', goToProduct );
		}

		// Product price
		const productPriceDiv = document.createElement( 'div' );
		productPriceDiv.classList.add( 'product-hotspot-woo-price' );
		productPriceDiv.innerHTML = hotspot.productDetails.price;
		productDetailsDiv.appendChild( productPriceDiv );

		if ( ! miniCart ) {
			// Product link when Mini Cart is false.
			const productLink = document.createElement( 'a' );
			productLink.classList.add( 'product-hotspot-woo-link' );
			productLink.href = hotspot.addToCart ? hotspot.productDetails.link : `${ window.godamWooSettings.url }?add-to-cart=${ hotspot.productId }&source=productHotspot`;
			productLink.target = '_blank';
			productLink.rel = 'noopener noreferrer';
			productLink.style.background = hotspot.backgroundColor;

			// Product Button Label.
			const defaultLabel = hotspot.addToCart ? __( 'View Product', 'godam' ) : __( 'Buy Now', 'godam' );
			const shopText = hotspot.shopText?.trim();
			productLink.textContent = shopText ? shopText : defaultLabel;
			productDetailsDiv.appendChild( productLink );
		} else {
			// Product Link Button when Mini Cart is True.
			const productLinkButton = document.createElement( 'button' );
			productLinkButton.classList.add( 'product-hotspot-woo-link' );
			productLinkButton.style.background = hotspot.backgroundColor;

			// Product link button text
			const defaultLabel = hotspot.addToCart ? __( 'View Product', 'godam' ) : __( 'Buy Now', 'godam' );
			const shopText = hotspot.shopText?.trim();
			productLinkButton.textContent = shopText ? shopText : defaultLabel;

			// Disable Product Link button during async operation
			productLinkButton.addEventListener( 'click', ( event ) => {
				event.preventDefault();
				productLinkButton.disabled = true;
				productLinkButton.classList.add( 'loading' );

				if ( hotspot.addToCart ) {
					// Redirect to product details page
					window.open( hotspot.productDetails.link, '_blank' );
					productLinkButton.disabled = false;
					productLinkButton.classList.remove( 'loading' );
				} else {
					// Add to cart
					const productId = hotspot.productId;
					const quantity = 1;

					dispatch( 'wc/store/cart' )
						.addItemToCart( productId, quantity )
						.then( () => {
							productLinkButton.disabled = false;
							productLinkButton.classList.remove( 'loading' );
							this.showCartMessage( __( 'Product added successfully!', 'godam' ), 'success' );
						} )
						.catch( ( err ) => {
							// eslint-disable-next-line no-console
							console.error( 'Add to cart failed', err );
							productLinkButton.disabled = false;
							productLinkButton.classList.remove( 'loading' );

							// Check if error code is WooCommerce stock error.
							if ( err?.code === 'woocommerce_rest_product_partially_out_of_stock' ) {
								this.showCartMessage( __( 'Product is partially out of stock.', 'godam' ), 'error' );
							} else if ( err?.code === 'woocommerce_rest_product_out_of_stock' ) {
								this.showCartMessage( __( 'Product is out of stock.', 'godam' ), 'error' );
							} else {
								this.showCartMessage( __( 'Something went wrong. Try again.', 'godam' ), 'error' );
							}
						} );
				}
			} );

			productDetailsDiv.appendChild( productLinkButton );
		}

		return productBoxDiv;
	}

	// Helper function to show message
	showCartMessage( message, type = 'success' ) {
		let notifArea = document.querySelector( '.godam-notification-area' );
		notifArea = document.createElement( 'div' );
		notifArea.className = 'godam-notification-area';

		const msg = document.createElement( 'div' );
		msg.textContent = message;
		msg.classList.add( 'mini-cart-product-message', type );

		// Dynamic positioning.
		msg.style.position = 'fixed';
		msg.style.top = '50%';
		msg.style.left = '50%';
		msg.style.transform = 'translate(-50%, -50%) scale(0.96)';
		msg.style.zIndex = '999999999999999';

		notifArea.appendChild( msg );

		const container = this.player.el();
		container.appendChild( notifArea );

		requestAnimationFrame( () => {
			requestAnimationFrame( () => {
				msg.style.opacity = '1';
				msg.style.transform = 'translate(-50%, -50%) scale(1)';
			} );
		} );

		// Fade out and remove after 2s.
		setTimeout( () => {
			msg.style.opacity = '0';
			msg.style.transform = 'translate(-50%, -50%) scale(0.96)';
			setTimeout( () => {
				msg.remove();
				notifArea.remove();
			}, 300 );
		}, 2000 );
	}

	/**
	 * Setup hotspot hover events
	 *
	 * @param {HTMLElement} hotspotDiv - The hotspot element to add hover events to
	 */
	setupProductHotspotHoverEvents( hotspotDiv ) {
		hotspotDiv.addEventListener( 'mouseenter', () => {
			this.wasPlayingBeforeHover = ! this.player.paused();
			this.player.pause();
		} );

		hotspotDiv.addEventListener( 'mouseleave', () => {
			if ( this.wasPlayingBeforeHover ) {
				this.player.play();
			}
		} );
	}

	/**
	 * Position product box relative to hotspot
	 *
	 * @param {HTMLElement} hotspotDiv    - The product hotspot element for positioning reference
	 * @param {HTMLElement} productBoxDiv - The product box element to position
	 */
	positionProductBox( hotspotDiv, productBoxDiv ) {
		const hotspotRect = hotspotDiv.getBoundingClientRect();
		const tooltipRect = productBoxDiv.getBoundingClientRect();
		const viewportWidth = window.innerWidth;

		// Vertical positioning
		const spaceAbove = hotspotRect.top;
		if ( spaceAbove < tooltipRect.height + 10 ) {
			// Place below
			productBoxDiv.style.bottom = 'auto';
			productBoxDiv.style.top = '100%';
			productBoxDiv.classList.add( 'product-bottom' );
			productBoxDiv.classList.remove( 'tooltip-top' );
		} else {
			// Place above
			productBoxDiv.style.bottom = '100%';
			productBoxDiv.style.top = 'auto';
			productBoxDiv.classList.add( 'tooltip-top' );
			productBoxDiv.classList.remove( 'tooltip-bottom' );
		}

		// Horizontal positioning
		const spaceLeft = hotspotRect.left;
		const spaceRight = viewportWidth - hotspotRect.right;

		if ( spaceLeft < 10 ) {
			// Adjust to the right
			productBoxDiv.style.left = '0';
			productBoxDiv.style.transform = 'translateX(0)';
			productBoxDiv.classList.add( 'tooltip-left' );
			productBoxDiv.classList.remove( 'tooltip-right' );
			productBoxDiv.classList.add( 'no-arrow' );
		} else if ( spaceRight < 10 ) {
			// Adjust to the left
			productBoxDiv.style.left = 'auto';
			productBoxDiv.style.right = '0';
			productBoxDiv.style.transform = 'translateX(0)';
			productBoxDiv.classList.add( 'tooltip-right' );
			productBoxDiv.classList.remove( 'tooltip-left' );
			productBoxDiv.classList.add( 'no-arrow' );
		} else {
			// Centered horizontally
			productBoxDiv.style.left = '50%';
			productBoxDiv.style.right = 'auto';
			productBoxDiv.style.transform = 'translateX(-50%)';
			productBoxDiv.classList.remove( 'tooltip-left', 'tooltip-right', 'no-arrow' );
		}
	}

	/**
	 * Update hotspot positions on resize
	 */
	updateProductHotspotPositions() {
		const videoContainer = this.player.el();
		const containerWidth = videoContainer?.offsetWidth;
		const containerHeight = videoContainer?.offsetHeight;

		const baseWidth = WooCommerceLayerManager.BASE_WIDTH;
		const baseHeight = WooCommerceLayerManager.BASE_HEIGHT;

		this.wooLayers.forEach( ( layerObj ) => {
			const hotspotDivs = layerObj.layerElement.querySelectorAll( '.hotspot' );
			hotspotDivs.forEach( ( hotspotDiv, index ) => {
				const hotspot = layerObj.productHotspots[ index ];

				// Recalc position
				const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
				const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;
				const pixelX = ( fallbackPosX / baseWidth ) * containerWidth;
				const pixelY = ( fallbackPosY / baseHeight ) * containerHeight;
				hotspotDiv.style.left = `${ pixelX }px`;
				hotspotDiv.style.top = `${ pixelY }px`;

				// Recalc size
				const fallbackDiameter = hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? 48;
				const pixelDiameter = ( fallbackDiameter / baseWidth ) * containerWidth;
				hotspotDiv.style.width = `${ pixelDiameter }px`;
				hotspotDiv.style.height = `${ pixelDiameter }px`;

				const productBoxDiv = hotspotDiv.querySelector( '.product-hotspot-box' );
				if ( productBoxDiv ) {
					requestAnimationFrame( () => {
						this.positionProductBox( hotspotDiv, productBoxDiv );
					} );
				}
			} );
		} );
	}

	/**
	 * Reset WooCommerce hotspot layer state
	 */
	reset() {
		this.wooLayers = [];
		this.wasPlayingBeforeHover = false;
	}
}
