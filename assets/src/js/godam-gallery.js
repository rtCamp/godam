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
								.catch( () => {
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
		const engagements = btn.getAttribute( 'data-engagements' ) === '1';

		// Hide button
		btn.style.display = 'none';

		const newOffset = await loadMoreVideos( gallery, offset, columns, orderby, order, totalVideos, engagements );

		if ( newOffset ) {
			btn.setAttribute( 'data-offset', newOffset );
			btn.style.display = 'block';
		} else {
			btn.remove();
		}
	}
} );

// Handle gallery item clicks - show video ID modal
document.addEventListener( 'click', function( e ) {
	if ( e.target.closest( '.godam-video-thumbnail' ) ) {
		const thumbnail = e.target.closest( '.godam-video-thumbnail' );
		const videoId = thumbnail.getAttribute( 'data-video-id' );
		const videoUrl = thumbnail.getAttribute( 'data-video-url' );

		if ( ! videoId ) {
			return;
		}

		// Get the current gallery
		const currentGallery = thumbnail.closest( '.godam-video-gallery' );
		if ( ! currentGallery ) {
			return;
		}

		// If the gallery is configured to open videos in a new page, do so and skip the modal
		const openToNewPage = currentGallery.getAttribute( 'data-open-to-new-page' ) === '1';
		if ( openToNewPage && videoUrl ) {
			window.open( DOMPurify.sanitize( videoUrl ), '_blank' );
			return;
		}

		// Get gallery pagination info
		const galleryColumns = parseInt( currentGallery.getAttribute( 'data-columns' ) || 3, 10 );
		const galleryOrderby = currentGallery.getAttribute( 'data-orderby' ) || 'date';
		const galleryOrder = currentGallery.getAttribute( 'data-order' ) || 'DESC';
		const galleryTotal = parseInt( currentGallery.getAttribute( 'data-total' ) || 0, 10 );

		// Create brand new modal with inline styles
		const modal = document.createElement( 'div' );
		modal.className = 'godam-video-id-modal';
		modal.dataset.currentVideoId = videoId;
		modal.dataset.isLoading = 'true';
		modal.innerHTML = `
			<div class="godam-modal-overlay">
				<div class="godam-overlay-loading-spinner"></div>
			</div>
			<div class="godam-modal-content godam-modal-content-hidden">
				<button class="godam-modal-close">&times;</button>
				<div class="godam-modal-body">
					<iframe
						src="${ DOMPurify.sanitize( videoUrl ) }"
						title="Godam Video Player"
						frameborder="0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
					></iframe>
				</div>
			</div>
		`;

		document.body.appendChild( modal );
		document.body.style.overflow = 'hidden';

		// Get iframe and elements
		const iframe = modal.querySelector( 'iframe' );
		const overlaySpinner = modal.querySelector( '.godam-overlay-loading-spinner' );
		const modalContent = modal.querySelector( '.godam-modal-content' );

		// Show modal content when iframe loads
		iframe.addEventListener( 'load', () => {
			overlaySpinner.style.display = 'none';
			modalContent.classList.remove( 'godam-modal-content-hidden' );
			modalContent.classList.add( 'godam-modal-content-visible' );
			modal.dataset.isLoading = 'false';
		} );

		// Function to update modal with new video
		const updateModalVideo = ( newVideoId, newVideoUrl, direction = 'next' ) => {
			modal.dataset.currentVideoId = newVideoId;
			modal.dataset.isLoading = 'true';

			const _iframe = modal.querySelector( 'iframe' );
			const _overlaySpinner = modal.querySelector( '.godam-overlay-loading-spinner' );
			const _modalContent = modal.querySelector( '.godam-modal-content' );
			const modalBody = modal.querySelector( '.godam-modal-body' );

			if ( _iframe && _overlaySpinner && _modalContent && modalBody ) {
				// Show loading on overlay and hide content
				_overlaySpinner.style.display = 'block';
				_modalContent.classList.remove( 'godam-modal-content-visible' );
				_modalContent.classList.add( 'godam-modal-content-hidden' );

				// Add animation class based on direction
				const animationClass = direction === 'next' ? 'slide-out-up' : 'slide-out-down';
				modalBody.classList.add( animationClass );

				// After animation, update iframe
				setTimeout( () => {
					_iframe.src = DOMPurify.sanitize( newVideoUrl );

					modalBody.classList.remove( animationClass );
					const slideInClass = direction === 'next' ? 'slide-in-down' : 'slide-in-up';
					modalBody.classList.add( slideInClass );

					// Remove animation class after transition
					setTimeout( () => {
						modalBody.classList.remove( slideInClass );
					}, 300 );
				}, 300 );
			}
		};

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
					// Try to load more videos
					const newOffset = await loadMoreVideos(
						currentGallery,
						currentVideoCount,
						galleryColumns,
						galleryOrderby,
						galleryOrder,
						galleryTotal,
					);

					// If successfully loaded more videos, return true
					return !! newOffset;
				}
			}
			return false;
		};

		// Function to navigate to next/previous video (used by postMessage handler)
		const navigateVideo = async ( direction ) => {
			// Check if modal is ready for navigation
			if ( modal.dataset.isLoading === 'true' ) {
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

			if ( direction === 'next' ) {
				// Navigate to next video
				if ( currentIndex === videoItems.length - 1 ) {
					// At last video, try to load more
					modal.dataset.isLoading = 'true';
					const moreLoaded = await loadMoreIfNeeded( currentIndex, videoItems );
					modal.dataset.isLoading = 'false';

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
				// Navigate to previous video
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
				const newVideoUrl = newThumbnail.getAttribute( 'data-video-url' );
				if ( newVideoId && newVideoId !== currentId && newVideoUrl ) {
					updateModalVideo( newVideoId, newVideoUrl, direction );
				}
			}
		};

		// Scroll functionality with cooldown and threshold
		const SCROLL_COOLDOWN = 1000; // milliseconds
		const SCROLL_THRESHOLD = 200; // Minimum scroll distance to trigger
		let lastScrollTime = 0;
		let scrollTimeout;
		let accumulatedDelta = 0;

		const handleScroll = async ( event ) => {
			event.preventDefault(); // Prevent background scroll
			event.stopPropagation(); // Prevent event bubbling

			// Check if modal is ready for scrolling
			if ( modal.dataset.isLoading === 'true' ) {
				return;
			}

			// Accumulate scroll delta
			accumulatedDelta += event.deltaY;

			// Clear any existing timeout
			clearTimeout( scrollTimeout );

			// Set a new timeout for debouncing
			scrollTimeout = setTimeout( async () => {
				// Check if accumulated scroll meets threshold
				if ( Math.abs( accumulatedDelta ) < SCROLL_THRESHOLD ) {
					accumulatedDelta = 0;
					return;
				}

				const currentTime = Date.now();
				if ( currentTime - lastScrollTime < SCROLL_COOLDOWN ) {
					accumulatedDelta = 0;
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
					accumulatedDelta = 0;
					return;
				}

				let newIndex;

				if ( accumulatedDelta > 0 ) {
					// Scrolling down (next video)
					if ( currentIndex === videoItems.length - 1 ) {
						// At last video, try to load more
						modal.dataset.isLoading = 'true';
						const moreLoaded = await loadMoreIfNeeded( currentIndex, videoItems );
						modal.dataset.isLoading = 'false';

						if ( moreLoaded ) {
							// Refresh video items after loading more
							videoItems = getCurrentVideoItems();
							newIndex = currentIndex + 1;
						} else {
							// No more videos available, do nothing
							accumulatedDelta = 0;
							return;
						}
					} else {
						newIndex = currentIndex + 1;
					}
				} else {
					// Scrolling up (previous video)
					if ( currentIndex === 0 ) {
						// At first video, do nothing
						accumulatedDelta = 0;
						return;
					}
					newIndex = currentIndex - 1;
				}

				// Get the new video ID
				const newThumbnail = videoItems[ newIndex ]?.querySelector( '.godam-video-thumbnail' );
				if ( newThumbnail ) {
					const newVideoId = newThumbnail.getAttribute( 'data-video-id' );
					const newVideoUrl = newThumbnail.getAttribute( 'data-video-url' );
					if ( newVideoId && newVideoId !== currentId && newVideoUrl ) {
						lastScrollTime = currentTime;
						accumulatedDelta = 0;

						const direction = accumulatedDelta > 0 ? 'next' : 'prev';
						updateModalVideo( newVideoId, newVideoUrl, direction );
					}
				}

				accumulatedDelta = 0;
			}, 150 ); // Debounce delay
		};

		// Touch functionality for mobile
		let touchStartY = 0;
		let touchEndY = 0;

		const handleTouchStart = ( err ) => {
			touchStartY = err.touches[ 0 ].clientY;
		};

		const handleTouchMove = ( err ) => {
			err.preventDefault(); // Prevent background scroll
			err.stopPropagation(); // Prevent event bubbling
		};

		const handleTouchEnd = async ( err ) => {
			touchEndY = err.changedTouches[ 0 ].clientY;
			const touchDiff = touchStartY - touchEndY;

			// Check if modal is ready
			if ( modal.dataset.isLoading === 'true' ) {
				return;
			}

			// Minimum swipe distance
			if ( Math.abs( touchDiff ) < SCROLL_THRESHOLD ) {
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
						modal.dataset.isLoading = 'true';
						const moreLoaded = await loadMoreIfNeeded( currentIndex, videoItems );
						modal.dataset.isLoading = 'false';

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
					const newVideoUrl = newThumbnail.getAttribute( 'data-video-url' );
					if ( newVideoId && newVideoId !== currentId && newVideoUrl ) {
						lastScrollTime = currentTime;

						const direction = touchDiff > 0 ? 'next' : 'prev';
						updateModalVideo( newVideoId, newVideoUrl, direction );
					}
				}
			}, 150 ); // Debounce delay
		};

		// Add scroll listener
		document.addEventListener( 'wheel', handleScroll, { passive: false } );

		// Add touch listeners
		document.body.addEventListener( 'touchstart', handleTouchStart, { passive: true } );
		document.body.addEventListener( 'touchmove', handleTouchMove, { passive: false } );
		document.body.addEventListener( 'touchend', handleTouchEnd, { passive: false } );

		// Handle postMessage from iframe
		const handlePostMessage = async ( event ) => {
			// Only handle messages when modal exists and is open
			if ( ! modal || ! document.body.contains( modal ) ) {
				return;
			}

			// Verify message is from the iframe (check origin if needed)
			// For security, you might want to check event.origin
			if ( event.data && event.data.type ) {
				if ( event.data.type === 'godamScrollNext' ) {
					await navigateVideo( 'next' );
				} else if ( event.data.type === 'godamScrollPrevious' ) {
					await navigateVideo( 'prev' );
				}
			}
		};

		// Add message listener
		window.addEventListener( 'message', handlePostMessage );

		// Close modal function
		const closeModal = () => {
			document.removeEventListener( 'wheel', handleScroll );
			document.body.removeEventListener( 'touchstart', handleTouchStart );
			document.body.removeEventListener( 'touchmove', handleTouchMove );
			document.body.removeEventListener( 'touchend', handleTouchEnd );
			window.removeEventListener( 'message', handlePostMessage );
			iframe.removeEventListener( 'load', () => {} );
			modal.remove();
			document.body.style.overflow = '';
		};

		// Close on X button click
		modal.querySelector( '.godam-modal-close' ).addEventListener( 'click', closeModal );

		// Close on overlay click
		modal.querySelector( '.godam-modal-overlay' ).addEventListener( 'click', closeModal );

		// Close on ESC key
		const handleEscape = ( event ) => {
			if ( event.key === 'Escape' ) {
				closeModal();
				document.removeEventListener( 'keydown', handleEscape );
			}
		};
		document.addEventListener( 'keydown', handleEscape );
	}
} );
