/**
 * Product Reels Carousel – frontend navigation + sequential autoplay.
 *
 * Features:
 * 1. Prev / next arrow navigation with scroll-based visibility.
 * 2. Sequential autoplay – videos play one after another in order.
 * 3. Click / tap to jump sequence to a specific video.
 * 4. Swipe detection on touch devices to switch the active video.
 * 5. IntersectionObserver gates autoplay to only run when the carousel
 * container is visible in the viewport.
 */
( function() {
	'use strict';

	const VISIBILITY_THRESHOLD = 0.5;

	/**
	 * Initialise a single carousel instance.
	 *
	 * @param {HTMLElement} gallery The `.rtgodam-product-video-gallery` root element.
	 */
	function initCarousel( gallery ) {
		const container = gallery.querySelector( '.rtgodam-product-video-gallery__container' );
		const items = Array.from(
			gallery.querySelectorAll( '.rtgodam-product-video-gallery__item' ),
		);

		if ( ! container || items.length === 0 ) {
			return;
		}

		// ── State ─────────────────────────────────────────────
		let sequenceIndex = 0; // index of the video currently playing in sequence
		let galleryVisible = false; // true when carousel is in viewport
		let hasEnteredViewport = false; // true after the carousel container first enters viewport

		// ── Helpers ───────────────────────────────────────────

		/**
		 * Return the <video> element inside an item, or null.
		 *
		 * @param {number} index Item index.
		 * @return {HTMLVideoElement|null} The video element.
		 */
		function getVideo( index ) {
			const item = items[ index ];
			return item ? item.querySelector( 'video' ) : null;
		}

		/**
		 * Play a video (muted – required by browser autoplay policy).
		 *
		 * @param {HTMLVideoElement} video The video element.
		 */
		function playVideo( video ) {
			if ( ! video ) {
				return;
			}
			video.muted = true;
			video.play().catch( () => {} );
		}

		/**
		 * Pause a video and optionally reset its time.
		 *
		 * @param {HTMLVideoElement} video The video element.
		 * @param {boolean}          reset Whether to reset currentTime to 0.
		 */
		function pauseVideo( video, reset ) {
			if ( ! video ) {
				return;
			}
			video.pause();
			if ( reset ) {
				video.currentTime = 0;
			}
		}

		/**
		 * Pause every video in the carousel.
		 */
		function pauseAll() {
			items.forEach( ( _, i ) => pauseVideo( getVideo( i ), true ) );
		}

		// Ensure every <video> has playsinline for mobile browsers.
		items.forEach( ( item ) => {
			const video = item.querySelector( 'video' );
			if ( video ) {
				video.setAttribute( 'playsinline', '' );
				video.setAttribute( 'webkit-playsinline', '' );
			}
		} );

		// ── Scroll helpers ───────────────────────────────────

		/**
		 * Check if an item is visible inside the scroll container.
		 *
		 * @param {number} index Item index.
		 * @return {boolean} True if the item is at least partially visible.
		 */
		function isItemInView( index ) {
			const item = items[ index ];
			if ( ! item ) {
				return false;
			}
			const rect = item.getBoundingClientRect();
			const cRect = container.getBoundingClientRect();
			return rect.left < cRect.right && rect.right > cRect.left;
		}

		/**
		 * Scroll the carousel so the item at `index` is visible,
		 * but only if it is not already in the viewport.
		 *
		 * @param {number} index
		 */
		function scrollToItem( index ) {
			const item = items[ index ];
			if ( ! item || isItemInView( index ) ) {
				return;
			}
			item.scrollIntoView( { behavior: 'smooth', inline: 'center', block: 'nearest' } );
		}

		// ── Sequential autoplay ─────────────────────────────

		/**
		 * Start (or resume) the sequential playback at `sequenceIndex`.
		 *
		 * @param {Object}  [options={}]                 Optional sequence start options.
		 * @param {boolean} [options.fromViewport=false] Whether the start was triggered by viewport entry.
		 */
		function startSequence( { fromViewport = false } = {} ) {
			if ( fromViewport ) {
				hasEnteredViewport = true;
			}

			if ( ! galleryVisible || ! hasEnteredViewport ) {
				return;
			}

			const video = getVideo( sequenceIndex );
			if ( video ) {
				scrollToItem( sequenceIndex );
				playVideo( video );
			}
		}

		/**
		 * Advance to the next video in the sequence.
		 */
		function advanceSequence() {
			const prevVideo = getVideo( sequenceIndex );
			pauseVideo( prevVideo, true );

			sequenceIndex = ( sequenceIndex + 1 ) % items.length;
			startSequence();
		}

		/**
		 * Jump the sequence to a specific index, pause the old video,
		 * and start playing the new one from the beginning.
		 *
		 * @param {number} index The item index to jump to.
		 */
		function jumpSequenceTo( index ) {
			if ( index === sequenceIndex ) {
				return;
			}

			pauseVideo( getVideo( sequenceIndex ), true );
			sequenceIndex = index;

			const video = getVideo( sequenceIndex );
			if ( video ) {
				video.currentTime = 0;
				scrollToItem( sequenceIndex );
				playVideo( video );
			}
		}

		// Listen for the `ended` event on every video to advance the sequence.
		items.forEach( ( item, index ) => {
			const video = item.querySelector( 'video' );
			if ( ! video ) {
				return;
			}

			video.addEventListener( 'ended', () => {
				// Only advance if this video was the current sequence video.
				if ( index === sequenceIndex ) {
					advanceSequence();
				}
			} );
		} );

		// ── Click / tap to set sequence ───────────────────────

		items.forEach( ( item, index ) => {
			item.addEventListener( 'click', () => {
				jumpSequenceTo( index );
			} );
		} );

		// ── Active-video visibility observer ──────────────────
		// When the currently playing video scrolls out of the
		// container viewport, find the first visible item and
		// jump the sequence to it.

		const itemObserver = new IntersectionObserver(
			( entries ) => {
				entries.forEach( ( entry ) => {
					const index = items.indexOf( entry.target );

					// Only care when the *active* video leaves the view.
					if ( index !== sequenceIndex || entry.intersectionRatio >= 0.5 || ! galleryVisible ) {
						return;
					}

					// Find the first item (other than current) that is visible.
					const cRect = container.getBoundingClientRect();
					const firstVisible = items.findIndex( ( item, i ) => {
						if ( i === sequenceIndex ) {
							return false;
						}
						const rect = item.getBoundingClientRect();
						return rect.left < cRect.right && rect.right > cRect.left;
					} );

					if ( firstVisible !== -1 && firstVisible !== sequenceIndex ) {
						jumpSequenceTo( firstVisible );
					}
				} );
			},
			{ root: container, threshold: 0.5 },
		);

		items.forEach( ( item ) => itemObserver.observe( item ) );

		// ── Visibility observer ───────────────────────────────

		const visibilityObserver = new IntersectionObserver(
			( entries ) => {
				entries.forEach( ( entry ) => {
					const wasVisible = galleryVisible;
					galleryVisible = entry.isIntersecting && entry.intersectionRatio >= VISIBILITY_THRESHOLD;

					if ( galleryVisible && ! wasVisible ) {
						// Carousel container scrolled into view → start sequence.
						startSequence( { fromViewport: true } );
					} else if ( ! galleryVisible && wasVisible ) {
						// Carousel scrolled out of view → pause everything.
						pauseAll();
					}
				} );
			},
			{ threshold: VISIBILITY_THRESHOLD },
		);

		visibilityObserver.observe( container );

		// ── Arrow navigation ──────────────────────────────────

		const prevBtn = gallery.querySelector( '.rtgodam-product-video-gallery__nav--prev' );
		const nextBtn = gallery.querySelector( '.rtgodam-product-video-gallery__nav--next' );

		function updateNavVisibility() {
			if ( ! prevBtn || ! nextBtn ) {
				return;
			}
			const { scrollLeft, scrollWidth, clientWidth } = container;
			prevBtn.style.display = scrollLeft <= 0 ? 'none' : 'flex';
			nextBtn.style.display = scrollLeft + clientWidth >= scrollWidth - 1 ? 'none' : 'flex';
		}

		function scrollCarousel( direction ) {
			const firstItem = container.querySelector( '.rtgodam-product-video-gallery__item' );
			const itemWidth = firstItem ? firstItem.offsetWidth : 200;
			const gap = parseInt( getComputedStyle( container ).gap ) || 12;
			container.scrollBy( { left: ( itemWidth + gap ) * direction, behavior: 'smooth' } );
		}

		if ( prevBtn ) {
			prevBtn.addEventListener( 'click', () => scrollCarousel( -1 ) );
		}
		if ( nextBtn ) {
			nextBtn.addEventListener( 'click', () => scrollCarousel( 1 ) );
		}

		container.addEventListener( 'scroll', updateNavVisibility );
		window.addEventListener( 'resize', updateNavVisibility );

		// Initial check.
		updateNavVisibility();
	}

	/**
	 * Boot all gallery carousels on the page.
	 */
	function initAll() {
		document.querySelectorAll( '.rtgodam-product-video-gallery' ).forEach( initCarousel );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initAll );
	} else {
		initAll();
	}
}() );
