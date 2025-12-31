/**
 * GoDAM Video Embed Script
 *
 * Listens for scroll events on the video embed page and sends postMessage
 * to the parent window to trigger video navigation.
 *
 * @since n.e.x.t
 */

document.addEventListener( 'DOMContentLoaded', function() {
	// Only run if we're in an iframe
	if ( window.self === window.top ) {
		return;
	}

	// Scroll functionality with cooldown and threshold
	const SCROLL_COOLDOWN = 1000; // milliseconds
	const SCROLL_THRESHOLD = 400; // Minimum scroll distance to trigger
	let lastScrollTime = 0;
	let scrollTimeout;
	let accumulatedDelta = 0;

	// Helper function to check if an element is scrollable
	const isElementScrollable = ( element ) => {
		if ( ! element || element === document.body || element === document.documentElement ) {
			return false;
		}

		const style = window.getComputedStyle( element );
		const overflowY = style.overflowY;
		const overflowX = style.overflowX;
		const isScrollable = ( overflowY === 'auto' || overflowY === 'scroll' ) || ( overflowX === 'auto' || overflowX === 'scroll' );

		if ( ! isScrollable ) {
			return false;
		}

		// Check if element can actually scroll
		const canScrollVertically = element.scrollHeight > element.clientHeight;
		const canScrollHorizontally = element.scrollWidth > element.clientWidth;

		return canScrollVertically || canScrollHorizontally;
	};

	// Helper function to find the scrollable parent of an element
	const findScrollableParent = ( element ) => {
		let current = element;
		while ( current && current !== document.body && current !== document.documentElement ) {
			if ( isElementScrollable( current ) ) {
				return current;
			}
			current = current.parentElement;
		}
		return null;
	};

	// Helper function to check if element can scroll in the given direction
	const canScrollInDirection = ( element, deltaY ) => {
		if ( ! element ) {
			return false;
		}

		if ( deltaY > 0 ) {
			// Scrolling down - check if can scroll down
			return element.scrollTop < element.scrollHeight - element.clientHeight;
		}
		// Scrolling up - check if can scroll up
		return element.scrollTop > 0;
	};

	// Handle wheel scroll events
	const handleScroll = ( event ) => {
		// Find the target element and check if it's within a scrollable container
		const target = event.target;
		const scrollableParent = findScrollableParent( target );

		// If we're scrolling within a scrollable element, check if it can scroll further
		if ( scrollableParent ) {
			const canScroll = canScrollInDirection( scrollableParent, event.deltaY );
			// If the scrollable element can still scroll, don't trigger navigation
			if ( canScroll ) {
				return;
			}
			// If the scrollable element is at its limit, prevent default and allow navigation
			event.preventDefault();
			event.stopPropagation();
		} else {
			// Not in a scrollable container, prevent default and allow navigation
			event.preventDefault();
			event.stopPropagation();
		}

		// Accumulate scroll delta
		accumulatedDelta += event.deltaY;

		// Clear any existing timeout
		clearTimeout( scrollTimeout );

		// Set a new timeout for debouncing
		scrollTimeout = setTimeout( () => {
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

			// Determine scroll direction
			if ( accumulatedDelta > 0 ) {
				// Scrolling down (next video)
				window.parent.postMessage( { type: 'godamScrollNext' }, '*' );
			} else {
				// Scrolling up (previous video)
				window.parent.postMessage( { type: 'godamScrollPrevious' }, '*' );
			}

			lastScrollTime = currentTime;
			accumulatedDelta = 0;
		}, 150 ); // Debounce delay
	};

	// Touch functionality for mobile
	let touchStartY = 0;
	let touchEndY = 0;
	let touchStartElement = null;

	const handleTouchStart = ( event ) => {
		touchStartY = event.touches[ 0 ].clientY;
		touchStartElement = event.target;
	};

	const handleTouchMove = ( event ) => {
		// Find the target element and check if it's within a scrollable container
		const target = event.target;
		const scrollableParent = findScrollableParent( target );

		// If we're touching within a scrollable element, allow normal scrolling
		if ( scrollableParent ) {
			// Check if the scrollable element can scroll
			const canScrollVertically = scrollableParent.scrollHeight > scrollableParent.clientHeight;
			if ( canScrollVertically ) {
				// Allow the scrollable element to handle the scroll
				return;
			}
		}

		// Not in a scrollable container or container can't scroll, prevent default
		event.preventDefault(); // Prevent background scroll
		event.stopPropagation(); // Prevent event bubbling
	};

	const handleTouchEnd = ( event ) => {
		touchEndY = event.changedTouches[ 0 ].clientY;
		const touchDiff = touchStartY - touchEndY;

		// Check if the touch started within a scrollable container
		if ( touchStartElement ) {
			const scrollableParent = findScrollableParent( touchStartElement );
			if ( scrollableParent ) {
				// Check if the scrollable element can scroll in the swipe direction
				const canScrollVertically = scrollableParent.scrollHeight > scrollableParent.clientHeight;
				if ( canScrollVertically ) {
					// Check if element can still scroll in the swipe direction
					const canScroll = canScrollInDirection( scrollableParent, touchDiff );
					if ( canScroll ) {
						// The scrollable element can still scroll, don't trigger navigation
						return;
					}
				}
			}
		}

		// Minimum swipe distance
		if ( Math.abs( touchDiff ) < SCROLL_THRESHOLD ) {
			return;
		}

		// Clear any existing timeout
		clearTimeout( scrollTimeout );

		// Set a new timeout for debouncing
		scrollTimeout = setTimeout( () => {
			const currentTime = Date.now();
			if ( currentTime - lastScrollTime < SCROLL_COOLDOWN ) {
				return;
			}

			// Determine swipe direction
			if ( touchDiff > 0 ) {
				// Swiping up (next video)
				window.parent.postMessage( { type: 'godamScrollNext' }, '*' );
			} else {
				// Swiping down (previous video)
				window.parent.postMessage( { type: 'godamScrollPrevious' }, '*' );
			}

			lastScrollTime = currentTime;
		}, 150 ); // Debounce delay
	};

	// Add scroll listener
	document.addEventListener( 'wheel', handleScroll, { passive: false } );

	// Add touch listeners
	document.body.addEventListener( 'touchstart', handleTouchStart, { passive: true } );
	document.body.addEventListener( 'touchmove', handleTouchMove, { passive: false } );
	document.body.addEventListener( 'touchend', handleTouchEnd, { passive: false } );
} );

