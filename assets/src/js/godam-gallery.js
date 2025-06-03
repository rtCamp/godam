/* global GODAMPlayer */

// Common function to load more videos
async function loadMoreVideos( gallery, offset, columns, orderby, order, totalVideos ) {
	const loadCount = 3 * columns;
	const spinnerContainer = document.querySelector( '.godam-spinner-container' );

	if ( spinnerContainer ) {
		spinnerContainer.classList.add( 'loading' );
	}

	try {
		const params = new URLSearchParams( {
			offset,
			columns,
			count: loadCount,
			orderby,
			order,
		} );
		const response = await fetch( `/wp-json/godam/v1/gallery-shortcode?${ params.toString() }` );
		const data = await response.json();

		if ( data.status === 'success' && data.html && data.html.trim() !== '' ) {
			gallery.insertAdjacentHTML( 'beforeend', data.html );
			const newOffset = offset + loadCount;

			// Check if we've loaded all videos
			if ( newOffset >= totalVideos ) {
				if ( spinnerContainer ) {
					spinnerContainer.remove();
				}
				return false; // No more videos to load
			}

			if ( spinnerContainer ) {
				spinnerContainer.classList.remove( 'loading' );
			}
			return newOffset; // Return new offset for next load
		}
	} catch ( error ) {
	}

	if ( spinnerContainer ) {
		spinnerContainer.classList.remove( 'loading' );
	}
	return false;
}

document.addEventListener( 'DOMContentLoaded', function() {
	// Get all galleries with infinite scroll enabled
	document.querySelectorAll( '.godam-video-gallery[data-infinite-scroll="1"]' ).forEach( ( gallery ) => {
		const offset = parseInt( gallery.getAttribute( 'data-offset' ), 10 );
		const columns = parseInt( gallery.getAttribute( 'data-columns' ), 10 );
		const orderby = gallery.getAttribute( 'data-orderby' );
		const order = gallery.getAttribute( 'data-order' );
		const totalVideos = parseInt( gallery.getAttribute( 'data-total' ), 10 );
		let currentOffset = offset;
		let isLoading = false;

		// Create an observer for the last video item
		const observer = new IntersectionObserver( ( entries ) => {
			entries.forEach( ( entry ) => {
				// Check if the last item is no longer visible (scrolled past it)
				if ( entry.isIntersecting && ! isLoading ) {
					isLoading = true;
					// Load more videos when we've scrolled past the last item
					loadMoreVideos( gallery, currentOffset, columns, orderby, order, totalVideos )
						.then( ( newOffset ) => {
							if ( newOffset ) {
								currentOffset = newOffset;
								// Re-observe the new last item
								const videoItems = gallery.querySelectorAll( '.godam-video-item' );
								if ( videoItems.length > 0 ) {
									observer.observe( videoItems[ videoItems.length - 1 ] );
								}
							}
							isLoading = false;
						} )
						.catch( () => {
							isLoading = false;
						} );
				}
			} );
		}, {
			root: null,
			rootMargin: '-200px',
			threshold: 0.5,
		} );

		// Function to observe the last video item
		const observeLastItem = () => {
			const videoItems = gallery.querySelectorAll( '.godam-video-item' );
			if ( videoItems.length > 0 ) {
				const lastItem = videoItems[ videoItems.length - 1 ];
				observer.observe( lastItem );
			}
		};

		// Initial observation
		observeLastItem();
	} );
} );

// Handle Load More button clicks
document.addEventListener( 'click', async function( e ) {
	if ( e.target && e.target.classList.contains( 'godam-load-more' ) ) {
		e.preventDefault();
		const btn = e.target;
		const gallery = btn.previousElementSibling;

		const offset = parseInt( btn.getAttribute( 'data-offset' ), 10 );
		const columns = parseInt( btn.getAttribute( 'data-columns' ), 10 );
		const orderby = btn.getAttribute( 'data-orderby' );
		const order = btn.getAttribute( 'data-order' );
		const totalVideos = parseInt( btn.getAttribute( 'data-total' ), 10 );

		// Hide button
		btn.style.display = 'none';

		const newOffset = await loadMoreVideos( gallery, offset, columns, orderby, order, totalVideos );

		if ( newOffset ) {
			btn.setAttribute( 'data-offset', newOffset );
			btn.style.display = 'inline-flex';
		} else {
			btn.remove();
		}
	}
} );

