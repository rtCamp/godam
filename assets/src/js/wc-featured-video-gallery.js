/* global jQuery, myGalleryAjaxData, GODAMPlayer */

// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-console */

jQuery( document ).ready( function( $ ) {
	const emptySrcAlts = [];
	const emptyImgs = [];

	/**
	 * Process and identify empty thumbnails and trigger AJAX for video thumbnails.
	 */
	function handleGalleryImages() {
		const $imgs = $( '.woocommerce-product-gallery' ).find( 'ol.flex-control-thumbs li img' );

		if ( $imgs.length === 0 ) {
			return;
		}

		$imgs.each( function() {
			const $img = $( this );
			const src = $img.attr( 'src' );
			const alt = $img.attr( 'alt' ) || '';

			if ( ! src || src.trim() === '' ) {
				emptySrcAlts.push( alt );
				emptyImgs.push( this );
			}
		} );

		if ( emptySrcAlts.length === 0 ) {
			return;
		}

		const productId = $( 'button[name="add-to-cart"]' ).val();
		if ( ! productId || ! myGalleryAjaxData?.ajax_url || ! myGalleryAjaxData?.nonce ) {
			return;
		}

		$.post(
			myGalleryAjaxData.ajax_url,
			{
				action: 'send_empty_alts',
				nonce: myGalleryAjaxData.nonce,
				alts: emptySrcAlts,
				product_id: productId,
			},
			function( response ) {
				if ( ! response.success || ! response.data?.videoThumbs || ! response.data?.videoIds ) {
					console.error( 'Invalid AJAX response for video thumbnails' );
					return;
				}

				response.data.videoThumbs.forEach( function( thumbUrl, index ) {
					const videoId = response.data.videoIds[ index ];
					const imgEl = emptyImgs[ index ];

					if ( ! thumbUrl || ! videoId || ! imgEl ) {
						return;
					}

					const $img = $( imgEl );
					$img.attr( 'src', thumbUrl )
						.attr( 'data-video-id', videoId )
						.addClass( 'godam-video-thumbnail' )
						.off( 'click' )
						.on( 'click', function() {
							openVideoModal( videoId );
						} );
				} );
			},
		);
	}

	/**
	 * Opens the video modal for a given video ID.
	 *
	 * @param {number} videoId
	 */
	async function openVideoModal( videoId ) {
		let modal = document.getElementById( 'godam-featured-video-modal' );
		if ( ! modal ) {
			modal = document.createElement( 'div' );
			modal.id = 'godam-featured-video-modal';
			modal.className = 'godam-featured-video-modal';
			document.body.appendChild( modal );
		}

		modal.dataset.currentVideoId = videoId;
		modal.dataset.isLoading = 'false';

		modal.innerHTML = `
			<div class="godam-featured-video-modal-overlay"></div>
				<div class="godam-featured-video-modal-content">
					<span class="godam-featured-video-modal-close">&times;</span>
					<div class="easydam-video-container animate-video-loading">
						<div class="animate-play-btn">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
								<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
							</svg>
						</div>
					</div>
				</div>
		`;

		modal.classList.remove( 'hidden' );
		document.body.style.overflow = 'hidden';

		modal.querySelector( '.godam-featured-video-modal-close' )?.addEventListener( 'click', closeModal );
		modal.addEventListener( 'click', ( e ) => {
			if ( ! e.target.closest( '.godam-featured-video-modal-content' ) ) {
				closeModal();
			}
		} );

		await loadVideoById( videoId );
	}

	/**
	 * Loads the video by ID via REST API and updates modal content.
	 *
	 * @param {number} videoId
	 */
	async function loadVideoById( videoId ) {
		const modal = document.getElementById( 'godam-featured-video-modal' );
		const container = modal?.querySelector( '.easydam-video-container' );
		if ( ! modal || ! container || modal.dataset.isLoading === 'true' ) {
			return;
		}

		modal.dataset.isLoading = 'true';

		container.innerHTML = `
			<div class="animate-video-loading">
				<div class="animate-play-btn">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
						class="bi bi-play-fill" viewBox="0 0 16 16">
						<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308
						c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
					</svg>
				</div>
			</div>
		`;

		try {
			const res = await fetch( `/wp-json/godam/v1/video-shortcode?id=${ videoId }` );
			const data = await res.json();

			if ( data.status === 'success' && data.html ) {
				let html = data.html;

				html = html.replace( /data-options="([^"]+)"/, ( match, encoded ) => {
					try {
						const decoded = encoded.replace( /&quot;/g, '"' );
						const options = JSON.parse( decoded );
						options.aspectRatio = '9:16';
						options.playerSkin = 'Minimal';
						const reEncoded = JSON.stringify( options ).replace( /"/g, '&quot;' );
						return `data-options="${ reEncoded }"`;
					} catch {
						return match;
					}
				} );

				html = html.replace( /--rtgodam-video-aspect-ratio:\s*[^;"]+/, '--rtgodam-video-aspect-ratio: 9/16' );

				container.innerHTML = html;
				container.classList.remove( 'animate-video-loading' );

				if ( typeof GODAMPlayer === 'function' ) {
					GODAMPlayer( modal );
					const playerEl = modal.querySelector( '.video-js' );
					playerEl?.player?.play?.();
				}
			} else {
				container.innerHTML = '<div class="godam-error-message">Video could not be loaded.</div>';
			}
		} catch ( err ) {
			console.error( err );
			container.innerHTML = '<div class="godam-error-message">Error loading video.</div>';
		} finally {
			modal.dataset.isLoading = 'false';
		}
	}

	/**
	 * Closes and resets the video modal.
	 */
	function closeModal() {
		const modal = document.getElementById( 'godam-featured-video-modal' );
		if ( ! modal ) {
			return;
		}

		modal.querySelectorAll( '.video-js' ).forEach( ( player ) => player.player?.dispose?.() );
		modal.classList.add( 'hidden' );
		document.body.style.overflow = '';
	}

	/**
	 * Observes gallery and runs handler when images are loaded.
	 */
	const targetNode = document.querySelector( '.woocommerce-product-gallery' );
	if ( targetNode ) {
		const observer = new MutationObserver( function( _, obs ) {
			if ( $( targetNode ).find( 'ol.flex-control-thumbs li img' ).length > 0 ) {
				obs.disconnect();
				handleGalleryImages();
			}
		} );

		observer.observe( targetNode, { childList: true, subtree: true } );

		// Optional immediate execution if already present.
		if ( $( targetNode ).find( 'ol.flex-control-thumbs li img' ).length > 0 ) {
			handleGalleryImages();
		}
	}
} );
