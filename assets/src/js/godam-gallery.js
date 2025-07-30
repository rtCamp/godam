/* global GODAMPlayer */
/**
 * External dependencies
 */
import DOMPurify from 'isomorphic-dompurify';

// Common function to load more videos
async function loadMoreVideos( gallery, offset, columns, orderby, order, totalVideos ) {
	const loadCount = 3 * columns;
	const spinnerContainer = document.querySelector( '.godam-spinner-container' );
	const showTitle = gallery.getAttribute( 'data-show-title' ) === '1';
	const layout = gallery.getAttribute( 'data-layout' ) || 'grid';

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
			show_title: showTitle,
			layout,
			category: gallery.dataset.category ? parseInt( gallery.dataset.category, 10 ) : 0,
			tag: gallery.dataset.tag ? parseInt( gallery.dataset.tag, 10 ) : 0,
			author: gallery.dataset.author ? parseInt( gallery.dataset.author, 10 ) : 0,
			include: gallery.dataset.include || '',
			search: gallery.dataset.search || '',
			date_range: gallery.dataset.dateRange || '',
			custom_date_start: gallery.dataset.customDateStart || '',
			custom_date_end: gallery.dataset.customDateEnd || '',
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
		let allVideosLoaded = false;

		// Add scroll event listener
		let scrollTimeout;
		const scrollHandler = () => {
			if ( ! allVideosLoaded ) {
				clearTimeout( scrollTimeout );
				scrollTimeout = setTimeout( () => {
					const videoItems = gallery.querySelectorAll( '.godam-video-item' );
					if ( videoItems.length > 0 ) {
						const lastItem = videoItems[ videoItems.length - 1 ];
						const rect = lastItem.getBoundingClientRect();

						// If the last item is near the bottom of the viewport
						if ( rect.bottom <= window.innerHeight + 200 && ! isLoading ) {
							isLoading = true;
							loadMoreVideos( gallery, currentOffset, columns, orderby, order, totalVideos )
								.then( ( newOffset ) => {
									if ( newOffset ) {
										currentOffset = newOffset;
									} else {
										allVideosLoaded = true;
										window.removeEventListener( 'scroll', scrollHandler );
									}
									isLoading = false;
								} )
								.catch( ( ) => {
									isLoading = false;
								} );
						}
					}
				}, 100 ); // Debounce scroll events
			}
		};

		window.addEventListener( 'scroll', scrollHandler );
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
			btn.style.display = 'block';
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

		// Get the current gallery
		const currentGallery = thumbnail.closest( '.godam-video-gallery' );
		if ( ! currentGallery ) {
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

		// Store current video ID and loading state
		modal.dataset.currentVideoId = videoId;
		modal.dataset.isLoading = 'false';

		// Get gallery pagination info
		const galleryOffset = parseInt( currentGallery.getAttribute( 'data-offset' ) || 0, 10 );
		const galleryColumns = parseInt( currentGallery.getAttribute( 'data-columns' ) || 3, 10 );
		const galleryOrderby = currentGallery.getAttribute( 'data-orderby' ) || 'date';
		const galleryOrder = currentGallery.getAttribute( 'data-order' ) || 'DESC';
		const galleryTotal = parseInt( currentGallery.getAttribute( 'data-total' ) || 0, 10 );

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

		// Prevent background scrolling when modal is open
		document.body.style.overflow = 'hidden';

		// Function to load a new video
		const loadNewVideo = async ( newVideoId ) => {
			// Check if already loading
			if ( modal.dataset.isLoading === 'true' ) {
				return;
			}

			// Set loading state
			modal.dataset.isLoading = 'true';
			modal.dataset.currentVideoId = newVideoId;

			// Show loading state
			const videoContainer = modal.querySelector( '.easydam-video-container' );
			if ( videoContainer ) {
				videoContainer.innerHTML = `
					<div class="animate-video-loading">
						<div class="animate-play-btn">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
								<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
							</svg>
						</div>
					</div>
				`;
				videoContainer.classList.add( 'animate-video-loading' );
			}

			try {
				const response = await fetch( `/wp-json/godam/v1/video-shortcode?id=${ newVideoId }` );
				const data = await response.json();

				if ( data.status === 'success' && data.html ) {
					// Update the video element with the fetched data
					if ( videoContainer ) {
						videoContainer.innerHTML = data.html;
						videoContainer.classList.remove( 'animate-video-loading' );

						// Update video title in the modal header
						const videoTitle = modal.querySelector( '.godam-video-title' );
						if ( videoTitle ) {
							videoTitle.innerHTML = DOMPurify.sanitize( data.title || '' );
						}

						// Update the date
						const videoDate = modal.querySelector( '.godam-video-date' );
						if ( videoDate ) {
							videoDate.textContent = data.date || '';
						}

						// Reinitialize the player with the new content
						if ( typeof GODAMPlayer === 'function' ) {
							GODAMPlayer( modal );
							// Find the video player and start playing
							const videoPlayer = modal.querySelector( '.video-js' );
							if ( videoPlayer && videoPlayer.player ) {
								videoPlayer.player.play();
							}
						}
					}
				} else if ( videoContainer ) {
					videoContainer.innerHTML = '<div class="godam-error-message">Video could not be loaded.</div>';
					videoContainer.classList.remove( 'animate-video-loading' );
				}
			} catch ( error ) {
				// Handle error case
				if ( videoContainer ) {
					videoContainer.innerHTML = '<div class="godam-error-message">Video could not be loaded.</div>';
					videoContainer.classList.remove( 'animate-video-loading' );
				}
			} finally {
				// Reset loading state
				modal.dataset.isLoading = 'false';
			}
		};

		// Initialize the video player
		if ( typeof GODAMPlayer === 'function' ) {
			GODAMPlayer( modal );
			// Find the video player and start playing
			const videoPlayer = modal.querySelector( '.video-js' );
			if ( videoPlayer && videoPlayer.player ) {
				videoPlayer.player.play();
			}
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
			// Re-enable background scrolling
			document.body.style.overflow = '';
		};

		modal.querySelector( '.godam-modal-close' )?.addEventListener( 'click', close );
		modal.addEventListener( 'click', ( err ) => {
			if ( ! err.target.closest( '.godam-modal-content' ) ) {
				close();
			}
		} );

		// Load initial video
		await loadNewVideo( videoId );

		// Function to get current video items (updates after loading more)
		const getCurrentVideoItems = () => {
			return currentGallery.querySelectorAll( '.godam-video-item' );
		};

		// Function to handle loading more videos when needed
		const loadMoreIfNeeded = async ( currentIndex, videoItems ) => {
			// Check if we're at the last video and there are more videos available
			if ( currentIndex === videoItems.length - 1 ) {
				const currentVideoCount = videoItems.length;

				// Check if there are more videos to load
				if ( currentVideoCount < galleryTotal ) {
					// Calculate current offset
					const currentOffset = galleryOffset + currentVideoCount;

					// Try to load more videos
					const newOffset = await loadMoreVideos(
						currentGallery,
						currentOffset,
						galleryColumns,
						galleryOrderby,
						galleryOrder,
						galleryTotal,
					);

					// If successfully loaded more videos, return true
					if ( newOffset ) {
						// Update the load more button if it exists
						const loadMoreBtn = currentGallery.nextElementSibling;
						if ( loadMoreBtn && loadMoreBtn.classList.contains( 'godam-load-more' ) ) {
							loadMoreBtn.setAttribute( 'data-offset', newOffset );

							// Hide button if all videos are loaded
							if ( newOffset >= galleryTotal ) {
								loadMoreBtn.remove();
							}
						}
						return true;
					}
				}
			}
			return false;
		};

		// Scroll functionality for desktop (wheel events)
		const SCROLL_COOLDOWN = 800; // milliseconds
		let lastScrollTime = 0;
		let scrollTimeout;

		modal.addEventListener( 'wheel', async ( event ) => {
			event.preventDefault(); // Prevent background scroll
			event.stopPropagation(); // Prevent event bubbling

			// Clear any existing timeout
			clearTimeout( scrollTimeout );

			// Set a new timeout for debouncing
			scrollTimeout = setTimeout( async () => {
				const currentTime = Date.now();
				if ( currentTime - lastScrollTime < SCROLL_COOLDOWN ) {
					return;
				}

				// Get current video items (refreshed)
				let videoItems = getCurrentVideoItems();

				// Get current video index
				const currentId = modal.dataset.currentVideoId;
				const currentIndex = Array.from( videoItems ).findIndex( ( item ) =>
					item.querySelector( '.godam-video-thumbnail' ).getAttribute( 'data-video-id' ) === currentId,
				);

				if ( currentIndex === -1 ) {
					return;
				}

				let newIndex;

				if ( event.deltaY > 0 ) {
					// Scrolling down (next video)
					if ( currentIndex === videoItems.length - 1 ) {
						// At last video, try to load more
						const moreLoaded = await loadMoreIfNeeded( currentIndex, videoItems );
						if ( moreLoaded ) {
							// Refresh video items after loading more
							videoItems = getCurrentVideoItems();
							newIndex = currentIndex + 1;
						} else {
							// No more videos available, do nothing
							return;
						}
					} else {
						newIndex = currentIndex + 1;
					}
				} else {
					// Scrolling up (previous video)
					if ( currentIndex === 0 ) {
						// At first video, do nothing
						return;
					}
					newIndex = currentIndex - 1;
				}

				// Get the new video ID
				const newThumbnail = videoItems[ newIndex ]?.querySelector( '.godam-video-thumbnail' );
				if ( newThumbnail ) {
					const newVideoId = newThumbnail.getAttribute( 'data-video-id' );
					if ( newVideoId && newVideoId !== currentId ) {
						lastScrollTime = currentTime;
						loadNewVideo( newVideoId );
					}
				}
			}, 150 ); // Debounce delay
		}, { passive: false } );

		// Touch functionality for mobile
		let touchStartY = 0;
		let touchEndY = 0;

		modal.addEventListener( 'touchstart', ( err ) => {
			touchStartY = err.touches[ 0 ].clientY;
		}, { passive: false } );

		modal.addEventListener( 'touchmove', ( err ) => {
			err.preventDefault(); // Prevent background scroll
			err.stopPropagation(); // Prevent event bubbling
		}, { passive: false } );

		modal.addEventListener( 'touchend', async ( err ) => {
			touchEndY = err.changedTouches[ 0 ].clientY;
			const touchDiff = touchStartY - touchEndY;

			// Minimum swipe distance
			if ( Math.abs( touchDiff ) < 50 ) {
				return;
			}

			// Clear any existing timeout
			clearTimeout( scrollTimeout );

			// Set a new timeout for debouncing
			scrollTimeout = setTimeout( async () => {
				const currentTime = Date.now();
				if ( currentTime - lastScrollTime < SCROLL_COOLDOWN ) {
					return;
				}

				// Get current video items (refreshed)
				let videoItems = getCurrentVideoItems();

				// Get current video index
				const currentId = modal.dataset.currentVideoId;
				const currentIndex = Array.from( videoItems ).findIndex( ( item ) =>
					item.querySelector( '.godam-video-thumbnail' ).getAttribute( 'data-video-id' ) === currentId,
				);

				if ( currentIndex === -1 ) {
					return;
				}

				let newIndex;

				if ( touchDiff > 0 ) {
					// Swiping up (next video)
					if ( currentIndex === videoItems.length - 1 ) {
						// At last video, try to load more
						const moreLoaded = await loadMoreIfNeeded( currentIndex, videoItems );
						if ( moreLoaded ) {
							// Refresh video items after loading more
							videoItems = getCurrentVideoItems();
							newIndex = currentIndex + 1;
						} else {
							// No more videos available, do nothing
							return;
						}
					} else {
						newIndex = currentIndex + 1;
					}
				} else {
					// Swiping down (previous video)
					if ( currentIndex === 0 ) {
						// At first video, do nothing
						return;
					}
					newIndex = currentIndex - 1;
				}

				// Get the new video ID
				const newThumbnail = videoItems[ newIndex ]?.querySelector( '.godam-video-thumbnail' );
				if ( newThumbnail ) {
					const newVideoId = newThumbnail.getAttribute( 'data-video-id' );
					if ( newVideoId && newVideoId !== currentId ) {
						lastScrollTime = currentTime;
						loadNewVideo( newVideoId );
					}
				}
			}, 150 ); // Debounce delay
		}, { passive: false } );
	}
} );
