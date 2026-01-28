/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { PRODUCT_HOTSPOT_CONSTANTS } from '../../utils/constants';

/**
 * WooCommerce Layer Manager
 * Handles WooCommerce layer functionality including creation, positioning, and interaction
 */
export default class WooCommerceLayerManager {
	static BASE_WIDTH = PRODUCT_HOTSPOT_CONSTANTS.BASE_WIDTH;
	static BASE_HEIGHT = PRODUCT_HOTSPOT_CONSTANTS.BASE_HEIGHT;

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

		// Use requestAnimationFrame to wait for layout to stabilize after fullscreen resize.
		let framesToWait = 2;
		const waitForResize = () => {
			if ( framesToWait > 0 ) {
				framesToWait--;
				window.requestAnimationFrame( waitForResize );
			} else {
				this.updateProductHotspotPositions();
			}
		};
		window.requestAnimationFrame( waitForResize );
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

		// Get all unique product IDs
		const productIds = [ ...new Set(
			layerObj.productHotspots
				.filter( ( hotspot ) => hotspot.productId )
				.map( ( hotspot ) => hotspot.productId ),
		) ];

		// If no products, return early
		if ( productIds.length === 0 ) {
			return;
		}

		// Track hotspot elements by index for later updates
		const hotspotElements = [];

		// First, create placeholder hotspots (without using old productDetails)
		layerObj.productHotspots.forEach( ( hotspot, index ) => {
			if ( hotspot.productId ) {
				// Create a clean hotspot object without old productDetails
				const cleanHotspot = { ...hotspot, productDetails: null };

				const hotspotDiv = this.createProductHotspotElement( cleanHotspot, miniCart, containerWidth, containerHeight, baseWidth, baseHeight );

				// Store element reference by index
				hotspotElements[ index ] = hotspotDiv;

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
			}
		} );

		// Then fetch all products in parallel and update hotspots
		const productPromises = productIds.map( ( productId ) =>
			apiFetch( {
				url: `${ window.godamRestRoute?.url || '' }godam/v1/wcproduct?id=${ productId }`,
			} ).catch( ( error ) => {
				// eslint-disable-next-line no-console
				console.error( `Error loading product ${ productId }:`, error );
				return null;
			} ),
		);

