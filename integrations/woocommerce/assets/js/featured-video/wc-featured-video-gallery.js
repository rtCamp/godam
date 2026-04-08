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

				$img.closest( 'li' ).addClass( 'godam-thumb-loading' );
				$img.css( 'visibility', 'hidden' );
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

					const videoUrl = response.data.videoUrls[ index ];

					const $video = $( '<video>', {
						src: videoUrl,
						controls: false,
						preload: 'metadata',
						style: 'width:100%; height:auto;',
					} );

					$video.prop( 'muted', true );
					$video.prop( 'autoplay', true );
					$video.prop( 'loop', true );

					$div.html( '' ).append( $video );

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
							e.preventDefault();
						} );
					$img.css( 'visibility', 'visible' );
					$img.closest( 'li' ).removeClass( 'godam-thumb-loading' );
				} );
			},
		);
	}

	/**
	 * Remove video tiles if API key invalid
	 */
	function removeFrontendVideosIfNeeded() {
		if ( myGalleryAjaxData?.hasValidAPIKey ) {
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
				if ( myGalleryAjaxData?.hasValidAPIKey ) {
					handleGalleryImages();
				} else {
					removeFrontendVideosIfNeeded();
				}
			}
		} );

		observer.observe( targetNode, { childList: true, subtree: true } );

		// Optional immediate execution if already present.
		if ( $( targetNode ).find( 'ol.flex-control-thumbs li img' ).length > 0 ) {
			if ( myGalleryAjaxData?.hasValidAPIKey ) {
				handleGalleryImages();
			} else {
				removeFrontendVideosIfNeeded();
			}
		}
	}

	$( 'body' ).on( 'wc-product-gallery-before-init', function() {
		if ( myGalleryAjaxData?.hasValidAPIKey ) {
			handleGalleryImages();
		} else {
			removeFrontendVideosIfNeeded();
		}
	} );
} );
