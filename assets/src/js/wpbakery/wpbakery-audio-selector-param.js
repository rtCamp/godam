( function( $ ) {
	'use strict';

	// Initialize audio selector on document ready and when WPBakery reloads the params
	$( document ).ready( initAudioSelector );
	$( document ).on( 'vc.reload', initAudioSelector );

	function initAudioSelector() {
		$( '.audio-selector-button' ).off( 'click' ).on( 'click', function( e ) {
			e.preventDefault();

			const $button = $( this );
			const $attributeContainer = $button.closest( '.wpb_el_type_audio_selector' ).parent();
			const paramName = $button.data( 'param' );
			const $container = $button.closest( '.audio_selector_block' );
			const $input = $container.find( '.audio_selector_field' );
			const $srcInput = $attributeContainer.find( '.textfield_hidden_field' );

			// Create WordPress media frame
			const frame = wp.media( {
				title: 'Select or Upload Audio',
				button: {
					text: 'Select Audio',
				},
				library: {
					type: 'audio',
				},
				multiple: false,
			} );

			// When an audio is selected
			frame.on( 'select', function() {
				const attachment = frame.state().get( 'selection' ).first().toJSON();

				// Update the hidden input value
				$input.val( attachment.id ).trigger( 'change' );
				$srcInput.val( attachment.url ).trigger( 'change' );

				// Update button text
				$button.text( 'Replace' );

				// Add or update preview
				let $preview = $container.find( '.audio-selector-preview' );
				if ( $preview.length === 0 ) {
					$preview = $( '<div class="audio-selector-preview" style="margin-top: 10px;"></div>' );
					$container.append( $preview );
				}

				$preview.html(
					'<audio controls style="max-width: 300px;">' +
					'<source src="' + attachment.url + '" type="' + attachment.mime + '">' +
					'</audio>',
				);

				// Add or update remove button in the buttons wrapper
				const $buttonsWrapper = $container.find( '.audio_selector-buttons-wrapper' );
				let $removeButton = $buttonsWrapper.find( '.audio-selector-remove' );
				if ( $removeButton.length === 0 ) {
					$removeButton = $( '<button class="button audio-selector-remove" data-param="' + paramName + '" style="margin-left: 5px;">Remove</button>' );
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
		$( '.audio-selector-remove' ).off( 'click' ).on( 'click', function( e ) {
			e.preventDefault();

			const $button = $( this );
			const $attributeConatienr = $button.closest( '.wpb_el_type_audio_selector' ).parent();
			const $container = $button.closest( '.audio_selector_block' );
			const $input = $container.find( '.audio_selector_field' );
			const $selectButton = $container.find( '.audio-selector-button' );
			const $srcInput = $attributeConatienr.find( '.textfield_hidden_field' );

			// Clear the input value
			$input.val( '' ).trigger( 'change' );
			$srcInput.val( '' ).trigger( 'change' );

			// Remove preview
			$container.find( '.audio-selector-preview' ).remove();

			// Remove the remove button itself
			$button.remove();

			// Update button text
			$selectButton.text( 'Select audio' );
		} );
	}
}( window.jQuery ) );