		// Update hotspots once products are loaded
		Promise.all( productPromises ).then( ( products ) => {
			const productMap = {};

			// Create a map of productId -> product data
			products.forEach( ( product ) => {
				if ( product ) {
					productMap[ product.id ] = product;
				}
			} );

			// Update hotspots with loaded product data
			layerObj.productHotspots.forEach( ( hotspot, index ) => {
				if ( hotspot.productId && productMap[ hotspot.productId ] ) {
					// Attach fetched product details to hotspot object
					hotspot.productDetails = productMap[ hotspot.productId ];

					// Get the hotspot element we created earlier
					const hotspotEl = hotspotElements[ index ];
					if ( hotspotEl ) {
						// Replace placeholder box with a newly built one (ensures correct markup + handlers)
						const oldProductBoxDiv = hotspotEl.querySelector( '.product-hotspot-box' );
						if ( oldProductBoxDiv ) {
							const newProductBoxDiv = this.createProductHotspotProductBox( hotspot, miniCart );
							oldProductBoxDiv.replaceWith( newProductBoxDiv );

							// Reposition the product box
							requestAnimationFrame( () => {
								this.positionProductBox( hotspotEl, newProductBoxDiv );
							} );
						}
					}
				}
			} );
		} );
	}

	/**
	 * Render product box content HTML
	 *
	 * @param {Object} hotspot - Hotspot with product details
	 * @return {string} HTML content for product box
	 */
	renderProductBoxContent( hotspot ) {
		const productData = hotspot.productDetails;

		if ( ! productData ) {
			return '<div>No product selected</div>';
		}

		const cartUrl = `${ window.easydamMediaLibrary.wooCartURL }?add-to-cart=${ hotspot.productId }&source=productHotspot`;
		const productLink = hotspot.addToCart ? productData.link : cartUrl;

		return `
			<div class="product-hotspot-woo-display">
				<div class="product-hotspot-woo-image-wrapper">
					<img class="product-hotspot-woo-image" src="${ productData.image }" alt="${ productData.name }" />
				</div>
				<div class="product-hotspot-woo-details">
					<div class="product-hotspot-woo-name">${ productData.name }</div>
					<div class="product-hotspot-woo-price">${ productData.price }</div>
					<a class="product-hotspot-woo-link" href="${ productLink }" target="_blank" rel="noopener noreferrer" style="background: ${ hotspot.backgroundColor || '#0c80dfa6' }">
						${ hotspot.shopText || ( hotspot.addToCart ? 'View Product' : 'Buy Now' ) }
					</a>
				</div>
			</div>
		`;
	}

	/**
	 * Compute content rectangle
	 *
	 * @return {Object|null} Content rectangle {left, top, width, height} or null
	 */
	computeContentRect() {
		const videoEl = this.player.tech( true )?.el() || this.player.el().querySelector( 'video' );
		const containerEl = this.player.el();

		if ( ! videoEl || ! containerEl ) {
			return null;
		}

		const nativeW = videoEl.videoWidth || this.player.videoWidth() || 0;
		const nativeH = videoEl.videoHeight || this.player.videoHeight() || 0;

		const elW = containerEl.offsetWidth;
		const elH = containerEl.offsetHeight;

		// If video dimensions aren't loaded yet, use full container
		if ( ! nativeW || ! nativeH ) {
			return {
				left: 0,
				top: 0,
				width: elW,
				height: elH,
			};
		}

		const videoAspectRatio = nativeW / nativeH;
		const containerAspectRatio = elW / elH;

		let contentW, contentH, offsetX, offsetY;

		if ( containerAspectRatio > videoAspectRatio ) {
			// Pillarboxed (black bars on left/right)
			contentH = elH;
			contentW = elH * videoAspectRatio;
			offsetX = ( elW - contentW ) / 2;
			offsetY = 0;
		} else {
			// Letterboxed (black bars on top/bottom)
			contentW = elW;
			contentH = elW / videoAspectRatio;
			offsetX = 0;
			offsetY = ( elH - contentH ) / 2;
		}

		const result = {
			left: Math.round( offsetX ),
			top: Math.round( offsetY ),
			width: Math.round( contentW ),
			height: Math.round( contentH ),
		};

		return result;
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

		const contentRect = this.computeContentRect();

		// Positioning
		const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
		const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;

		let fallbackDiameter = hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? 48;
		if ( ! fallbackDiameter ) {
			if ( hotspot.unit === 'percent' && contentRect ) {
				fallbackDiameter = ( PRODUCT_HOTSPOT_CONSTANTS.DEFAULT_DIAMETER_PX / contentRect.width ) * 100;
			} else {
				fallbackDiameter = hotspot.unit === 'percent' ? PRODUCT_HOTSPOT_CONSTANTS.DEFAULT_DIAMETER_PERCENT : PRODUCT_HOTSPOT_CONSTANTS.DEFAULT_DIAMETER_PX;
			}
		}

		let pixelX, pixelY, pixelDiameter;

		if ( hotspot.unit === 'percent' && contentRect ) {
			// New percentage-based positioning
			pixelX = contentRect.left + ( ( fallbackPosX / 100 ) * contentRect.width );
			pixelY = contentRect.top + ( ( fallbackPosY / 100 ) * contentRect.height );
			pixelDiameter = ( fallbackDiameter / 100 ) * contentRect.width;
		} else {
			// Legacy pixel-based positioning (relative to 800x600)
			// We now map these to the contentRect instead of the full container to avoid black bars
			const effectiveRect = contentRect || { left: 0, top: 0, width: containerWidth, height: containerHeight };
			pixelX = effectiveRect.left + ( ( fallbackPosX / baseWidth ) * effectiveRect.width );
			pixelY = effectiveRect.top + ( ( fallbackPosY / baseHeight ) * effectiveRect.height );
			pixelDiameter = ( fallbackDiameter / baseWidth ) * effectiveRect.width;
		}

		hotspotDiv.style.left = `${ pixelX }px`;
		hotspotDiv.style.top = `${ pixelY }px`;
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
		noProductDiv.textContent = __( 'No product found', 'godam' );

		// Product display
		const productDisplayDiv = document.createElement( 'div' );
		productDisplayDiv.classList.add( 'product-hotspot-woo-display' );

		if ( ! hotspot?.productDetails ) {
			productBoxDiv.appendChild( noProductDiv );
			return productBoxDiv;
		}

		productBoxDiv.appendChild( productDisplayDiv );

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
	 * Position product box relative to hotspot, constrained within the video container
	 *
	 * @param {HTMLElement} hotspotDiv    - The product hotspot element for positioning reference
	 * @param {HTMLElement} productBoxDiv - The product box element to position
	 */
	positionProductBox( hotspotDiv, productBoxDiv ) {
		const videoContainer = this.player.el();
		const containerRect = videoContainer.getBoundingClientRect();
		const hotspotRect = hotspotDiv.getBoundingClientRect();

		// Temporarily make tooltip visible to measure it accurately
		const originalVisibility = productBoxDiv.style.visibility;
		const originalOpacity = productBoxDiv.style.opacity;
		productBoxDiv.style.visibility = 'hidden';
		productBoxDiv.style.opacity = '0';
		productBoxDiv.style.display = 'block';

		const productBoxRect = productBoxDiv.getBoundingClientRect();

		// Restore original styles
		productBoxDiv.style.visibility = originalVisibility;
		productBoxDiv.style.opacity = originalOpacity;

		// Calculate space relative to video container (not viewport)
		const spaceAbove = hotspotRect.top - containerRect.top;
		const spaceBelow = containerRect.bottom - hotspotRect.bottom;

		const productBoxHeight = productBoxRect.height;
		const productBoxWidth = productBoxRect.width;

		// Minimum padding from container edges
		const edgePadding = 8;

		// Reset all positioning classes and styles first
		productBoxDiv.classList.remove( 'tooltip-top', 'tooltip-bottom', 'tooltip-left', 'tooltip-right', 'no-arrow', 'product-bottom' );
		productBoxDiv.style.top = '';
		productBoxDiv.style.bottom = '';
		productBoxDiv.style.left = '';
		productBoxDiv.style.right = '';
		productBoxDiv.style.transform = '';

		// Vertical positioning - prefer above, fallback to below
		if ( spaceAbove >= productBoxHeight + edgePadding ) {
			// Place above
			productBoxDiv.style.bottom = '100%';
			productBoxDiv.style.top = 'auto';
			productBoxDiv.classList.add( 'tooltip-top' );
		} else if ( spaceBelow >= productBoxHeight + edgePadding ) {
			// Place below
			productBoxDiv.style.bottom = 'auto';
			productBoxDiv.style.top = '100%';
			productBoxDiv.classList.add( 'product-bottom' );
		} else if ( spaceAbove >= spaceBelow ) {
			productBoxDiv.style.bottom = '100%';
			productBoxDiv.style.top = 'auto';
			productBoxDiv.classList.add( 'tooltip-top' );
		} else {
			productBoxDiv.style.bottom = 'auto';
			productBoxDiv.style.top = '100%';
			productBoxDiv.classList.add( 'product-bottom' );
		}

		// Horizontal positioning - calculate where tooltip would overflow
		const hotspotCenterInContainer = ( hotspotRect.left + ( hotspotRect.width / 2 ) ) - containerRect.left;
		const productBoxHalfWidth = productBoxWidth / 2;

		// Check if centered productBox would overflow left or right of container
		const wouldOverflowLeft = ( hotspotCenterInContainer - productBoxHalfWidth ) < edgePadding;
		const wouldOverflowRight = ( hotspotCenterInContainer + productBoxHalfWidth ) > ( containerRect.width - edgePadding );

		if ( wouldOverflowLeft && wouldOverflowRight ) {
			// Tooltip is wider than available space, center it as best as possible
			productBoxDiv.style.left = '50%';
			productBoxDiv.style.transform = 'translateX(-50%)';
			productBoxDiv.classList.add( 'no-arrow' );
		} else if ( wouldOverflowLeft ) {
			// Align tooltip to the left edge of hotspot, but ensure it stays within container
			const leftOffset = Math.max( edgePadding - ( hotspotRect.left - containerRect.left ), 0 );
			productBoxDiv.style.left = `${ leftOffset }px`;
			productBoxDiv.style.right = 'auto';
			productBoxDiv.style.transform = 'translateX(0)';
			productBoxDiv.classList.add( 'tooltip-left', 'no-arrow' );
		} else if ( wouldOverflowRight ) {
			// Align tooltip to the right edge of hotspot, but ensure it stays within container
			const rightOffset = Math.max( edgePadding - ( containerRect.right - hotspotRect.right ), 0 );
			productBoxDiv.style.left = 'auto';
			productBoxDiv.style.right = `${ rightOffset }px`;
			productBoxDiv.style.transform = 'translateX(0)';
			productBoxDiv.classList.add( 'tooltip-right', 'no-arrow' );
		} else {
			// Centered horizontally - tooltip fits within container
			productBoxDiv.style.left = '50%';
			productBoxDiv.style.right = 'auto';
			productBoxDiv.style.transform = 'translateX(-50%)';
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

		const contentRect = this.computeContentRect();

		this.wooLayers.forEach( ( layerObj ) => {
			const hotspotDivs = layerObj.layerElement.querySelectorAll( '.hotspot' );
			hotspotDivs.forEach( ( hotspotDiv, index ) => {
				const hotspot = layerObj.productHotspots[ index ];

				// Recalc position
				const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
				const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;
				const fallbackDiameter = hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? 48;

				let pixelX, pixelY, pixelDiameter;

				if ( hotspot.unit === 'percent' && contentRect ) {
					// New percentage-based positioning
					pixelX = contentRect.left + ( ( fallbackPosX / 100 ) * contentRect.width );
					pixelY = contentRect.top + ( ( fallbackPosY / 100 ) * contentRect.height );
					pixelDiameter = ( fallbackDiameter / 100 ) * contentRect.width;
				} else {
					// Legacy pixel-based positioning
					// We now map these to the contentRect instead of the full container to avoid black bars
					const effectiveRect = contentRect || { left: 0, top: 0, width: containerWidth, height: containerHeight };
					pixelX = effectiveRect.left + ( ( fallbackPosX / baseWidth ) * effectiveRect.width );
					pixelY = effectiveRect.top + ( ( fallbackPosY / baseHeight ) * effectiveRect.height );
					pixelDiameter = ( fallbackDiameter / baseWidth ) * effectiveRect.width;
				}

				hotspotDiv.style.left = `${ pixelX }px`;
				hotspotDiv.style.top = `${ pixelY }px`;
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
