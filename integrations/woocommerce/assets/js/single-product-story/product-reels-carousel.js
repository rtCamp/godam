/**
 * Product Reels Carousel – frontend navigation + sequential autoplay.
 *
 * Features:
 * 1. Prev / next arrow navigation with scroll-based visibility.
 * 2. Sequential autoplay – videos play one after another in order.
 * 3. Click / tap to jump sequence to a specific video.
 * 4. Swipe detection on touch devices to switch the active video.
 * 5. IntersectionObserver gates autoplay to only run when the carousel is ≥ 50 % visible in the viewport.
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
		let isAutoScrolling = false; // true while a programmatic scroll is in progress

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
		 * Scroll the carousel so the item at `index` is visible.
		 *
		 * @param {number} index
		 */
		function scrollToItem( index ) {
			const item = items[ index ];
			if ( ! item ) {
				return;
			}
			isAutoScrolling = true;
			item.scrollIntoView( { behavior: 'smooth', inline: 'center', block: 'nearest' } );

			// Reset after the smooth scroll has had time to settle.
			setTimeout( () => {
				isAutoScrolling = false;
			}, 500 );
		}

		// ── Sequential autoplay ─────────────────────────────

		/**
		 * Start (or resume) the sequential playback at `sequenceIndex`.
		 */
		function startSequence() {
			if ( ! galleryVisible ) {
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

		// ── Scroll-snap detection ─────────────────────────────
		// After the user scrolls (swipe on touch, wheel/drag on desktop)
		// and scroll-snap settles, detect which item is closest to the
		// container center and jump the sequence to it.

		let scrollTimer = null;

		container.addEventListener( 'scroll', () => {
			// Don't react to scrolls triggered by scrollToItem().
			if ( isAutoScrolling ) {
				return;
			}

			if ( scrollTimer ) {
				clearTimeout( scrollTimer );
			}
			scrollTimer = setTimeout( () => {
				const rect = container.getBoundingClientRect();
				const center = rect.left + ( rect.width / 2 );
				let closest = 0;
				let minDist = Infinity;

				items.forEach( ( item, i ) => {
					const r = item.getBoundingClientRect();
					const mid = r.left + ( r.width / 2 );
					const dist = Math.abs( mid - center );
					if ( dist < minDist ) {
						minDist = dist;
						closest = i;
					}
				} );

				if ( closest !== sequenceIndex && galleryVisible ) {
					jumpSequenceTo( closest );
				}
			}, 150 );
		}, { passive: true } );

		// ── Visibility observer ───────────────────────────────

		const visibilityObserver = new IntersectionObserver(
			( entries ) => {
				entries.forEach( ( entry ) => {
					const wasVisible = galleryVisible;
					galleryVisible = entry.isIntersecting;

					if ( galleryVisible && ! wasVisible ) {
						// Carousel scrolled into view → start sequence.
						startSequence();
					} else if ( ! galleryVisible && wasVisible ) {
						// Carousel scrolled out of view → pause everything.
						pauseAll();
					}
				} );
			},
			{ threshold: VISIBILITY_THRESHOLD },
		);

		visibilityObserver.observe( gallery );

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