/**
 * Render CommentBox component on video embed page by default.
 *
 * @since n.e.x.t
 */
document.addEventListener( 'DOMContentLoaded', function() {
	const urlParams = new URLSearchParams( window.location.search );
	const videoId = urlParams.get( 'id' );

	if ( ! videoId ) {
		return;
	}

	const videoIdNum = parseInt( videoId, 10 );
	if ( ! videoIdNum || isNaN( videoIdNum ) ) {
		return;
	}

	// Create and show loading overlay
	const loadingOverlay = document.createElement( 'div' );
	loadingOverlay.className = 'godam-video-embed-loading';
	loadingOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: #fff; z-index: 9999; display: flex; align-items: center; justify-content: center;';

	// Create spinner element
	const spinner = document.createElement( 'div' );
	spinner.className = 'godam-video-embed-spinner';
	loadingOverlay.appendChild( spinner );

	document.body.appendChild( loadingOverlay );

	// Function to hide loading overlay
	const hideLoadingOverlay = () => {
		if ( loadingOverlay && loadingOverlay.parentNode ) {
			loadingOverlay.style.opacity = '0';
			loadingOverlay.style.pointerEvents = 'none';
			loadingOverlay.style.transition = 'opacity 0.3s ease-out';
			setTimeout( () => {
				loadingOverlay.remove();
			}, 300 );
		}
	};

	// Listen for the engagement store to be initialized.
	document.addEventListener( 'engagementStoreInitialized', renderCommentBox );

	// Render the comment box.
	function renderCommentBox() {
		// Check WordPress dependencies
		if ( typeof wp === 'undefined' || ! wp.data || ! wp.element?.createRoot ) {
			return;
		}

		const storeName = 'godam-video-engagement';
		const select = wp.data.select( storeName );
		const dispatch = wp.data.dispatch( storeName );

		if ( ! select || ! dispatch ) {
			return;
		}

		// Find video element and get instance ID
		const videoElement = document.querySelector( `.easydam-player.video-js[data-id="${ videoIdNum }"]` );
		const videoInstanceId = videoElement?.getAttribute( 'data-instance-id' );

		if ( ! videoInstanceId ) {
			return;
		}

		// Get site URL
		const siteUrl = window.location.origin;

		// Determine if engagements should be shown
		const embedElement = document.querySelector( '.godam-video-embed' );
		const skipEngagements = embedElement?.getAttribute( 'data-show-engagements' ) !== 'true';

		// Dispatch action to initiate comment modal
		dispatch.initiateCommentModal(
			videoIdNum.toString(),
			siteUrl,
			`engagement-${ videoInstanceId }`,
			skipEngagements,
			true,
		);

		// Hide loading overlay after modal is initiated
		hideLoadingOverlay();
	}
} );

