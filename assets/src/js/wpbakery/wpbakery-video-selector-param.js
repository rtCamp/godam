/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

( function( $ ) {
	'use strict';

	let isVirtualAttachmentListenerBound = false;

	// Initialize video selector on document ready and when WPBakery reloads the params
	$( document ).ready( initVideoSelector );
	$( document ).on( 'vc.reload', initVideoSelector );

	function initVideoSelector() {
		bindVirtualAttachmentReplacement();

		$( '.video-selector-button' ).off( 'click' ).on( 'click', function( e ) {
			e.preventDefault();

			const $button = $( this );
			const paramName = $button.data( 'param' );
			const $container = $button.closest( '.video_selector_block' );
			const $input = $container.find( '.video_selector_field' );

			// Create WordPress media frame
			const frame = wp.media( {
				title: 'Select or Upload Video',
				button: {
					text: 'Select Video',
				},
				library: {
					type: 'video',
				},
				multiple: false,
			} );

			// When a video is selected
			frame.on( 'select', function() {
				const attachment = frame.state().get( 'selection' ).first().toJSON();

				// Update the hidden input value
				$input.val( attachment.id ).trigger( 'change' );

				// Update button text
				$button.text( __( 'Replace', 'godam' ) );

				// Add or update preview
				let $preview = $container.find( '.video-selector-preview' );
				if ( $preview.length === 0 ) {
					$preview = $( '<div class="video-selector-preview" style="margin-top: 10px;"></div>' );
					$container.append( $preview );
				}

				$preview.html(
					'<video width="100%" height="auto" controls style="max-width: 300px;">' +
					'<source src="' + attachment.url + '" type="' + attachment.mime + '">' +
					'</video>',
				);

				// Add or update remove button in the buttons wrapper
				const $buttonsWrapper = $container.find( '.video_selector-buttons-wrapper' );
				let $removeButton = $buttonsWrapper.find( '.video-selector-remove' );
				if ( $removeButton.length === 0 ) {
					$removeButton = $( '<button class="button video-selector-remove" data-param="' + paramName + '" style="margin-left: 5px;">Remove</button>' );
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

	/**
	 * Replace temporary virtual media IDs with actual attachment IDs
	 * once media entry creation is completed.
	 */
	function bindVirtualAttachmentReplacement() {
		if ( isVirtualAttachmentListenerBound ) {
			return;
		}

		document.addEventListener( 'godam-virtual-attachment-created', function( event ) {
			const { attachment, virtualMediaId } = event?.detail || {};

			if ( ! attachment?.id || ! virtualMediaId ) {
				return;
			}

			$( '.video_selector_field' ).each( function() {
				const $input = $( this );
				const currentValue = $input.val();

				if ( String( currentValue ) !== String( virtualMediaId ) ) {
					return;
				}

				const $container = $input.closest( '.video_selector_block' );
				const $selectButton = $container.find( '.video-selector-button' );
				const $buttonsWrapper = $container.find( '.video_selector-buttons-wrapper' );
				const mimeType = attachment.mime || attachment.post_mime_type || 'video/mp4';

				$input.val( attachment.id ).trigger( 'change' );
				$selectButton.text( 'Replace' );

				let $preview = $container.find( '.video-selector-preview' );
				if ( $preview.length === 0 ) {
					$preview = $( '<div class="video-selector-preview" style="margin-top: 10px;"></div>' );
					$container.append( $preview );
				}

				if ( attachment.url ) {
					$preview.html(
						'<video width="100%" height="auto" controls style="max-width: 300px;">' +
						'<source src="' + attachment.url + '" type="' + mimeType + '">' +
						'</video>',
					);
				}

				let $removeButton = $buttonsWrapper.find( '.video-selector-remove' );
				if ( $removeButton.length === 0 ) {
					$removeButton = $( `<button class="button video-selector-remove" style="margin-left: 5px;">${ __( 'Remove', 'godam' ) }</button>` );
					$buttonsWrapper.append( $removeButton );
					initRemoveHandler();
				}
			} );
		} );

		isVirtualAttachmentListenerBound = true;
	}

	function initRemoveHandler() {
		$( '.video-selector-remove' ).off( 'click' ).on( 'click', function( e ) {
			e.preventDefault();

			const $button = $( this );
			const $container = $button.closest( '.video_selector_block' );
			const $input = $container.find( '.video_selector_field' );
			const $selectButton = $container.find( '.video-selector-button' );

			// Clear the input value
			$input.val( '' ).trigger( 'change' );

			// Remove preview
			$container.find( '.video-selector-preview' ).remove();

			// Remove the remove button itself
			$button.remove();

			// Update button text
			$selectButton.text( 'Select video' );
		} );
	}
}( window.jQuery ) );
