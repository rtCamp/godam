/* global jQuery, RTGodamVideoGallery, mejs */

jQuery( document ).ready( function( $ ) {
	if ( ! RTGodamVideoGallery?.hasValidAPIKey ) {
		return;
	}

	const { __, sprintf } = wp.i18n;

	const videoList = $( '.godam-product-video-gallery-list' );

	// Prevent MediaElement from auto-initializing on our gallery items
	// This fixes the "Cannot read properties of null (reading 'length')" error
	if ( typeof mejs !== 'undefined' && mejs.MediaElementPlayer ) {
		const originalInit = mejs.MediaElementPlayer.prototype.init;
		mejs.MediaElementPlayer.prototype.init = function() {
			// Skip initialization if the element is inside our video gallery metabox
			if ( this.node && $( this.node ).closest( '.godam-product-video-gallery-list' ).length > 0 ) {
				return;
			}
			return originalInit.apply( this, arguments );
		};
	}

	const tagIconSVG = `<img src="${ RTGodamVideoGallery.Ptag }" width="14" height="14" alt="Tag Icon" style="vertical-align:middle; margin-right:4px;" />`;

	let mediaFrame = null; // Store frame instance to prevent duplicates

	function updateAddProductButtonLabel( $btn, count ) {
		if ( count > 0 ) {
			const productText = sprintf(
				/* translators: 1: count, 2: plural suffix (s if >1) */
				__( '%1$d product%2$s', 'godam' ),
				count,
				count > 1 ? 's' : '',
			);

			$btn.html( `${ tagIconSVG }${ productText }` );

			$btn.attr(
				'aria-label',
				sprintf(
					/* translators: 1: count, 2: plural suffix (s if >1) */
					__( '%1$d product%2$s attached to this video', 'godam' ),
					count,
					count > 1 ? 's' : '',
				),
			);
		} else {
			const label = __( '+ Add Products', 'godam' );
			$btn.text( label );
			$btn.attr( 'aria-label', label );
		}
	}

	$( '.wc-godam-add-video-button' ).on( 'click', function( e ) {
		e.preventDefault();

		mediaFrame = wp.media( {
			title: __( 'Select videos for gallery', 'godam' ),
			button: { text: __( 'Add to Video Gallery', 'godam' ) },
			multiple: true,
			library: { type: 'video' },
		} );

		mediaFrame.on( 'select', function() {
			mediaFrame
				.state()
				.get( 'selection' )
				.each( function( attachment ) {
					const data = attachment.toJSON();

					$( '.godam-product-admin-video-spinner-overlay' ).show();

					// Skip duplicates.
					if ( videoList.find( `input[data-vid-id="${ data.id }"]` ).length ) {
						$( '.godam-product-admin-video-spinner-overlay' ).hide();
						return;
					}

					const $addBtn = $( '<button>', {
						type: 'button',
						class: 'godam-add-product-button components-button godam-button is-compact is-tertiary wc-godam-product-admin',
						'aria-label': __( 'Associate products with this video', 'godam' ),
						text: __( '+ Add Products', 'godam' ),
						'data-linked-products': '[]',
					} );

					wp.apiFetch( {
						path: `/wp/v2/media/${ data.id }`,
					} )
						.then( ( media ) => {
							const thumbnail = media.meta.rtgodam_media_video_thumbnail || RTGodamVideoGallery.defaultThumbnail;
							const videoTitle = media.title?.rendered || '';

							const listItem = $( '<li>' ).append(
								`<input type="hidden"
									name="rtgodam_product_video_gallery_ids[]"
									value="${ data.id }"
									data-vid-id="${ data.id }" />`,
								`<input type="hidden"
									name="rtgodam_product_video_gallery_urls[]"
									value="${ data.url }" />`,
							);

							const $thumbWrapper = $( '<div>', {
								class: 'video-thumb-wrapper',
							} );

							if ( thumbnail ) {
								$thumbWrapper.append(
									`<img src="${ thumbnail }" alt="${ __( 'Video thumbnail', 'godam' ) }" class="godam-video-thumbnail" />`,
								);
							} else {
								$thumbWrapper.append(
									`<span style="color:#aaa; margin-bottom: 10px; display:block; aria-label="${ __( 'No thumbnail available', 'godam' ) }"">${ __( 'No thumbnail available', 'godam' ) }</span>`,
								);
							}

							const $videoTitle = $( '<div>', {
								class: 'godam-product-video-title',
								text: videoTitle,
								title: videoTitle,
							} );

							$thumbWrapper.append(
								$( '<button>', {
									type: 'button',
									class: 'godam-remove-video-button components-button godam-button is-compact is-secondary has-icon wc-godam-product-admin',
									'aria-label': __( 'Remove video from gallery', 'godam' ),
									html: `
									<img src="${ RTGodamVideoGallery.DeleteIcon }" alt="${ __( 'Delete Bin Icon', 'godam' ) }" width="14" height="14" style="vertical-align:middle;" />
								`,
								} ),
							);

							listItem.append( $thumbWrapper ).append( $videoTitle ).append( $addBtn );
							videoList.append( listItem );

							wp.apiFetch( {
								path: `${ RTGodamVideoGallery.namespace }${ RTGodamVideoGallery.videoCountEP }/${ data.id }`,
							} )
								.then( ( res ) => {
									updateAddProductButtonLabel( $addBtn, res.count );

									if ( Array.isArray( res.linked ) ) {
										$addBtn.attr(
											'data-linked-products',
											JSON.stringify( res.linked ),
										);
									}
								} )
								.catch( () => {
									// If endpoint fails just leave the default label & an empty list.
									// eslint-disable-next-line no-console
									console.warn( 'Could not fetch count of product for ID:' + data.id );
									$( '.godam-product-admin-video-spinner-overlay' ).hide();
								} )
								.finally( () => {
									// Hide spinner once linked product fetch is done.
									$( '.godam-product-admin-video-spinner-overlay' ).hide();
								} );
						} )
						.catch( () => {
							// eslint-disable-next-line no-console
							console.warn( 'Could not fetch media data for ID: ' + data.id );
							$( '.godam-product-admin-video-spinner-overlay' ).hide();
						} );
				} );
		} );

		mediaFrame.open();
	} );

	videoList.on( 'click', '.godam-remove-video-button', function( e ) {
		e.preventDefault();
		$( this ).closest( 'li' ).remove();
	} );

	// ---- Variation Picker -------------------------------------------------------
	// Only relevant for variable products.
	if (
		RTGodamVideoGallery.productType === 'variable' &&
		Array.isArray( RTGodamVideoGallery.productAttributes ) &&
		RTGodamVideoGallery.productAttributes.length
	) {
		// Build attribute lookup once.
		const attrMap = {};
		RTGodamVideoGallery.productAttributes.forEach( ( attr ) => {
			const optLabels = {};
			attr.options.forEach( ( o ) => {
				optLabels[ o.value ] = o.label;
			} );
			attrMap[ attr.slug ] = { label: attr.label, optLabels };
		} );

		/**
		 * Refresh the chip pills shown for a video's current variation selection.
		 *
		 * @param {jQuery} $li           - The list item.
		 * @param {Object} selectedAttrs - Plain object of { slug: value }.
		 */
		function updateVariationChips( $li, selectedAttrs ) {
			const $chips = $li.find( '.godam-variation-chips' );
			$chips.empty();

			Object.entries( selectedAttrs ).forEach( ( [ slug, value ] ) => {
				if ( ! value ) {
					return;
				}
				const info = attrMap[ slug ] || {};
				const attrLabel = info.label || slug;
				const valueLabel = ( info.optLabels || {} )[ value ] || value;
				$chips.append(
					$( '<span>', {
						class: 'godam-variation-chip',
						text: `${ attrLabel }: ${ valueLabel }`,
					} ),
				);
			} );
		}

		/**
		 * Open a modal popup for selecting variation attributes.
		 *
		 * @param {jQuery} $li - The list item containing the video.
		 */
		function openVariationModal( $li ) {
			const $dataInput = $li.find( '.godam-variation-data' );
			const currentAttrs = JSON.parse( $dataInput.val() || '{}' );
			const videoTitle = $li.find( '.godam-product-video-title' ).text() || __( 'Video', 'godam' );

			// Backdrop overlay.
			const $overlay = $( '<div>', { class: 'godam-variation-modal-overlay' } );

			// Modal container.
			const $modal = $( '<div>', { class: 'godam-variation-modal' } );

			// Header.
			const $header = $( '<div>', { class: 'godam-variation-modal-header' } );
			$header.append( $( '<h3>', { text: __( 'Select Variation', 'godam' ) } ) );
			$header.append(
				$( '<button>', {
					type: 'button',
					class: 'godam-variation-modal-close',
					html: '&times;',
					'aria-label': __( 'Close', 'godam' ),
				} ),
			);
			$modal.append( $header );

			// Subtitle.
			$modal.append( $( '<p>', {
				class: 'godam-variation-modal-subtitle',
				text: sprintf(
					/* translators: %s: video title */
					__( 'Pre-select variation attributes for "%s"', 'godam' ),
					videoTitle,
				),
			} ) );

			// Body — attribute rows.
			const $body = $( '<div>', { class: 'godam-variation-modal-body' } );

			RTGodamVideoGallery.productAttributes.forEach( ( attr ) => {
				const $row = $( '<div>', { class: 'godam-variation-modal-row' } );
				const $label = $( '<label>', { text: attr.label } );
				const $select = $( '<select>', { 'data-attribute': attr.slug } );

				$select.append( $( '<option>', { value: '', text: __( '— Any —', 'godam' ) } ) );

				attr.options.forEach( ( opt ) => {
					const $opt = $( '<option>', { value: opt.value, text: opt.label } );
					if ( currentAttrs[ attr.slug ] === opt.value ) {
						$opt.prop( 'selected', true );
					}
					$select.append( $opt );
				} );

				$row.append( $label ).append( $select );
				$body.append( $row );
			} );

			$modal.append( $body );

			// Footer with actions.
			const $footer = $( '<div>', { class: 'godam-variation-modal-footer' } );

			$footer.append(
				$( '<button>', {
					type: 'button',
					class: 'godam-variation-modal-clear-btn components-button godam-button is-compact is-tertiary wc-godam-product-admin',
					text: __( 'Clear', 'godam' ),
				} ),
			);

			$footer.append(
				$( '<button>', {
					type: 'button',
					class: 'godam-variation-modal-apply-btn components-button godam-button is-compact is-primary wc-godam-product-admin',
					text: __( 'Apply', 'godam' ),
				} ),
			);

			$modal.append( $footer );
			$overlay.append( $modal );
			$( 'body' ).append( $overlay );

			// Focus trap — prevent background scrolling.
			$( 'body' ).addClass( 'godam-modal-open' );

			// Animate in.
			requestAnimationFrame( () => $overlay.addClass( 'is-visible' ) );

			// ---- Close handler ----
			function closeModal() {
				$overlay.removeClass( 'is-visible' );
				setTimeout( () => {
					$overlay.remove();
					$( 'body' ).removeClass( 'godam-modal-open' );
				}, 200 );
			}

			$overlay.on( 'click', '.godam-variation-modal-close', closeModal );
			$overlay.on( 'click', function( ev ) {
				if ( $( ev.target ).is( $overlay ) ) {
					closeModal();
				}
			} );

			// ---- Apply handler ----
			$overlay.on( 'click', '.godam-variation-modal-apply-btn', function() {
				const selected = {};
				$body.find( 'select[data-attribute]' ).each( function() {
					const val = $( this ).val();
					if ( val ) {
						selected[ $( this ).data( 'attribute' ) ] = val;
					}
				} );
				$dataInput.val( JSON.stringify( selected ) );
				updateVariationChips( $li, selected );
				closeModal();
			} );

			// ---- Clear handler ----
			$overlay.on( 'click', '.godam-variation-modal-clear-btn', function() {
				$body.find( 'select' ).val( '' );
				$dataInput.val( '{}' );
				updateVariationChips( $li, {} );
				closeModal();
			} );
		}

		// ---- Event: open the modal ----
		videoList.on( 'click', '.godam-select-variation-button', function( e ) {
			e.preventDefault();
			openVariationModal( $( this ).closest( 'li' ) );
		} );

		// ---- Also append variation input + button to videos added dynamically ----
		const observer = new MutationObserver( ( mutations ) => {
			mutations.forEach( ( mutation ) => {
				mutation.addedNodes.forEach( ( node ) => {
					if ( node.nodeType !== 1 ) {
						return;
					}
					const $node = $( node );
					const $li = $node.is( 'li' ) ? $node : $node.find( 'li' );
					$li.each( function() {
						const $item = $( this );
						if ( $item.find( '.godam-variation-data' ).length ) {
							return;
						}
						const vidId = $item.find( '[data-vid-id]' ).data( 'vid-id' );
						if ( ! vidId ) {
							return;
						}

						// Add hidden variation input.
						$item.append(
							$( '<input>', {
								type: 'hidden',
								name: `rtgodam_product_video_variations[${ vidId }]`,
								value: '{}',
								class: 'godam-variation-data',
							} ),
						);

						// Add chips container.
						if ( ! $item.find( '.godam-variation-chips' ).length ) {
							$item.append( $( '<div>', { class: 'godam-variation-chips' } ) );
						}

						// Ensure actions row exists (contains only the "Add Products" button).
						if ( ! $item.find( '.godam-video-actions-row' ).length ) {
							const $actionsRow = $( '<div>', { class: 'godam-video-actions-row' } );
							const $addBtn = $item.find( '.godam-add-product-button' );
							$addBtn.after( $actionsRow );
							$actionsRow.append( $addBtn );
						}

						// Add "Select Variation" icon button into the thumbnail overlay (bottom-left),
						// mirroring the delete button at top-right.
						const $thumbWrapper = $item.find( '.video-thumb-wrapper' );
						if ( $thumbWrapper.length && ! $thumbWrapper.find( '.godam-select-variation-button' ).length ) {
							$thumbWrapper.append(
								$( '<button>', {
									type: 'button',
									class: 'godam-select-variation-button components-button godam-button is-compact is-tertiary has-icon wc-godam-product-admin',
									'aria-label': __( 'Select variation', 'godam' ),
									title: __( 'Select variation', 'godam' ),
									html: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>',
								} ),
							);
						}
					} );
				} );
			} );
		} );

		observer.observe( videoList[ 0 ], { childList: true, subtree: true } );
	}
} );
