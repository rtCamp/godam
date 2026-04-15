/* global jQuery, myGalleryAjaxData */

/**
 * External dependencies
 */
import DOMPurify from 'isomorphic-dompurify';

/**
 * WooCommerce Product Gallery Video Enhancements (GoDAM Integration)
 *
 * Extends the default WooCommerce product gallery to support video playback
 * alongside images. This script identifies video thumbnails, synchronizes
 * playback with the active gallery slide, and conditionally removes video
 * elements based on API availability.
 *
 * Key responsibilities:
 * - Detects video thumbnails using a custom `alt` format (`video|{id}|...`).
 * - Adds helper classes and data attributes to video thumbnails for identification.
 * - Controls video playback:
 *    - Pauses all videos when switching slides.
 *    - Plays video only on the active gallery slide.
 * - Syncs playback state with WooCommerce Flexslider events.
 * - Observes DOM mutations to initialize gallery behavior when content loads dynamically.
 * - Removes video elements (thumbnails + slides) when API key is invalid.
 * - Hooks into WooCommerce gallery lifecycle events (`wc-product-gallery-before-init`).
 *
 * Functions:
 * - toggleGalleryVideoPlayback($activeSlide)
 *      Pauses all videos and plays the video in the active slide (if applicable).
 *
 * - syncActiveGalleryVideo()
 *      Finds the current active slide and ensures correct playback state.
 *
 * - handleGalleryImages()
 *      Processes thumbnail images, identifies video entries, and adds required
 *      classes and data attributes for frontend handling.
 *
 * - removeFrontendVideosIfNeeded()
 *      Removes all video-related elements from the gallery when API access is unavailable.
 *
 * Behavior notes:
 * - Uses MutationObserver to handle dynamically rendered WooCommerce galleries.
 * - Ensures compatibility with WooCommerce Flexslider structure.
 * - Prevents autoplay conflicts by allowing only one active video at a time.
 *
 * Dependencies:
 * - jQuery
 * - WooCommerce product gallery (Flexslider)
 * - Global config object: `myGalleryAjaxData`
 */
