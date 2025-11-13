document.addEventListener( 'DOMContentLoaded', function() {
	const mediaItems = document.querySelectorAll( '.youzify-media-item' );

	mediaItems.forEach( function( item ) {
		const videoWrapper = item.querySelector( 'div.youzify-media-item-godam-video' );

		if ( ! videoWrapper ) {
			return;
		}

		const contentEl = item.querySelector( '.youzify-media-item-content' );

		if ( contentEl ) {
			contentEl.style.display = 'none';
		}

		const sourceLink = contentEl ? contentEl.querySelector( '.youzify-media-post-link' ) : null;
		const sourceAnchor = sourceLink ? sourceLink.closest( 'a' ) || sourceLink : null;
		const href = sourceAnchor ? sourceAnchor.getAttribute( 'href' ) : null;

		if ( href ) {
			const targetLink = videoWrapper.querySelector( '.youzify-media-post-link' );
			const targetAnchor = targetLink ? targetLink.closest( 'a' ) || targetLink : null;

			if ( targetAnchor ) {
				targetAnchor.setAttribute( 'href', href );
			}
		}

		// Add click event listener to play button
		const playButton = videoWrapper.querySelector( '.youzify-media-item-godam-video--play-button' );
		if ( playButton ) {
			playButton.addEventListener( 'click', function( e ) {
				e.preventDefault();
				openVideoPopup( videoWrapper );
			} );
		}
	} );

	/**
	 * Open video player in popup modal
	 *
	 * @param {HTMLElement} videoWrapper The video wrapper element
	 */
	function openVideoPopup( videoWrapper ) {
		// Get the figure element (GoDAM player container)
		const figureElement = videoWrapper.querySelector( 'figure[id^="godam-player-container-"]' );

		if ( ! figureElement ) {
			return;
		}

		// Extract media ID from videoWrapper ID (format: godam-video-{media_id})
		const mediaId = videoWrapper.id.replace( 'godam-video-', '' );

		// Store the original parent and next sibling for restoration
		const originalParent = figureElement.parentNode;
		const originalNextSibling = figureElement.nextSibling;

		// Create modal overlay
		const modal = document.createElement( 'div' );
		modal.className = 'godam-video-popup-modal';
		modal.innerHTML = `
			<div class="godam-video-popup-overlay"></div>
			<div class="godam-video-popup-content">
				<button class="godam-video-popup-close" aria-label="Close video">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
						<path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
					</svg>
				</button>
				<div class="godam-video-popup-player"></div>
			</div>
		`;

		// Get player container and move the figure element into it
		const playerContainer = modal.querySelector( '.godam-video-popup-player' );
		playerContainer.appendChild( figureElement );

		// Append modal to body
		document.body.appendChild( modal );
		document.body.classList.add( 'godam-video-popup-open' );

		// Get the GoDAM player instance
		let player = null;

		if ( window.GoDAMAPI && mediaId ) {
			try {
				player = window.GoDAMAPI.getPlayer( mediaId );

				if ( player ) {
					// Show controls and attempt auto-play
					player.controls( true );

					const playPromise = player.play();

					if ( playPromise !== undefined ) {
						playPromise.catch( function() {
							// Auto-play was prevented
						} );
					}
				}
			} catch ( error ) {
				// Error getting player instance
			}
		}

		// Close modal handlers
		const closeButton = modal.querySelector( '.godam-video-popup-close' );
		const overlay = modal.querySelector( '.godam-video-popup-overlay' );

		function closeModal() {
			// Stop the video if playing using GoDAMAPI
			if ( window.GoDAMAPI && mediaId ) {
				try {
					const godamPlayer = window.GoDAMAPI.getPlayer( mediaId );
					if ( godamPlayer ) {
						godamPlayer.pause();
						godamPlayer.currentTime( 0 );
					}
				} catch ( error ) {
					// Error stopping player
				}
			}

			// Move the figure element back to its original position
			if ( originalNextSibling ) {
				originalParent.insertBefore( figureElement, originalNextSibling );
			} else {
				originalParent.appendChild( figureElement );
			}

			// Remove modal
			document.body.classList.remove( 'godam-video-popup-open' );
			modal.remove();
		}

		closeButton.addEventListener( 'click', closeModal );
		overlay.addEventListener( 'click', closeModal );

		// Close on Escape key
		document.addEventListener( 'keydown', function escapeHandler( e ) {
			if ( e.key === 'Escape' ) {
				closeModal();
				document.removeEventListener( 'keydown', escapeHandler );
			}
		} );
	}
} );

