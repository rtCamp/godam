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

		// Get gallery pagination info
		const galleryColumns = parseInt( currentGallery.getAttribute( 'data-columns' ) || 3, 10 );
		const galleryOrderby = currentGallery.getAttribute( 'data-orderby' ) || 'date';
		const galleryOrder = currentGallery.getAttribute( 'data-order' ) || 'DESC';
		const galleryTotal = parseInt( currentGallery.getAttribute( 'data-total' ) || 0, 10 );

		// Create brand new modal with inline styles
		const modal = document.createElement( 'div' );
		modal.className = 'godam-video-id-modal';
		modal.dataset.currentVideoId = videoId;
		modal.dataset.isLoading = 'false';
		modal.innerHTML = `
			<div class="godam-modal-overlay"></div>
			<div class="godam-modal-content">
				<span class="godam-modal-close">&times;</span>
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

		// Function to update modal with new video ID
		const updateModalVideo = ( newVideoId ) => {
			modal.dataset.currentVideoId = newVideoId;
			modal.querySelector( '.godam-video-id-text' ).textContent = `Video ID: ${ newVideoId }`;
		};

		// Get all video items in the gallery
		const getVideoItems = () => currentGallery.querySelectorAll( '.godam-video-thumbnail' );

		// Scroll handler for navigating videos
		let scrollTimeout;
		const handleScroll = async ( event ) => {
			event.preventDefault();

			// Prevent multiple loads
			if ( modal.dataset.isLoading === 'true' ) {
				return;
			}

			clearTimeout( scrollTimeout );
			scrollTimeout = setTimeout( async () => {
				const videoItems = Array.from( getVideoItems() );
				const currentId = modal.dataset.currentVideoId;
				const currentIndex = videoItems.findIndex( ( item ) => item.getAttribute( 'data-video-id' ) === currentId );

				if ( currentIndex === -1 ) {
					return;
				}

				let newIndex;
				if ( event.deltaY > 0 ) {
					// Scroll down - next video
					newIndex = currentIndex + 1;

					// If at last video, try to load more
					if ( newIndex >= videoItems.length ) {
						const currentVideoCount = videoItems.length;

						// Check if there are more videos to load
						if ( currentVideoCount < galleryTotal ) {
							modal.dataset.isLoading = 'true';
							modal.querySelector( '.godam-video-id-text' ).textContent = 'Loading...';

							const newOffset = await loadMoreVideos(
								currentGallery,
								currentVideoCount,
								galleryColumns,
								galleryOrderby,
								galleryOrder,
								galleryTotal,
							);

							modal.dataset.isLoading = 'false';

							if ( newOffset ) {
								// Refresh video items and show the next video
								const updatedVideoItems = Array.from( getVideoItems() );
								const nextVideo = updatedVideoItems[ newIndex ];
								if ( nextVideo ) {
									const newVideoId = nextVideo.getAttribute( 'data-video-id' );
									if ( newVideoId ) {
										updateModalVideo( newVideoId );
									}
								}
							} else {
								// No more videos, restore current
								updateModalVideo( currentId );
							}
						}
						return;
					}
				} else {
					// Scroll up - previous video
					newIndex = currentIndex - 1;
					if ( newIndex < 0 ) {
						return; // At first video
					}
				}

				const newVideoId = videoItems[ newIndex ].getAttribute( 'data-video-id' );
				if ( newVideoId ) {
					updateModalVideo( newVideoId );
				}
			}, 100 );
		};

		// Add scroll listener
		document.addEventListener( 'wheel', handleScroll, { passive: false } );

		// Close modal function
		const closeModal = () => {
			document.removeEventListener( 'wheel', handleScroll );
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
