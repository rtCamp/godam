( function( $ ) {
	'use strict';

	// Initialize on document ready and when WPBakery reloads the params.
	$( document ).ready( initDocumentCoverSelector );
	$( document ).on( 'vc.reload', initDocumentCoverSelector );

	/**
	 * Resolve the WP REST API root. The document cover meta
	 * (rtgodam_media_video_thumbnail / rtgodam_media_pdf_thumbnail) is registered
	 * show_in_rest, so it is readable in the public "view" context — no nonce
	 * required.
	 *
	 * @return {string} REST root URL with trailing slash.
	 */
	function restRoot() {
		if ( window.wpApiSettings && window.wpApiSettings.root ) {
			return window.wpApiSettings.root;
		}
		return window.location.origin + '/wp-json/';
	}

	function initDocumentCoverSelector() {
		$( '.document_cover_selector_block' ).each( function() {
			setupBlock( $( this ) );
		} );
	}

	/**
	 * Read the selected document (attachment) ID from the sibling document
	 * selector param in the same edit form.
	 *
	 * @param {Object} $block The cover selector block element.
	 * @return {string} The attachment ID, or an empty string.
	 */
	function getDocumentId( $block ) {
		const $formContainer = $block.closest( '.wpb_el_type_document_cover_selector' ).parent();
		const $idInput = $formContainer.find( '.document_selector_field' );
		return $idInput.length ? $idInput.val() : '';
	}

	/**
	 * Fetch the attachment's auto-generated cover URL from its REST meta.
	 *
	 * @param {string}   id The attachment ID.
	 * @param {Function} cb Callback receiving the cover URL (string, may be empty).
	 */
	function fetchAutoCover( id, cb ) {
		if ( ! id ) {
			cb( '' );
			return;
		}
		fetch( restRoot() + 'wp/v2/media/' + id )
			.then( ( res ) => ( res.ok ? res.json() : null ) )
			.then( ( media ) => {
				let cover = '';
				if ( media && media.meta ) {
					// Mirror render.php: video thumbnail first, then pdf thumbnail.
					cover = media.meta.rtgodam_media_video_thumbnail ||
						media.meta.rtgodam_media_pdf_thumbnail || '';
				}
				cb( cover );
			} )
			.catch( () => cb( '' ) );
	}

	function setupBlock( $block ) {
		const $valueInput = $block.find( '.document_cover_selector_field' );
		const $tiles = $block.find( '.document-cover-tiles' );
		const $selectBtn = $block.find( '.document-cover-select' );

		let autoCover = '';

		const tileBaseStyle = 'position:relative;width:88px;height:64px;border:2px solid #dcdcde;border-radius:4px;overflow:hidden;cursor:pointer;background:#f0f0f1;display:flex;align-items:center;justify-content:center;';
		const tileSelectedStyle = 'border-color:var(--wp-admin-theme-color,#3858e9);';
		const imgStyle = 'width:100%;height:100%;object-fit:cover;';

		function tileHtml( role, imgUrl, selected, label ) {
			let inner = '';
			if ( imgUrl ) {
				inner = '<img src="' + imgUrl + '" alt="" style="' + imgStyle + '" />';
			} else {
				inner = '<span class="dashicons dashicons-media-document" style="font-size:28px;color:#8c8f94;"></span>';
			}

			let badge = '';
			if ( selected ) {
				badge = '<span class="godam-cover-tile__check" style="position:absolute;top:2px;right:2px;background:var(--wp-admin-theme-color,#3858e9);color:#fff;border-radius:50%;width:16px;height:16px;line-height:16px;text-align:center;font-size:11px;">&#10003;</span>';
			}

			let remove = '';
			if ( 'custom' === role ) {
				remove = '<button type="button" class="godam-cover-tile__remove" title="Remove" style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:3px;width:16px;height:16px;line-height:14px;cursor:pointer;padding:0;">&times;</button>';
			}

			return '<div class="godam-cover-tile" data-role="' + role + '" title="' + label + '" style="' + tileBaseStyle + ( selected ? tileSelectedStyle : '' ) + '">' +
				inner + badge + remove +
				'</div>';
		}

		function render() {
			const custom = $valueInput.val();
			const autoSelected = ! custom;
			let html = '';

			// Auto-generated cover tile (default).
			html += tileHtml( 'auto', autoCover, autoSelected, 'Auto-generated cover' );

			// Custom cover tile (only when a custom image is chosen).
			if ( custom ) {
				html += tileHtml( 'custom', custom, true, 'Custom cover' );
			}

			$tiles.html( html );
		}

		// Load the auto cover for the currently-selected document, then paint.
		fetchAutoCover( getDocumentId( $block ), function( cover ) {
			autoCover = cover;
			render();
		} );
		render();

		// Selecting the auto tile clears the custom value (empty = use auto).
		$tiles.off( 'click' ).on( 'click', '.godam-cover-tile', function() {
			if ( 'auto' === $( this ).data( 'role' ) ) {
				$valueInput.val( '' ).trigger( 'change' );
				render();
			}
		} );

		// Removing the custom cover reverts to the auto-generated cover.
		$tiles.on( 'click', '.godam-cover-tile__remove', function( e ) {
			e.stopPropagation();
			$valueInput.val( '' ).trigger( 'change' );
			render();
		} );

		// "Select image" opens the media library (images only) for a custom cover.
		$selectBtn.off( 'click' ).on( 'click', function( e ) {
			e.preventDefault();
			const frame = wp.media( {
				title: 'Select Cover Image',
				button: { text: 'Use image' },
				library: { type: 'image' },
				multiple: false,
			} );
			frame.on( 'select', function() {
				const attachment = frame.state().get( 'selection' ).first().toJSON();
				$valueInput.val( attachment.url ).trigger( 'change' );
				render();
			} );
			frame.open();
		} );

		// When the chosen document changes, reset to auto and refetch its cover.
		const $formContainer = $block.closest( '.wpb_el_type_document_cover_selector' ).parent();
		$formContainer.find( '.document_selector_field' ).off( 'change.godamCover' ).on( 'change.godamCover', function() {
			$valueInput.val( '' ).trigger( 'change' );
			autoCover = '';
			render();
			fetchAutoCover( $( this ).val(), function( cover ) {
				autoCover = cover;
				render();
			} );
		} );
	}
}( window.jQuery ) );
