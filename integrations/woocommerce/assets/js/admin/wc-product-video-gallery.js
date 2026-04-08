/* global jQuery, RTGodamVideoGallery, mejs */

jQuery( document ).ready( function( $ ) {
	if ( ! RTGodamVideoGallery?.hasValidAPIKey ) {
		return;
	}

	const { __ } = wp.i18n;

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

							listItem.append( $thumbWrapper ).append( $videoTitle );
							videoList.append( listItem );

							$( '.godam-product-admin-video-spinner-overlay' ).hide();
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
} );
