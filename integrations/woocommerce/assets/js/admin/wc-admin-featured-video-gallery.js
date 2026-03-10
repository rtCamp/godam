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
				const selection = frame.state().get( 'selection' ).toJSON();

				let hasVideo = false;

				const filteredFiles = selection.filter( function( file ) {
					if ( file.type === 'video' && ! rtGodamSettings?.hasValidApiKey ) {
						hasVideo = true;
						return false;
					}
					return true;
				} );

				filteredFiles.forEach( function( file ) {
					if ( ! file.id || ! rtGodamSettings?.ajaxurl || ! rtGodamSettings?.nonce ) {
						console.error( 'Missing required data for AJAX request.' );
						return;
					}

					$.post( rtGodamSettings.ajaxurl, {
						action: 'get_wc_gallery_thumbnail',
						attachment_id: file.id,
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

				if ( hasVideo ) {
					showGodamProNotice();
				}
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

	function showGodamProNotice() {
		const $metaBox = $( '#woocommerce-product-images' );
		const $inside = $metaBox.find( '.inside' );

		if ( ! $inside.length ) {
			return;
		}

		if ( $inside.find( '.godam-pro-video-notice' ).length ) {
			return;
		}

		const videoEditorSettingsUrl = `${ rtGodamSettings?.adminUrl || '' }admin.php?page=rtgodam_settings#video-settings`;

		const pricingUrl = `${ rtGodamSettings?.pricingUrl || '' }`;

		const notice = $( `
			<div class="notice notice-warning is-dismissible godam-pro-video-notice godam-featured-video-gallery-notice">
				<p>
					<strong>${ __( 'Product Gallery videos is a Pro feature.', 'godam' ) }</strong>
					<a href="${ videoEditorSettingsUrl }" target="_blank" rel="noopener noreferrer" class="text-[#AB3A6C] godam-notice-link no-underline">
						${ __( 'Activate your license', 'godam' ) }
					</a>
					${ __( 'or', 'godam' ) }
					<a href="${ pricingUrl }" target="_blank" rel="noopener noreferrer" class="text-[#AB3A6C] godam-notice-link">
						${ __( 'get started for free↗', 'godam' ) }
					</a>
					${ __( 'to unlock all features.', 'godam' ) }
				</p>
			</div>
		` );

		$inside.prepend( notice );
	}

	/**
	 * Lock behavior for videos
	 */
	if ( ! rtGodamSettings?.hasValidApiKey ) {
		const lockedVideos = $( '#product_images_container li.image' ).filter( function() {
			const $li = $( this );

			if ( $li.attr( 'data-is-video' ) ) {
				return true;
			}

			return false;
		} );

		if ( lockedVideos.length ) {
			showGodamProNotice();

			lockedVideos.each( function() {
				const $li = $( this );

				$li.on( 'click', function( e ) {
					e.preventDefault();
					e.stopPropagation();
					showGodamProNotice();
				} );

				$li.css( 'pointer-events', 'auto' );
			} );
		}
	}
}( jQuery ) );
