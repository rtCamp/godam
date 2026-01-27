/* global jQuery, myGalleryAjaxData, GODAMPlayer */

// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-console */

jQuery( document ).ready( function( $ ) {
	const emptySrcAlts = [];
	const emptyImgs = [];

	/**
	 * Process and identify empty thumbnails and trigger AJAX for video thumbnails.
	 */
	function handleGalleryImages() {
		// Open Photoswipe gallery.
		const $galleryWrapper = $( 'body' ).find( '.woocommerce-product-gallery__wrapper' );

		const emptyDivs = $galleryWrapper.find( '.woocommerce-product-gallery__image' ).filter( function() {
			return $( this ).find( 'img' ).length === 0;
		} );

		if ( ! emptyDivs.length ) {
			return;
		}

		// Thumbnail gallery.
		const $imgs = $( '.woocommerce-product-gallery' ).find( 'ol.flex-control-thumbs li img' );

		if ( $imgs.length === 0 ) {
			return;
		}

		$imgs.each( function() {
			const $img = $( this );
			const src = $img.attr( 'src' );
			const alt = $img.attr( 'alt' ) || '';

			if ( ! src || src.trim() === '' ) {
				emptySrcAlts.push( alt );
				emptyImgs.push( this );
			}
		} );

		if ( emptySrcAlts.length === 0 ) {
			return;
		}

		// Get Product Id.
		const productId = $( 'body' ).attr( 'class' ).split( ' ' ).find( ( c ) => c.startsWith( 'postid-' ) ).replace( 'postid-', '' );
		if ( ! productId || ! myGalleryAjaxData?.ajax_url || ! myGalleryAjaxData?.nonce ) {
			return;
		}

		$.post(
			myGalleryAjaxData.ajax_url,
			{
				action: 'send_empty_alts',
				nonce: myGalleryAjaxData.nonce,
				alts: emptySrcAlts,
				product_id: productId,
			},
			function( response ) {
				if ( ! response.success || ! response.data?.videoThumbs || ! response.data?.videoIds ) {
					console.error( 'Invalid AJAX response for video thumbnails' );
					return;
				}

				response.data.videoThumbs.forEach( function( thumbUrl, index ) {
					const videoId = response.data.videoIds[ index ];
					const imgEl = emptyImgs[ index ];
					const divEl = emptyDivs[ index ];

					if ( ! thumbUrl || ! videoId || ( ! imgEl && ! divEl ) ) {
						return;
					}

					// Open Photoswipe gallery Image video.
					const $div = $( divEl );
					const fullImage = thumbUrl.replace( '-100x100', '' );
					const thumbSrcSet = `${ thumbUrl } 100w, ${ thumbUrl.replace( '-100x100', '-150x150' ) } 150w, ${ thumbUrl.replace( '-100x100', '-300x300' ) } 300w`;
					const thumbSizes = '(max-width: 100px) 100vw, 100px';
					const mainImgSrc = thumbUrl.replace( '-100x100', '-600x744' );
					const mainSrcSet = `${ mainImgSrc } 600w, ${ mainImgSrc.replace( '-600x744', '-242x300' ) } 242w, ${ mainImgSrc.replace( '-600x744', '-825x1024' ) } 825w, ${ mainImgSrc.replace( '-600x744', '-768x953' ) } 768w, ${ fullImage } 1080w`;
					const mainSizes = '(max-width: 600px) 100vw, 600px';
					$div.attr( {
						'data-thumb': thumbUrl,
						'data-thumb-alt': $div.data( 'thumb-alt' ) || '',
						'data-thumb-srcset': thumbSrcSet,
						'data-thumb-sizes': thumbSizes,
					} );
					const $divImg = $( '<img>', {
						src: mainImgSrc,
						alt: $div.data( 'thumb-alt' ) || '',
						'data-caption': '',
						'data-src': fullImage,
						'data-large_image': fullImage,
						'data-large_image_width': 1080,
						'data-large_image_height': 1340,
						decoding: 'async',
						srcset: mainSrcSet,
						sizes: mainSizes,
						draggable: false,
						class: '',
					} ).attr( {
						width: 600,
						height: 744,
					} );
					$div.html( '' ).append( $( '<a>', { href: fullImage } ).append( $divImg ) );

					// Thumbnail gallery Image video.
					const $img = $( imgEl );
					$img.attr( 'src', thumbUrl )
						.attr( 'data-video-id', videoId )
						.addClass( 'godam-video-thumbnail' )
						.off( 'click touchstart' )
						.on( 'click touchstart', function( e ) {
							// Prevent double firing on some devices.
							if ( e.type === 'touchstart' ) {
								e.preventDefault();
							}
							openVideoModal( videoId );
						} );
				} );
			},
		);
	}

	/**
	 * Opens the video modal for a given video ID.
	 *
	 * @param {number} videoId
	 */
	async function openVideoModal( videoId ) {
		const singlePageProductModal = document.querySelector( '.rtgodam-product-video-gallery-slider-modal.open' );

		singlePageProductModal?.classList.add( 'hidden' );

		let modal = document.getElementById( 'godam-woocommerce-featured-video-modal-container' );

		if ( ! modal ) {
			modal = document.createElement( 'div' );
			modal.id = 'godam-woocommerce-featured-video-modal-container';
			modal.className = 'godam-woocommerce-featured-video-modal-container';
			document.body.appendChild( modal );
		}

		modal.classList.add( 'open' );
		modal.dataset.currentVideoId = videoId;
		modal.dataset.isLoading = 'false';
		modal.innerHTML = `
			<div class="godam-woocommerce-featured-video-modal-container-overlay">
				<div class="close">
					<button class="godam-woocommerce-featured-video-modal-close" aria-label="">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" style="fill: rgba(255, 255, 255, 1);transform: ;msFilter:;"><path d="m16.192 6.344-4.243 4.242-4.242-4.242-1.414 1.414L10.535 12l-4.242 4.242 1.414 1.414 4.242-4.242 4.243 4.242 1.414-1.414L13.364 12l4.242-4.242z"></path></svg>
					</button>
				</div>
				<div class="godam-woocommerce-featured-video-modal-container-content">
					<div class="godam-woocommerce-featured-video-modal-content">
					<div class="video-container animate-video-loading">
						<div class="animate-play-btn">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
								<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
							</svg>
						</div>
					</div>
					</div>
				</div>
		`;

		modal.classList.remove( 'hidden' );
		document.body.style.overflow = 'hidden';

		modal.querySelector( '.godam-woocommerce-featured-video-modal-container-close' )?.addEventListener( 'click', closeModal );
		modal.addEventListener( 'click', ( e ) => {
			if ( ! e.target.closest( '.godam-woocommerce-featured-video-modal-container-content' ) ) {
				closeModal();
			}
		} );
		// Escape key
		document.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Escape' || e.key === 'Esc' ) {
				closeModal();
			}
		} );

		await loadVideoById( videoId );
	}

	/**
	 * Loads the video by ID via REST API and updates modal content.
	 *
	 * @param {number} videoId
	 */
	async function loadVideoById( videoId ) {
		const modal = document.getElementById( 'godam-woocommerce-featured-video-modal-container' );
		const container = modal?.querySelector( '.video-container' );
		if ( ! modal || ! container || modal.dataset.isLoading === 'true' ) {
			return;
		}

		modal.dataset.isLoading = 'true';

		container.innerHTML = `
			<div class="animate-video-loading">
				<div class="animate-play-btn">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
						class="bi bi-play-fill" viewBox="0 0 16 16">
						<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308
						c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
					</svg>
				</div>
			</div>
		`;

		try {
			const restURL = window.godamRestRoute.url || '';
			const res = await fetch( `${ restURL }godam/v1/video-shortcode?id=${ videoId }` );
			const data = await res.json();

			if ( data.status === 'success' && data.html ) {
				let html = data.html;

				html = html.replace( /data-options="([^"]+)"/, ( match, encoded ) => {
					try {
						const decoded = encoded.replace( /&quot;/g, '"' );
						const options = JSON.parse( decoded );
						options.aspectRatio = 'responsive';
						const reEncoded = JSON.stringify( options ).replace( /"/g, '&quot;' );
						return `data-options="${ reEncoded }"`;
					} catch {
						return match;
					}
				} );

				html = html.replace( /--rtgodam-video-aspect-ratio:\s*[^;"]+/, '--rtgodam-video-aspect-ratio: responsive' );

				container.innerHTML = html;
				container.classList.remove( 'animate-video-loading' );

				if ( typeof GODAMPlayer === 'function' ) {
					GODAMPlayer( modal );

					const videoPlayerElement = modal.querySelector( '.video-js' );
					const videojs = window.videojs;

					if ( videojs ) {
						// Check if player is already ready (fallback for synchronous initialization)
						const existingPlayer = videoPlayerElement ? videojs.getPlayer( videoPlayerElement ) : null;
						if ( existingPlayer ) {
							existingPlayer.play();
						} else {
							const onPlayerReady = ( event ) => {
								// Ensure this event is for our video element
								if ( event.detail.videoElement === videoPlayerElement ) {
									event.detail.player.play();
									document.removeEventListener( 'godamPlayerReady', onPlayerReady );
									modal._galleryPlayerReadyHandler = null;
								}
							};
							modal._galleryPlayerReadyHandler = onPlayerReady;
							document.addEventListener( 'godamPlayerReady', onPlayerReady );
						}
					} else {
						// eslint-disable-next-line no-console
						console.error( 'Video.js is not loaded. Cannot initialize player.' );
					}
				}
			} else {
				container.innerHTML = '<div class="godam-error-message">Video could not be loaded.</div>';
			}
		} catch ( err ) {
			console.error( err );
			container.innerHTML = '<div class="godam-error-message">Error loading video.</div>';
		} finally {
			modal.dataset.isLoading = 'false';
		}
	}

	/**
	 * Closes and resets the video modal.
	 */
	function closeModal() {
		const modal = document.getElementById( 'godam-woocommerce-featured-video-modal-container' );
		if ( ! modal ) {
			return;
		}

		modal.querySelectorAll( '.video-js' ).forEach( ( player ) => player.player?.dispose?.() );
		modal.classList.add( 'hidden' );
		document.body.style.overflow = '';

		const singlePageProductModal = document.querySelector( '.rtgodam-product-video-gallery-slider-modal.open.hidden' );
		singlePageProductModal?.classList.remove( 'hidden' );
	}

	/**
	 * Observes gallery and runs handler when images are loaded.
	 */
	const targetNode = document.querySelector( '.woocommerce-product-gallery' );
	if ( targetNode ) {
		const observer = new MutationObserver( function( _, obs ) {
			if ( $( targetNode ).find( 'ol.flex-control-thumbs li img' ).length > 0 ) {
				obs.disconnect();
				handleGalleryImages();
			}
		} );

		observer.observe( targetNode, { childList: true, subtree: true } );

		// Optional immediate execution if already present.
		if ( $( targetNode ).find( 'ol.flex-control-thumbs li img' ).length > 0 ) {
			handleGalleryImages();
		}
	}

	$( 'body' ).on( 'wc-product-gallery-before-init', function() {
		handleGalleryImages();
	} );
} );
