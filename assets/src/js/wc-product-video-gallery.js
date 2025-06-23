/* global jQuery, RTGodamVideoGallery */

jQuery( document ).ready( function( $ ) {
	const { __ } = wp.i18n;

	const videoList = $( '.godam-product-video-gallery-list' );

	const tagIconSVG = `
	<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
		aria-hidden="true" focusable="false"
		style="vertical-align:middle; margin-right:4px;">
		<path d="M21.41 11.58l-9-9A2 2 0 0011 2H4a2 2 0 00-2 2v7a2 2 0 00.59 1.41l9 9a2 2 0 002.82 0l7-7a2 2 0 000-2.83zM7.5 8A1.5 1.5 0 119 9.5 1.5 1.5 0 017.5 8z"
			fill="currentColor"/>
	</svg>`;

	function updateAddProductButtonLabel( $btn, count ) {
		if ( count > 0 ) {
			$btn.html( `${ tagIconSVG }${ count } product${ count > 1 ? 's' : '' }` );
		} else {
			$btn.text( '+ Add Products' );
		}
	}

	$( '.wc-godam-add-video-button' ).on( 'click', function( e ) {
		e.preventDefault();

		const frame = wp.media( {
			title: __( 'Select videos for gallery', 'godam' ),
			button: { text: __( 'Add to Video Gallery', 'godam' ) },
			multiple: true,
			library: { type: 'video' },
		} );

		frame.on( 'select', function() {
			frame.state().get( 'selection' ).each( function( attachment ) {
				const data = attachment.toJSON();

				// Skip duplicates.
				if ( videoList.find( `input[data-vid-id="${ data.id }"]` ).length ) {
					return;
				}

				const $addBtn = $( '<button>', {
					type: 'button',
					class: 'godam-add-product-button components-button godam-button is-compact is-tertiary wc-godam-product-admin',
					'aria-label': __( 'Associate products with this video', 'godam' ),
					text: __( '+ Add Products', 'godam' ),
					'data-linked-products': '[]',
				} );

				const listItem = $( '<li>' )
					.append(
						`<input type="hidden"
								name="rtgodam_product_video_gallery_ids[]"
								value="${ data.id }"
								data-vid-id="${ data.id }" />`,
					)
					.append(
						`<input type="text"
								name="rtgodam_product_video_gallery_urls[]"
								value="${ data.url }"
								style="width:80%"
                                readonly />`,
					)
					.append(
						$addBtn,
					)
					.append(
						$( '<button>', {
							type: 'button',
							class: 'godam-remove-video-button components-button godam-button is-compact is-secondary has-icon wc-godam-product-admin',
							'aria-label': __( 'Remove video from gallery', 'godam' ),
							html: `
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none">
									<path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
									<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
									<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
									<path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								</svg>
							`,
						} ),
					);

				videoList.append( listItem );

				wp.apiFetch( {
					path: `${ RTGodamVideoGallery.namespace }${ RTGodamVideoGallery.videoCountEP }/${ data.id }`,
				} ).then( ( res ) => {
					updateAddProductButtonLabel( $addBtn, res.count );

					if ( Array.isArray( res.linked ) ) {
						$addBtn.attr( 'data-linked-products', JSON.stringify( res.linked ) );
					}
				} ).catch( () => {
					// If endpoint fails just leave the default label & an empty list.
				} );
			} );
		} );

		frame.open();
	} );

	videoList.on( 'click', '.godam-remove-video-button', function( e ) {
		e.preventDefault();
		$( this ).closest( 'li' ).remove();
	} );
} );
