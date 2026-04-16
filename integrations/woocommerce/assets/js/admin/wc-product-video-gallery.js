/* global jQuery, RTGodamVideoGallery, mejs */

jQuery( document ).ready( function( $ ) {
	if ( ! RTGodamVideoGallery?.hasValidAPIKey ) {
		return;
	}

	const { __, sprintf } = wp.i18n;

	const videoList = $( '.godam-product-video-gallery-list' );
	const maxVideos = parseInt( RTGodamVideoGallery?.maxVideos, 10 ) || 5;
	const $addButton = $( '.wc-godam-add-video-button' );

	// Limit-reached notice element (inserted once, toggled as needed).
	const $limitNotice = $( '<p class="godam-video-limit-notice" style="background:#FFF8E5;border-left:4px solid #DBA617;padding:8px 12px;margin:8px 0;color:#6E4E00;font-size:13px;"></p>' );
	videoList.before( $limitNotice.hide() );

	/**
	 * Update the "Add Product Reels" button state based on current video count.
	 */
	function updateAddButtonState() {
		const count = videoList.children( 'li' ).not( '.godam-dummy-card' ).length;

		if ( count >= maxVideos ) {
			$addButton.prop( 'disabled', true );
			$limitNotice.text( sprintf(
				/* translators: %d: maximum number of videos allowed */
				__( 'Maximum limit of %d product reels has been reached.', 'godam' ),
				maxVideos,
			) ).show();
		} else {
			$addButton.prop( 'disabled', false );
			$limitNotice.hide();
		}
	}

	// Run once on page load.
	updateAddButtonState();

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

	let mediaFrame = null; // Store frame instance to prevent duplicates

	$( '.wc-godam-add-video-button' ).on( 'click', function( e ) {
		e.preventDefault();

		mediaFrame = wp.media( {
			title: __( 'Select videos for gallery', 'godam' ),
			button: { text: __( 'Add to Video Gallery', 'godam' ) },
			multiple: true,
			library: { type: 'video' },
		} );

		mediaFrame.on( 'select', function() {
			// If the selection comes from the GoDAM tab, let the GoDAM virtual
			// attachment handler deal with it and skip the default wp.media
			// select logic to avoid 404s on virtual IDs.
			if ( mediaFrame?.content?.mode && mediaFrame.content.mode() === 'godam' ) {
				return;
			}

			let limitReached = false;
			let queued = 0; // Track how many we've already accepted in this batch.
			const baseCount = videoList.children( 'li' ).not( '.godam-dummy-card' ).length;

			mediaFrame
				.state()
				.get( 'selection' )
				.each( function( attachment ) {
					// Enforce video limit using base count + already queued.
					if ( baseCount + queued >= maxVideos ) {
						limitReached = true;
						return;
					}

					const data = attachment.toJSON();

					// Skip duplicates (don't count them toward the queue).
					if ( videoList.find( `input[data-vid-id="${ data.id }"]` ).length ) {
						return;
					}

					queued++;

					$( '.godam-product-admin-video-spinner-overlay' ).show();

					wp.apiFetch( {
						path: `/wp/v2/media/${ data.id }`,
					} )
						.then( ( media ) => {
							const thumbnail = media.meta.rtgodam_media_video_thumbnail || RTGodamVideoGallery.defaultThumbnail;
							const videoTitle = media.title?.rendered || '';

							const listItem = $( '<li>' ).append(
								$( '<input>', {
									type: 'hidden',
									name: 'rtgodam_product_video_gallery_ids[]',
									value: data.id,
									'data-vid-id': data.id,
								} ),
								$( '<input>', {
									type: 'hidden',
									name: 'rtgodam_product_video_gallery_urls[]',
									value: data.url,
								} ),
							);

							const $thumbWrapper = $( '<div>', {
								class: 'video-thumb-wrapper',
							} );

							if ( thumbnail ) {
								$thumbWrapper.append(
									$( '<img>', {
										src: thumbnail,
										alt: __( 'Video thumbnail', 'godam' ),
										class: 'godam-video-thumbnail',
									} ),
								);
							} else {
								$thumbWrapper.append(
									$( '<span>', {
										text: __( 'No thumbnail available', 'godam' ),
										'aria-label': __( 'No thumbnail available', 'godam' ),
										css: { color: '#aaa', marginBottom: '10px', display: 'block' },
									} ),
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
								} ).append(
									$( '<img>', {
										src: RTGodamVideoGallery.DeleteIcon,
										alt: __( 'Delete Bin Icon', 'godam' ),
										width: 14,
										height: 14,
										css: { verticalAlign: 'middle' },
									} ),
								),
							);

							listItem.append( $thumbWrapper ).append( $videoTitle );
							videoList.append( listItem );

							updateAddButtonState();
							$( '.godam-product-admin-video-spinner-overlay' ).hide();
						} )
						.catch( () => {
							// eslint-disable-next-line no-console
							console.warn( 'Could not fetch media data for ID: ' + data.id );
							$( '.godam-product-admin-video-spinner-overlay' ).hide();
						} );
				} );

			if ( limitReached ) {
				// Remove any existing limit notice before showing a new one.
				$( '.godam-reels-limit-notice' ).remove();

				const $notice = $( '<div>', {
					class: 'notice notice-warning inline godam-reels-limit-notice',
					html: '<p>' +
						sprintf(
							/* translators: %d: maximum number of videos allowed */
							__( 'Product Reels are limited to %d videos. Some selections were skipped.', 'godam' ),
							maxVideos,
						) +
						'</p>',
				} );

				$( '#rtgodam-product-video-gallery' ).prepend( $notice );

				// Auto-dismiss after 8 seconds.
				setTimeout( function() {
					$notice.fadeOut( 300, function() {
						$notice.remove();
					} );
				}, 8000 );
			}
		} );

		window._godamWCActiveMediaSource = 'product-reels';
		mediaFrame.open();
	} );

	videoList.on( 'click', '.godam-remove-video-button', function( e ) {
		e.preventDefault();
		$( this ).closest( 'li' ).remove();
		updateAddButtonState();
	} );

	/**
	 * Listen for GoDAM virtual attachment creation.
	 *
	 * When a user selects a video from the GoDAM tab, the real WordPress
	 * attachment is created asynchronously. This handler adds the newly
	 * created attachment to the Product Reels gallery.
	 */
	document.addEventListener( 'godam-virtual-attachment-created', function( event ) {
		if ( window._godamWCActiveMediaSource !== 'product-reels' ) {
			return;
		}

		const { attachment } = event.detail || {};
		if ( ! attachment || ! attachment.id ) {
			return;
		}

		// Skip duplicates.
		if ( videoList.find( `input[data-vid-id="${ attachment.id }"]` ).length ) {
			return;
		}

		$( '.godam-product-admin-video-spinner-overlay' ).show();

		const thumbnail = ( attachment.meta && attachment.meta.rtgodam_media_video_thumbnail ) || RTGodamVideoGallery.defaultThumbnail;
		const videoTitle = attachment.title || '';

		const $addBtn = $( '<button>', {
			type: 'button',
			class: 'godam-add-product-button components-button godam-button is-compact is-tertiary wc-godam-product-admin',
			'aria-label': __( 'Associate products with this video', 'godam' ),
			text: __( '+ Add Products', 'godam' ),
			'data-linked-products': '[]',
		} );

		const listItem = $( '<li>' ).append(
			`<input type="hidden"
				name="rtgodam_product_video_gallery_ids[]"
				value="${ attachment.id }"
				data-vid-id="${ attachment.id }" />`,
			`<input type="hidden"
				name="rtgodam_product_video_gallery_urls[]"
				value="${ attachment.url }" />`,
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
				`<span style="color:#aaa; margin-bottom: 10px; display:block;">${ __( 'No thumbnail available', 'godam' ) }</span>`,
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
				html: `<img src="${ RTGodamVideoGallery.DeleteIcon }" alt="${ __( 'Delete Bin Icon', 'godam' ) }" width="14" height="14" style="vertical-align:middle;" />`,
			} ),
		);

		listItem.append( $thumbWrapper ).append( $videoTitle ).append( $addBtn );
		videoList.append( listItem );

		// Fetch linked products count.
		wp.apiFetch( {
			path: `${ RTGodamVideoGallery.namespace }${ RTGodamVideoGallery.videoCountEP }/${ attachment.id }`,
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
				// eslint-disable-next-line no-console
				console.warn( 'Could not fetch count of product for ID:' + attachment.id );
			} )
			.finally( () => {
				$( '.godam-product-admin-video-spinner-overlay' ).hide();
			} );
	} );
} );
