/**
 * Internal dependencies
 */
import { ALLOWED_MEDIA_TYPES } from '../../blocks/godam-pdf/constants.js';

( function( $ ) {
	'use strict';

	// Use WordPress i18n when available so user-facing strings are translatable;
	// fall back to identity if wp.i18n is not loaded in the current context.
	const { __ } = ( window.wp && window.wp.i18n ) ? window.wp.i18n : { __: ( s ) => s };

	// Initialize document selector on document ready and when WPBakery reloads the params
	$( document ).ready( initDocumentSelector );
	$( document ).on( 'vc.reload', initDocumentSelector );

	function initDocumentSelector() {
		$( '.document-selector-button' ).off( 'click' ).on( 'click', function( e ) {
			e.preventDefault();

			const $button = $( this );
			const $attributeContainer = $button.closest( '.wpb_el_type_document_selector' ).parent();
			const paramName = $button.data( 'param' );
			const $container = $button.closest( '.document_selector_block' );
			const $input = $container.find( '.document_selector_field' );
			// Target the `src` hidden param specifically — a bare
			// `.textfield_hidden_field` match could update another hidden field
			// if the element ever gains more of them.
			const $srcInput = $attributeContainer.find( '.textfield_hidden_field[name="src"]' );
			// Sibling param fields to auto-populate from the attachment, mirroring
			// the Gutenberg block's onSelectPdf (Doc Title + Description).
			const $docTitleInput = $attributeContainer.find( '[name="doc_title"]' );
			const $descriptionInput = $attributeContainer.find( '[name="description"]' );

			// Create WordPress media frame, restricted to the formats the block can display.
			const frame = wp.media( {
				title: __( 'Select or Upload Document', 'godam' ),
				button: {
					text: __( 'Select Document', 'godam' ),
				},
				library: {
					type: ALLOWED_MEDIA_TYPES,
				},
				multiple: false,
			} );

			// When a document is selected
			frame.on( 'select', function() {
				const attachment = frame.state().get( 'selection' ).first().toJSON();

				// Update the hidden input values
				$input.val( attachment.id ).trigger( 'change' );
				$srcInput.val( attachment.url ).trigger( 'change' );

				// Auto-populate Doc Title and Description from the attachment, matching
				// the block. The media library exposes `description` as a plain string.
				if ( $docTitleInput.length ) {
					$docTitleInput.val( attachment.title || '' ).trigger( 'change' );
				}
				if ( $descriptionInput.length ) {
					const attachmentDescription = typeof attachment.description === 'string'
						? attachment.description
						: '';
					$descriptionInput.val( attachmentDescription ).trigger( 'change' );
				}

				// Update button text
				$button.text( __( 'Replace', 'godam' ) );

				const fileName = attachment.filename || attachment.title || __( 'Document', 'godam' );

				// Add or update preview
				let $preview = $container.find( '.document-selector-preview' );
				if ( $preview.length === 0 ) {
					$preview = $( '<div class="document-selector-preview" data-test-id="godam-wpb-preview-document" style="margin-top: 10px;"></div>' );
					$container.append( $preview );
				}

				// Build the preview via DOM + .text() so the (attachment-derived)
				// file name is never interpolated into markup — avoids XSS from a
				// crafted attachment title/filename.
				const $icon = $( '<span class="dashicons dashicons-media-document" style="vertical-align: middle;"></span>' );
				const $name = $( '<span class="document-selector-preview__name"></span>' ).text( fileName );
				$preview.empty().append( $icon, ' ', $name );

				// Add or update remove button in the buttons wrapper
				const $buttonsWrapper = $container.find( '.document_selector-buttons-wrapper' );
				let $removeButton = $buttonsWrapper.find( '.document-selector-remove' );
				if ( $removeButton.length === 0 ) {
					$removeButton = $( '<button type="button" class="button document-selector-remove" data-test-id="godam-wpb-button-remove-document" style="margin-left: 5px;"></button>' )
						.attr( 'data-param', paramName )
						.text( __( 'Remove', 'godam' ) );
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
		$( '.document-selector-remove' ).off( 'click' ).on( 'click', function( e ) {
			e.preventDefault();

			const $button = $( this );
			const $attributeContainer = $button.closest( '.wpb_el_type_document_selector' ).parent();
			const $container = $button.closest( '.document_selector_block' );
			const $input = $container.find( '.document_selector_field' );
			const $selectButton = $container.find( '.document-selector-button' );
			const $srcInput = $attributeContainer.find( '.textfield_hidden_field[name="src"]' );

			// Clear the input values
			$input.val( '' ).trigger( 'change' );
			$srcInput.val( '' ).trigger( 'change' );

			// Remove preview
			$container.find( '.document-selector-preview' ).remove();

			// Remove the remove button itself
			$button.remove();

			// Update button text
			$selectButton.text( __( 'Select document', 'godam' ) );
		} );
	}
}( window.jQuery ) );