// Use event delegation - attach listener to document, check if clicked element matches
document.addEventListener( 'click', async function( e ) {
	// Check if the clicked element is a video thumbnail
	if ( e.target.closest( '.godam-video-thumbnail' ) ) {
		const thumbnail = e.target.closest( '.godam-video-thumbnail' );
		const videoId = thumbnail.getAttribute( 'data-video-id' );
		if ( ! videoId ) {
			return;
		}

		// Check if modal exists or create it
		let modal = document.getElementById( 'godam-video-modal' );
		if ( ! modal ) {
			modal = document.createElement( 'div' );
			modal.id = 'godam-video-modal';
			modal.className = 'godam-modal';
			document.body.appendChild( modal );
		}

		// Show modal immediately with the player
		modal.innerHTML = `
			<div class="godam-modal-overlay"></div>
			<div class="godam-modal-content">
				<span class="godam-modal-close">&times;</span>
				<div class="easydam-video-container animate-video-loading">
					<div class="animate-play-btn">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
							<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
						</svg>
					</div>
				</div>
				<div class="godam-modal-footer">
					<div class="godam-video-info">
						<h3 class="godam-video-title"></h3>
						<span class="godam-video-date"></span>
					</div>
				</div>
			</div>
		`;

		modal.classList.remove( 'hidden' );

		// Initialize the video player
		if ( typeof GODAMPlayer === 'function' ) {
			GODAMPlayer( modal );
		}

		// Close handlers
		const close = () => {
			// Find and dispose any video players in the modal
			const players = modal.querySelectorAll( '.video-js' );
			players.forEach( ( player ) => {
				if ( player.player ) {
					player.player.dispose();
				}
			} );
			modal.classList.add( 'hidden' );
		};

		modal.querySelector( '.godam-modal-close' )?.addEventListener( 'click', close );
		modal.addEventListener( 'click', ( err ) => {
			if ( ! err.target.closest( '.godam-modal-content' ) ) {
				close();
			}
		} );

		// Fetch video data in the background
		try {
			const response = await fetch( `/wp-json/godam/v1/video-shortcode?id=${ videoId }` );
			const data = await response.json();

			if ( data.status === 'success' && data.html ) {
				// Update the video element with the fetched data
				const videoContainer = modal.querySelector( '.easydam-video-container' );
				if ( videoContainer ) {
					videoContainer.innerHTML = data.html;
					videoContainer.classList.remove( 'animate-video-loading' );

					// Update video title in the modal header
					const videoTitle = modal.querySelector( '.godam-video-title' );
					if ( videoTitle ) {
						videoTitle.textContent = data.title || '';
					}

					// Add this new code to update the date
					const videoDate = modal.querySelector( '.godam-video-date' );
					if ( videoDate ) {
						videoDate.textContent = data.date || '';
					}

					// Reinitialize the player with the new content
					if ( typeof GODAMPlayer === 'function' ) {
						GODAMPlayer( modal );
					}
				}
			} else {
				// Handle error case
				const videoContainer = modal.querySelector( '.easydam-video-container' );
				if ( videoContainer ) {
					videoContainer.innerHTML = '<div class="godam-error-message">Video could not be loaded.</div>';
					videoContainer.classList.remove( 'animate-video-loading' );
				}
			}
		} catch ( error ) {
			// Handle error case
			const videoContainer = modal.querySelector( '.easydam-video-container' );
			if ( videoContainer ) {
				videoContainer.innerHTML = '<div class="godam-error-message">Video could not be loaded.</div>';
				videoContainer.classList.remove( 'animate-video-loading' );
			}
		}
	}
} );
