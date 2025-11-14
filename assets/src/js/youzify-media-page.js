document.addEventListener( 'DOMContentLoaded', function() {
	// Store processed items to avoid duplicate processing
	const processedItems = new WeakSet();

	/**
	 * Process a single media item
	 *
	 * @param {HTMLElement} item The media item element
	 */
	function processMediaItem( item ) {
		// Skip if already processed
		if ( processedItems.has( item ) ) {
			return;
		}

		const videoWrapper = item.querySelector( 'div.youzify-media-item-godam-video' );

		if ( ! videoWrapper ) {
			return;
		}

		// Mark as processed
		processedItems.add( item );

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
	}

	// Process existing media items on page load
	const existingMediaItems = document.querySelectorAll( '.youzify-media-item' );
	existingMediaItems.forEach( processMediaItem );

	// Set up MutationObserver to watch for dynamically added media items
	const observer = new MutationObserver( function( mutations ) {
		mutations.forEach( function( mutation ) {
			// Check added nodes
			mutation.addedNodes.forEach( function( node ) {
				// Skip non-element nodes
				if ( node.nodeType !== Node.ELEMENT_NODE ) {
					return;
				}

				// Check if the added node itself is a media item
				if ( node.classList && node.classList.contains( 'youzify-media-item' ) ) {
					processMediaItem( node );
				}

				// Check for media items within the added node
				if ( node.querySelectorAll ) {
					const mediaItems = node.querySelectorAll( '.youzify-media-item' );
					mediaItems.forEach( processMediaItem );
				}
			} );
		} );
	} );

	// Start observing the document body for changes
	observer.observe( document.body, {
		childList: true,
		subtree: true,
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
				// Get the video element reference
				const videoElement = figureElement.querySelector( 'video' );
				player = window.GoDAMAPI.getPlayer( mediaId, videoElement );

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
				// This may occur if the GoDAM player API is not available (e.g., not loaded),
				// or if no player instance is found for the given mediaId.
				// No further action is taken here as modal will still
			}
		}

		// Close modal handlers
		const closeButton = modal.querySelector( '.godam-video-popup-close' );
		const overlay = modal.querySelector( '.godam-video-popup-overlay' );

		// Close on Escape key
		function escapeHandler( e ) {
			if ( e.key === 'Escape' ) {
				closeModal();
			}
		}

		function closeModal() {
			// Remove escape key handler first
			document.removeEventListener( 'keydown', escapeHandler );

			// Stop the video if playing using GoDAMAPI
			if ( window.GoDAMAPI && mediaId ) {
				try {
					// Get the video element reference
					const videoElement = figureElement.querySelector( 'video' );
					const godamPlayer = window.GoDAMAPI.getPlayer( mediaId, videoElement );
					if ( godamPlayer ) {
						godamPlayer.pause();
						godamPlayer.currentTime( 0 );
					}
				} catch ( error ) {
					// Error stopping player
					// eslint-disable-next-line no-console
					console.error( 'Error stopping GoDAM player instance:', error );
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

		document.addEventListener( 'keydown', escapeHandler );
		closeButton.addEventListener( 'click', closeModal );
		overlay.addEventListener( 'click', closeModal );
	}
} );

