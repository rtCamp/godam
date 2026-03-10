/* global jQuery, myGalleryAjaxData */

// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-console */

/**
 * Internal dependencies
 */
import { resetVideoModal, loadNewVideo } from '../global-video-popup/video-modal.js';
import { initEscapeManager, registerEscapeHandler, unregisterEscapeHandler } from '../global-video-popup/escapeManager.js';

jQuery( document ).ready( function( $ ) {
	const emptySrcAlts = [];
	const emptyImgs = [];

	initEscapeManager();

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
						.closest( 'li' )
						.addClass( 'godam-video-gallery-element' )
						.end()
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

		const modal = document.querySelector(
			'.godam-woocommerce-featured-video-modal-container',
		);

		modal.classList.add( 'open' );
		modal.dataset.currentVideoId = videoId;
		modal.dataset.isLoading = 'false';

		modal.classList.remove( 'hidden' );

		modal.querySelector( '.godam-woocommerce-featured-video-modal-container-close' )?.addEventListener( 'click', closeModal );
		modal.addEventListener( 'click', ( e ) => {
			if ( ! e.target.closest( '.godam-woocommerce-featured-video-modal-content' ) ) {
				closeModal();
			}
		} );
		// Escape key.
		const handleEscapeClose = () => {
			closeModal();
			unregisterEscapeHandler( handleEscapeClose );
		};

		modal._escapeHandler = handleEscapeClose;

		registerEscapeHandler( handleEscapeClose );

		await loadNewVideo( videoId, modal, false, 'godam-featured-video-gallery', false );
	}

	/**
	 * Closes and resets the video modal.
	 */
	function closeModal() {
		const modal = document.querySelector(
			'.godam-woocommerce-featured-video-modal-container.open',
		);
		if ( ! modal ) {
			return;
		}

		if ( modal._escapeHandler ) {
			unregisterEscapeHandler( modal._escapeHandler );
			modal._escapeHandler = null;
		}

		resetVideoModal( modal );

		const singlePageProductModal = document.querySelector( '.rtgodam-product-video-gallery-slider-modal.open.hidden' );
		singlePageProductModal?.classList.remove( 'hidden' );
	}

	/**
	 * Remove video tiles if API key invalid
	 */
	function removeFrontendVideosIfNeeded() {
		if ( myGalleryAjaxData?.hasValidApiKey ) {
			return;
		}

		// Remove thumbnails.
		$( '.woocommerce-product-gallery ol.flex-control-thumbs li' ).each( function() {
			const $li = $( this );
			const $img = $li.find( 'img' );

			if ( $img.hasClass( 'godam-video-thumbnail' ) || $img.attr( 'data-video-id' ) ) {
				$li.remove();
			}
		} );

		// Remove main slides.
		$( '.woocommerce-product-gallery__wrapper .woocommerce-product-gallery__image' ).each( function() {
			const $slide = $( this );

			if (
				$slide.find( 'img' ).length === 0 ||
			$slide.find( '[data-video-id]' ).length
			) {
				$slide.remove();
			}
		} );
	}

	/**
	 * Observes gallery and runs handler when images are loaded.
	 */
	const targetNode = document.querySelector( '.woocommerce-product-gallery' );
	if ( targetNode ) {
		const observer = new MutationObserver( function( _, obs ) {
			if ( $( targetNode ).find( 'ol.flex-control-thumbs li img' ).length > 0 ) {
				obs.disconnect();
				removeFrontendVideosIfNeeded();
				handleGalleryImages();
			}
		} );

		observer.observe( targetNode, { childList: true, subtree: true } );

		// Optional immediate execution if already present.
		if ( $( targetNode ).find( 'ol.flex-control-thumbs li img' ).length > 0 ) {
			removeFrontendVideosIfNeeded();
			handleGalleryImages();
		}
	}

	$( 'body' ).on( 'wc-product-gallery-before-init', function() {
		removeFrontendVideosIfNeeded();
		handleGalleryImages();
	} );
} );
