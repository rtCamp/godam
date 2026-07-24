( function( $ ) {
	'use strict';

	// Use WordPress i18n when available so the WPBakery param UI is translatable
	// like the PHP-rendered labels; fall back to identity if wp.i18n is absent.
	const { __ } = ( window.wp && window.wp.i18n ) ? window.wp.i18n : { __: ( s ) => s };

	// Initialize image selector on document ready and when WPBakery reloads the params.
	$( document ).ready( initImageSelector );
	$( document ).on( 'vc.reload', initImageSelector );

	function initImageSelector() {
		$( '.image-selector-button' ).off( 'click' ).on( 'click', function( e ) {
			e.preventDefault();

			const $button = $( this );
			const $attributeContainer = $button.closest( '.wpb_el_type_image_selector' ).parent();
			const paramName = $button.data( 'param' );
			const $container = $button.closest( '.image_selector_block' );
			const $input = $container.find( '.image_selector_field' );
			// Sibling hidden `url` param filled from the attachment; the GoDAM Image
			// block's render.php falls back to the attachment (URL / alt / size) for
			// anything empty, so alt is not exposed as a param.
			const $urlInput = $attributeContainer.find( '[name="url"]' );

			// Create WordPress media frame, restricted to images.
			const frame = wp.media( {
				title: __( 'Select or Upload Image', 'godam' ),
				button: {
					text: __( 'Select image', 'godam' ),
				},
				library: {
					type: 'image',
				},
				multiple: false,
			} );

			// When an image is selected.
			frame.on( 'select', function() {
				const attachment = frame.state().get( 'selection' ).first().toJSON();

				// Store the attachment ID (layers are keyed off it) + source URL.
				$input.val( attachment.id ).trigger( 'change' );
				if ( $urlInput.length ) {
					$urlInput.val( attachment.url || '' ).trigger( 'change' );
				}

				// Update button text.
				$button.text( __( 'Replace', 'godam' ) );

				// Add or update preview.
				let $preview = $container.find( '.image-selector-preview' );
				if ( $preview.length === 0 ) {
					$preview = $( '<div class="image-selector-preview" data-test-id="godam-wpb-preview-image-block" style="margin-top: 10px;"></div>' );
					$container.append( $preview );
				}
				$preview.empty().append(
					$( '<img alt="" style="max-width: 300px; height: auto;" />' ).attr( 'src', attachment.url || '' ),
				);

				// Add or update remove button in the buttons wrapper.
				const $buttonsWrapper = $container.find( '.image_selector-buttons-wrapper' );
				let $removeButton = $buttonsWrapper.find( '.image-selector-remove' );
				if ( $removeButton.length === 0 ) {
					$removeButton = $( '<button type="button" class="button image-selector-remove" data-test-id="godam-wpb-button-remove-image-block" style="margin-left: 5px;"></button>' )
						.attr( 'data-param', paramName )
						.text( __( 'Remove', 'godam' ) );
					$buttonsWrapper.append( $removeButton );
				}

				// Re-attach remove handler.
				initRemoveHandler();
			} );

			// Open the media frame.
			frame.open();
		} );

		// Initialize remove handler.
		initRemoveHandler();
	}

	function initRemoveHandler() {
		$( '.image-selector-remove' ).off( 'click' ).on( 'click', function( e ) {
			e.preventDefault();

			const $button = $( this );
			const $attributeContainer = $button.closest( '.wpb_el_type_image_selector' ).parent();
			const $container = $button.closest( '.image_selector_block' );
			const $input = $container.find( '.image_selector_field' );
			const $selectButton = $container.find( '.image-selector-button' );
			const $urlInput = $attributeContainer.find( '[name="url"]' );

			// Clear the values.
			$input.val( '' ).trigger( 'change' );
			if ( $urlInput.length ) {
				$urlInput.val( '' ).trigger( 'change' );
			}

			// Remove preview.
			$container.find( '.image-selector-preview' ).remove();

			// Remove the remove button itself.
			$button.remove();

			// Update button text.
			$selectButton.text( __( 'Select image', 'godam' ) );
		} );
	}
}( window.jQuery ) );