jQuery( document ).ready( function( $ ) {
	function toggleGalleryVideoPlayback( $activeSlide ) {
		const $gallery = $activeSlide.closest( '.woocommerce-product-gallery' );

		if ( ! $gallery.length ) {
			return;
		}

		$gallery.find( '.woocommerce-product-gallery__image video' ).each( function() {
			this.pause();
		} );

		if ( ! $activeSlide.length || ! $activeSlide.is( '.godam-product-gallery-video' ) ) {
			return;
		}

		const videoElement = $activeSlide.find( '.godam-featured-video-wrapper video' ).get( 0 );

		if ( videoElement ) {
			const playPromise = videoElement.play();

			if ( playPromise && typeof playPromise.catch === 'function' ) {
				playPromise.catch( () => {} );
			}
		}
	}

	function syncActiveGalleryVideo() {
		const $activeSlide = $( '.woocommerce-product-gallery .flex-active-slide' ).first();

		if ( $activeSlide.length ) {
			toggleGalleryVideoPlayback( $activeSlide );
		}
	}

	/**
	 * Process and identify thumbnails and add class and data attributes for videos.
	 */
	function handleGalleryImages() {
		// Thumbnail gallery.
		const $imgs = $( '.woocommerce-product-gallery' ).find( 'ol.flex-control-thumbs li img' );

		if ( $imgs.length === 0 ) {
			return;
		}

		$imgs.each( function() {
			const $img = $( this );
			const alt = $img.attr( 'alt' ) || '';

			if ( alt.startsWith( 'video|' ) ) {
				$img.addClass( 'godam-video-thumbnail' );
				$img.closest( 'li' ).addClass( 'godam-video-gallery-element' );

				const videoId = alt.split( '|' )[ 1 ];
				$img.attr( 'data-video-id', videoId );
			}
		} );
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
			const alt = $img.attr( 'alt' ) || '';

			if ( alt.startsWith( 'video|' ) ) {
				$li.remove();
			}
		} );

		// Remove main slides.
		$( '.woocommerce-product-gallery__wrapper .woocommerce-product-gallery__image' ).each( function() {
			const $slide = $( this );

			const hasVideo = $slide.find( '[data-video-id]' ).length ||
			$slide.find( 'video' ).length ||
			$slide.hasClass( 'godam-product-gallery-video' );

			if ( hasVideo ) {
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

	$( document ).on( 'click', '.woocommerce-product-gallery .flex-control-thumbs li', function() {
		const $thumb = $( this );
		const thumbIndex = $thumb.index();

		setTimeout( function() {
			const $slides = $( '.woocommerce-product-gallery .woocommerce-product-gallery__image' );
			const $targetSlide = $slides.eq( thumbIndex );

			if ( $targetSlide.length ) {
				toggleGalleryVideoPlayback( $targetSlide );
			} else {
				syncActiveGalleryVideo();
			}
		}, 120 );
	} );

	$( window ).on( 'load', function() {
		setTimeout( syncActiveGalleryVideo, 200 );
	} );
} );

/**
 * Patches the WooCommerce product gallery to support video items in PhotoSwipe (lightbox).
 *
 * This function overrides the default `getGalleryItems()` method of the WooCommerce
 * gallery instance to include video entries alongside images when opening the gallery
 * lightbox.
 *
 * Key responsibilities:
 * - Waits for the WooCommerce gallery instance (`product_gallery`) to be initialized.
 * - Prevents multiple patches using an internal `_godam_patched` flag.
 * - Overrides `getGalleryItems()` to customize the data passed to PhotoSwipe.
 *
 * Custom behavior:
 * - For elements with `data-video-id`:
 *    - Injects a custom HTML slide containing an iframe (GoDAM video player).
 *    - Sanitizes the video URL using DOMPurify for security.
 *
 * - For standard image elements:
 *    - Preserves default behavior by returning image metadata
 *      (`src`, `width`, `height`, `title`) for PhotoSwipe.
 *
 * Implementation details:
 * - Uses polling (`setTimeout`) to wait until the gallery instance is available.
 * - Iterates over all gallery items (`this.$images`) to build a unified list
 *   of image and video slides.
 * - Ensures compatibility with WooCommerce's native lightbox system.
 *
 * Dependencies:
 * - jQuery
 * - WooCommerce product gallery (`product_gallery` instance)
 * - DOMPurify (for sanitizing iframe URLs)
 *
 * Notes:
 * - Video slides are rendered using `<iframe>` inside PhotoSwipe instead of `<img>`.
 * - This approach enables seamless mixing of images and videos in the lightbox view.
 */
jQuery( function( $ ) {
	function patchGallery() {
		const $gallery = $( '.woocommerce-product-gallery' );

		if ( ! $gallery.length ) {
			return;
		}

		const gallery = $gallery.data( 'product_gallery' );

		if ( ! gallery ) {
			setTimeout( patchGallery, 200 );
			return;
		}

		// Prevent double patch
		if ( gallery._godam_patched ) {
			return;
		}
		gallery._godam_patched = true;

		const original = gallery.getGalleryItems;

		gallery.getGalleryItems = function() {
			const items = [];

			this.$images.each( function( i, el ) {
				const $el = $( el );
				const videoId = $el.attr( 'data-video-id' );
				const videoUrl = $el.attr( 'data-video-url' );

				// ✅ VIDEO
				if ( videoId ) {
					items.push( {
						html: `
							<div class="pswp__video-wrapper">
								<iframe
									src="${ DOMPurify.sanitize( videoUrl ) }"
									title="Godam Video Player"
									frameborder="0"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
									allowfullscreen
								></iframe>
							</div>
						`,
					} );
					return;
				}

				const $img = $el.find( 'img' );

				// ✅ IMAGE
				if ( $img.length ) {
					items.push( {
						src: $img.attr( 'data-large_image' ),
						w: $img.attr( 'data-large_image_width' ),
						h: $img.attr( 'data-large_image_height' ),
						title: $img.attr( 'title' ),
					} );
				}
			} );

			return items;
		};
	}

	patchGallery();
} );
