( function( $ ) {
	'use strict';

	// Use WordPress i18n when available so user-facing strings are translatable.
	const { __ } = ( window.wp && window.wp.i18n ) ? window.wp.i18n : { __: ( s ) => s };

	// Initialize on document ready and when WPBakery reloads the params.
	$( document ).ready( initDocumentCoverSelector );
	$( document ).on( 'vc.reload', initDocumentCoverSelector );

	/**
	 * Resolve the WP REST API root for a given block. The authoritative value is
	 * printed server-side via rest_url() into the block's data-rest-url attribute,
	 * which correctly handles subdirectory installs, custom REST prefixes and
	 * multisite. Falls back to wpApiSettings.root, then to a best-effort guess.
	 *
	 * @param {Object} $block The cover selector block element.
	 * @return {string} REST root URL with a trailing slash.
	 */
	function getRestRoot( $block ) {
		let root = $block.attr( 'data-rest-url' ) ||
			( window.wpApiSettings && window.wpApiSettings.root ) ||
			( window.location.origin + '/wp-json/' );
		if ( root && root.slice( -1 ) !== '/' ) {
			root += '/';
		}
		return root;
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
	 * @param {string}   restRoot The REST API root URL (trailing slash).
	 * @param {string}   id       The attachment ID.
	 * @param {Function} cb       Callback receiving the cover URL (may be empty).
	 */
	function fetchAutoCover( restRoot, id, cb ) {
		if ( ! id ) {
			cb( '' );
			return;
		}
		fetch( restRoot + 'wp/v2/media/' + id )
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
		const $formContainer = $block.closest( '.wpb_el_type_document_cover_selector' ).parent();
		const restRoot = getRestRoot( $block );

		let autoCover = '';

		const tileBaseStyle = 'position:relative;width:88px;height:64px;border:2px solid #dcdcde;border-radius:4px;overflow:hidden;cursor:pointer;background:#f0f0f1;display:flex;align-items:center;justify-content:center;';
		const tileSelectedStyle = 'border-color:var(--wp-admin-theme-color,#3858e9);';
		const imgStyle = 'width:100%;height:100%;object-fit:cover;';

		function tileHtml( role, imgUrl, selected, label ) {
			let inner = '';
			if ( imgUrl ) {
				inner = '<img src="' + encodeURI( imgUrl ) + '" alt="" style="' + imgStyle + '" />';
			} else {
				inner = '<span class="dashicons dashicons-media-document" style="font-size:28px;color:#8c8f94;"></span>';
			}

			let badge = '';
			if ( selected ) {
				badge = '<span class="godam-cover-tile__check" style="position:absolute;top:2px;right:2px;background:var(--wp-admin-theme-color,#3858e9);color:#fff;border-radius:50%;width:16px;height:16px;line-height:16px;text-align:center;font-size:11px;">&#10003;</span>';
			}

			let remove = '';
			if ( 'custom' === role ) {
				const removeLabel = __( 'Remove cover', 'godam' );
				remove = '<button type="button" class="godam-cover-tile__remove" aria-label="' + removeLabel + '" title="' + removeLabel + '" style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:3px;width:16px;height:16px;line-height:14px;cursor:pointer;padding:0;">&times;</button>';
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
			html += tileHtml( 'auto', autoCover, autoSelected, __( 'Auto-generated cover', 'godam' ) );

			// Custom cover tile (only when a custom image is chosen).
			if ( custom ) {
				html += tileHtml( 'custom', custom, true, __( 'Custom cover', 'godam' ) );
			}

			$tiles.html( html );
		}

		// Load the auto cover for the currently-selected document, then paint.
		fetchAutoCover( restRoot, getDocumentId( $block ), function( cover ) {
			autoCover = cover;
			render();
		} );
		render();

		// Namespaced delegated handlers, removed before re-binding so repeated
		// setupBlock() runs (document ready + vc.reload) don't stack listeners.

		// Selecting the auto tile clears the custom value (empty = use auto).
		$tiles.off( 'click.godamCoverTile' ).on( 'click.godamCoverTile', '.godam-cover-tile', function() {
			if ( 'auto' === $( this ).data( 'role' ) ) {
				$valueInput.val( '' ).trigger( 'change' );
				render();
			}
		} );

		// Removing the custom cover reverts to the auto-generated cover.
		$tiles.off( 'click.godamCoverRemove' ).on( 'click.godamCoverRemove', '.godam-cover-tile__remove', function( e ) {
			e.stopPropagation();
			$valueInput.val( '' ).trigger( 'change' );
			render();
		} );

		// "Select image" opens the media library (images only) for a custom cover.
		$selectBtn.off( 'click.godamCoverSelect' ).on( 'click.godamCoverSelect', function( e ) {
			e.preventDefault();
			const frame = wp.media( {
				title: __( 'Select Cover Image', 'godam' ),
				button: { text: __( 'Use image', 'godam' ) },
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
		$formContainer.find( '.document_selector_field' ).off( 'change.godamCover' ).on( 'change.godamCover', function() {
			$valueInput.val( '' ).trigger( 'change' );
			autoCover = '';
			render();
			fetchAutoCover( restRoot, $( this ).val(), function( cover ) {
				autoCover = cover;
				render();
			} );
		} );

		// WPBakery dependencies only support a single condition, so custom_cover
		// is gated on show_cover alone. When the view leaves Card, reset show_cover
		// to 0 — that already hides the custom cover field via its dependency. Do
		// NOT clear the stored custom_cover value: the field is only hidden, so a
		// previously chosen cover must survive peeking at Default and back.
		$formContainer.find( '[name="preview_mode"]' ).off( 'change.godamCoverMode' ).on( 'change.godamCoverMode', function() {
			if ( 'card' !== $( this ).val() ) {
				$formContainer.find( '[name="show_cover"]' ).val( '0' ).trigger( 'change' );
			}
		} );
	}
}( window.jQuery ) );
