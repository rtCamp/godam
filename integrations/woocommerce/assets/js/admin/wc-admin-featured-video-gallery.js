/* global jQuery, rtGodamSettings */

// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-console */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

( function( $ ) {
	$( document ).ready( function() {
		const $galleryWrapper = $( '#product_images_container' );
		const $galleryList = $galleryWrapper.find( 'ul.product_images' );
		const $galleryInput = $( '#product_image_gallery' );
		const $container = document.getElementById( 'godam-featured-gallery' );

		// Remove help tip if it exists
		if ( $container ) {
			const helpTip = $container.querySelector( '.woocommerce-help-tip' );
			if ( helpTip ) {
				helpTip.remove();
			}
		}

		/**
		 * Update the hidden input field with current gallery attachment IDs.
		 */
		function updateProductGalleryInput() {
			const ids = [];
			$galleryList.find( 'li.image' ).each( function() {
				const id = $( this ).data( 'attachment_id' );
				if ( id ) {
					ids.push( id );
				}
			} );
			$galleryInput.val( ids.join( ',' ) );
		}

		const $addGalleryButton = $( '.add_product_images a' );
		$addGalleryButton.removeAttr( 'data-choose data-update data-delete data-text' );

		/**
		 * Open WordPress media frame to select images and videos.
		 */
		$addGalleryButton.on( 'click', function( e ) {
			e.preventDefault();
			e.stopImmediatePropagation();

			const frame = wp.media( {
				title: __( 'Add Images and Videos to Product Gallery', 'godam' ),
				multiple: true,
				library: {
					type: [ 'image', 'video' ],
				},
				button: {
					text: __( 'Add to Gallery', 'godam' ),
				},
			} );

			frame.on( 'select', function() {
				const selection = frame.state().get( 'selection' );

				selection.forEach( function( attachment ) {
					const data = attachment.toJSON();

					if ( ! data.id || ! rtGodamSettings?.ajaxurl || ! rtGodamSettings?.nonce ) {
						console.error( 'Missing required data for AJAX request.' );
						return;
					}

					$.post( rtGodamSettings.ajaxurl, {
						action: 'get_wc_gallery_thumbnail',
						attachment_id: data.id,
						nonce: rtGodamSettings.nonce,
					}, function( response ) {
						if ( response.success && response.data ) {
							$galleryList.append( response.data );
							updateProductGalleryInput();
						} else {
							console.error( 'Failed to append gallery thumbnail.', response );
						}
					} ).fail( function( xhr ) {
						console.error( 'AJAX failed:', xhr );
					} );
				} );
			} );

			frame.open();
		} );

		/**
		 * Handle remove button click to delete gallery item.
		 */
		$galleryList.on( 'click', '.delete', function( e ) {
			e.preventDefault();
			$( this ).closest( 'li.image' ).remove();
			updateProductGalleryInput();
		} );
	} );
}( jQuery ) );
