( function( $ ) {
	'use strict';

	// Initialize image source selector on document ready and when WPBakery reloads the params
	$( document ).ready( initImageSrcSelector );
	$( document ).on( 'vc.reload', initImageSrcSelector );

	function initImageSrcSelector() {
		$( '.image-src-selector-button' ).off( 'click' ).on( 'click', function( e ) {
			e.preventDefault();

			const $button = $( this );
			const paramName = $button.data( 'param' );
			const $container = $button.closest( '.image_src_selector_block' );
			const $input = $container.find( '.image_src_selector_field' );

			// Create WordPress media frame
			const frame = wp.media( {
				title: 'Select or Upload Image',
				button: {
					text: 'Select Image',
				},
				library: {
					type: 'image',
				},
				multiple: false,
			} );

			// When a image is selected
			frame.on( 'select', function() {
				const attachment = frame.state().get( 'selection' ).first().toJSON();

				// Update the hidden input value
				$input.val( attachment.url ).trigger( 'change' );

				// Update button text
				$button.text( 'Replace' );

				// Add or update preview
				let $preview = $container.find( '.image-src-selector-preview' );
				if ( $preview.length === 0 ) {
					$preview = $( '<div class="image-src-selector-preview" style="margin-top: 10px;"></div>' );
					$container.append( $preview );
				}

				$preview.html(
					'<img src="' + attachment.url + '" alt="" style="max-width: 300px; object-fit: contain; height: auto;" />',
				);

				// Add or update remove button in the buttons wrapper
				const $buttonsWrapper = $container.find( '.image_src_selector-buttons-wrapper' );
				let $removeButton = $buttonsWrapper.find( '.image-src-selector-remove' );
				if ( $removeButton.length === 0 ) {
					$removeButton = $( '<button class="button image-src-selector-remove" data-param="' + paramName + '" style="margin-left: 5px;">Remove</button>' );
					$buttonsWrapper.append( $removeButton );
				}

				// Re-attach remove handler
				initRemoveHandler();
			} );

			// Open the media frame
			frame.open();
		} );

		// Initialize remove handler
		initRemoveHandler();
	}

	function initRemoveHandler() {
		$( '.image-src-selector-remove' ).off( 'click' ).on( 'click', function( e ) {
			e.preventDefault();

			const $button = $( this );
			const $container = $button.closest( '.image_src_selector_block' );
			const $input = $container.find( '.image_src_selector_field' );
			const $selectButton = $container.find( '.image-src-selector-button' );

			// Clear the input value
			$input.val( '' ).trigger( 'change' );

			// Remove preview
			$container.find( '.image-src-selector-preview' ).remove();

			// Remove the remove button itself
			$button.remove();

			// Update button text
			$selectButton.text( 'Select image' );
		} );
	}
}( window.jQuery ) );
