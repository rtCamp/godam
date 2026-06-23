/**
 * Frontend runtime for GoDAM Gallery V2.
 */

/**
 * WordPress dependencies
 */
const { __ } = require( '@wordpress/i18n' );

( function() {
	'use strict';

	let activeGallery = null;
	let sharedModal = null;

	/*
	 * Pull pending heatmap payloads out of the iframe and POST them from
	 * THIS context. Sending from the iframe right before teardown gets
	 * cancelled by the browser; sending from here survives because the
	 * parent window is not being destroyed. Caller is responsible for
	 * tearing the iframe down after this returns.
	 *
	 * Same-origin direct call — no postMessage round-trip, fully synchronous.
	 * Cross-origin or missing function: silently no-op.
	 *
	 * `keepalive: true` is defense-in-depth here, not the primary mechanism
	 * (the parent isn't unloading). It only matters if the user closes the
	 * entire tab during the close handler's brief window — in that case
	 * keepalive lets the request still reach the wire.
	 */
	function flushIframeAnalytics( iframe ) {
		try {
			const win = iframe?.contentWindow;
			if ( ! win || typeof win.godamGalleryFlushPayloads !== 'function' ) {
				return;
			}
			win.godamGalleryFlushPayloads().forEach( ( payload ) => {
				if ( ! payload?.endpoint || ! payload?.body ) {
					return;
				}
				fetch( `${ payload.endpoint }/analytics/`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify( payload.body ),
					keepalive: true,
				} ).catch( () => {} );
			} );
		} catch ( e ) {
			// Cross-origin access or function threw — silently no-op.
		}
	}

	function initBlurUpPlaceholders( root = document ) {
		root.querySelectorAll( '.godam-gallery-blurred-img' ).forEach( ( div ) => {
			if ( div.dataset.godamGalleryBlurInit === '1' ) {
				return;
			}
			div.dataset.godamGalleryBlurInit = '1';

			const img = div.querySelector( 'img' );
			if ( ! img ) {
				return;
			}

			const markLoaded = () => div.classList.add( 'loaded' );
			const markError = () => {
				div.style.backgroundImage = '';
				div.classList.add( 'loaded' );
			};

			if ( img.complete && img.naturalWidth > 0 ) {
				markLoaded();
			} else {
				img.addEventListener( 'load', markLoaded, { once: true } );
				img.addEventListener( 'error', markError, { once: true } );
			}
		} );
	}

	function handleModalKeydown( event ) {
		if ( ! activeGallery ) {
			return;
		}

		if ( event.key === 'Escape' ) {
			activeGallery.closeModal();
		} else if ( event.key === 'ArrowLeft' ) {
			activeGallery.navigateModal( -1 );
		} else if ( event.key === 'ArrowRight' ) {
			activeGallery.navigateModal( 1 );
		} else if ( event.key === 'Tab' ) {
			const focusable = Array.from(
				activeGallery.modal.modal.querySelectorAll(
					'iframe, button.is-active',
				),
			);

			if ( focusable.length === 0 ) {
				return;
			}

			const first = focusable[ 0 ];
			const last = focusable[ focusable.length - 1 ];
			const active = activeGallery.modal.modal.ownerDocument.activeElement;

			if ( event.shiftKey && active === first ) {
				event.preventDefault();
				last.focus();
			} else if ( ! event.shiftKey && active === last ) {
				event.preventDefault();
				first.focus();
			}
		}
	}

	function getSharedModal() {
		if ( sharedModal ) {
			return sharedModal;
		}

		const overlay = document.createElement( 'div' );
		overlay.className = 'godam-gallery-v2-modal-overlay';
		document.body.appendChild( overlay );

		const modal = document.createElement( 'div' );
		modal.className = 'godam-gallery-v2-modal';
		modal.setAttribute( 'role', 'dialog' );
		modal.setAttribute( 'aria-modal', 'true' );
		modal.setAttribute( 'aria-label', __( 'Video player', 'godam' ) );
		document.body.appendChild( modal );

		const iframe = document.createElement( 'iframe' );
		iframe.className = 'godam-gallery-v2-modal__iframe';
		iframe.setAttribute( 'allowfullscreen', 'allowfullscreen' );
		iframe.setAttribute( 'loading', 'lazy' );
		iframe.setAttribute( 'title', __( 'Video player', 'godam' ) );
		modal.appendChild( iframe );

		const closeButton = document.createElement( 'button' );
		closeButton.type = 'button';
		closeButton.className = 'godam-gallery-v2-modal__close';
		closeButton.setAttribute( 'aria-label', __( 'Close', 'godam' ) );
		closeButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
		modal.appendChild( closeButton );

		const prevButton = document.createElement( 'button' );
		prevButton.type = 'button';
		prevButton.className = 'godam-gallery-v2-modal__nav godam-gallery-v2-modal__nav--prev';
		prevButton.setAttribute( 'aria-label', __( 'Previous video', 'godam' ) );
		prevButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
		modal.appendChild( prevButton );

		const nextButton = document.createElement( 'button' );
		nextButton.type = 'button';
		nextButton.className = 'godam-gallery-v2-modal__nav godam-gallery-v2-modal__nav--next';
		nextButton.setAttribute( 'aria-label', __( 'Next video', 'godam' ) );
		nextButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
		modal.appendChild( nextButton );

		overlay.addEventListener( 'click', () => {
			if ( activeGallery ) {
				activeGallery.closeModal();
			}
		} );

		closeButton.addEventListener( 'click', () => {
			if ( activeGallery ) {
				activeGallery.closeModal();
			}
		} );

		prevButton.addEventListener( 'click', () => {
			if ( activeGallery ) {
				activeGallery.navigateModal( -1 );
			}
		} );

		nextButton.addEventListener( 'click', () => {
			if ( activeGallery ) {
				activeGallery.navigateModal( 1 );
			}
		} );

		document.addEventListener( 'keydown', handleModalKeydown );

		sharedModal = {
			overlay,
			modal,
			iframe,
			closeButton,
			prevButton,
			nextButton,
		};

		return sharedModal;
	}

	const HOVER_INTENT_DELAY_MS = 200;

	class GalleryV2 {
		constructor( element ) {
			this.element = element;
			this.mode = element.dataset.mode || 'handpicked';
			this.embedBaseUrl = element.dataset.embedBaseUrl || '/';
			this.engagements = element.dataset.engagements || '';
			this.autoplay = element.dataset.autoplay === 'true';
			this.playOnHover = element.dataset.playOnHover !== 'false';
			this.currentIndex = -1;
			this.previouslyFocusedElement = null;
			this.isLoading = false;
			this.modal = getSharedModal();
			this.queryArea = element.querySelector( '.godam-gallery-v2__query-area' );
			this.queryList = element.querySelector( '.godam-gallery-v2__query-list' );
			this.loadMoreButton = element.querySelector( '.godam-gallery-v2__load-more' );
			this.loadMoreItem = element.querySelector( '.godam-gallery-v2__load-more-item' );
			this.sentinel = element.querySelector( '.godam-gallery-v2__load-sentinel' );
			this.queryRestUrl = this.queryArea?.dataset.queryRestUrl || '';
			this.queryArgs = this.parseQueryArgs( this.queryArea?.dataset.queryArgs || '{}' );
			this.currentOffset = parseInt( this.queryArea?.dataset.currentOffset || '0', 10 );
			this.totalItems = parseInt( this.queryArea?.dataset.totalItems || '0', 10 );
			this.enableMoreItems = this.queryArea?.dataset.enableMoreItems !== 'false';
			this.moreItemsBehavior =
				this.queryArea?.dataset.moreItemsBehavior ||
				( this.queryArea?.dataset.infiniteScroll === 'true' ? 'infinite' : 'button' );
			this.infiniteScroll =
				this.enableMoreItems && this.moreItemsBehavior === 'infinite';
			this.items = [];

			// Autoplay / hover-play state (mirrors shoppable video block).
			this.autoplayActiveItem = null;
			this.hoverActiveItem = null;
			this.hoverIntentTimers = new Map();
			this.loadedVideos = new Set();
			this.modalOpen = false;

			// Track items that already have preview listeners attached.
			this.initializedPreviewItems = new WeakSet();

			this.refreshItems();
			initBlurUpPlaceholders( this.element );
			this.bindEvents();
			this.initInfiniteScroll();
			this.updateLoadControls();
			this.initVideoPreview();
			this.initFirstFrameThumbnails();
		}

		parseQueryArgs( value ) {
			try {
				return JSON.parse( value );
			} catch ( error ) {
				return {};
			}
		}

		refreshItems() {
			this.items = Array.from(
				this.element.querySelectorAll( '[data-godam-gallery-v2-trigger="true"]' ),
			);
		}

		bindEvents() {
			this.element.addEventListener( 'click', ( event ) => {
				const loadMoreButton = event.target.closest( '.godam-gallery-v2__load-more' );
				if ( loadMoreButton && this.loadMoreButton === loadMoreButton ) {
					event.preventDefault();
					this.loadMoreItems();
					return;
				}

				const trigger = event.target.closest( '[data-godam-gallery-v2-trigger="true"]' );
				if ( ! trigger || ! this.element.contains( trigger ) ) {
					return;
				}

				this.refreshItems();
				const index = this.items.indexOf( trigger );
				if ( index !== -1 ) {
					this.openModalByIndex( index );
				}
			} );
		}

		initInfiniteScroll() {
			if (
				this.mode !== 'query' ||
				! this.enableMoreItems ||
				! this.infiniteScroll ||
				! this.sentinel ||
				! this.hasMorePages()
			) {
				return;
			}

			const options = {
				root: this.element.dataset.layout === 'carousel' ? this.queryList : null,
				rootMargin: '200px',
				threshold: 0.1,
			};

			this.observer = new IntersectionObserver( ( entries ) => {
				entries.forEach( ( entry ) => {
					if ( entry.isIntersecting ) {
						this.loadMoreItems();
					}
				} );
			}, options );

			this.observer.observe( this.sentinel );
		}

		hasMorePages() {
			return this.mode === 'query' && this.currentOffset < this.totalItems;
		}

		updateLoadControls() {
			if ( ! this.queryArea ) {
				return;
			}

			this.queryArea.dataset.currentOffset = String( this.currentOffset );
			this.queryArea.dataset.totalItems = String( this.totalItems );

			if ( this.loadMoreButton ) {
				const shouldShow =
					this.enableMoreItems &&
					! this.infiniteScroll &&
					this.hasMorePages();
				this.loadMoreButton.hidden = ! shouldShow;
				this.loadMoreButton.disabled = this.isLoading;
				this.loadMoreButton.classList.toggle( 'is-loading', this.isLoading );
			}

			if ( this.loadMoreItem ) {
				this.loadMoreItem.hidden = this.loadMoreButton ? this.loadMoreButton.hidden : true;
			}

			if ( this.sentinel ) {
				this.sentinel.hidden =
					! this.enableMoreItems ||
					! this.infiniteScroll ||
					! this.hasMorePages();
			}

			if ( this.observer && ! this.hasMorePages() ) {
				this.observer.disconnect();
				this.observer = null;
			}
		}

		async loadMoreItems() {
			if ( this.isLoading || ! this.hasMorePages() || ! this.queryRestUrl ) {
				return;
			}

			this.isLoading = true;
			this.updateLoadControls();

			const params = new URLSearchParams( {
				...this.queryArgs,
				offset: String( this.currentOffset ),
			} );

			const separator = this.queryRestUrl.includes( '?' ) ? '&' : '?';

			try {
				const response = await fetch( `${ this.queryRestUrl }${ separator }${ params.toString() }`, {
					credentials: 'same-origin',
				} );

				if ( ! response.ok ) {
					throw new Error( 'Failed to load gallery items.' );
				}

				const data = await response.json();

				if ( data?.status === 'success' && data?.html ) {
					const template = document.createElement( 'template' );
					template.innerHTML = data.html.trim();
					const newQueryItems = Array.from(
						template.content.querySelectorAll( '.godam-gallery-v2__query-item' ),
					);

					if ( newQueryItems.length > 0 ) {
						const insertionTarget = this.loadMoreItem || this.sentinel;
						this.queryList.insertBefore( template.content, insertionTarget );
						this.currentOffset += newQueryItems.length;
						initBlurUpPlaceholders( this.element );
					} else {
						this.currentOffset = this.totalItems;
					}
				} else {
					this.currentOffset = this.totalItems;
				}
				this.refreshItems();
				this.initFirstFrameThumbnails();
				this.initNewItemsBehavior();
			} catch ( error ) {
				// eslint-disable-next-line no-console
				console.error( 'Error loading more gallery items:', error );
			} finally {
				this.isLoading = false;
				this.updateLoadControls();
			}
		}

		// ── Video preview (autoplay / hover-play) ────────────────────────────

		/**
		 * Initialise hover and autoplay for all tiles that have a preview video.
		 */
		initVideoPreview() {
			if ( ! this.autoplay && ! this.playOnHover ) {
				return;
			}

			this.items.forEach( ( item ) => this.initVideoPreviewItem( item ) );

			// Proactively load metadata for visible items so hover play is instant.
			this.initViewportPreload();

			if ( this.autoplay ) {
				this.initAutoplayObserver();
			}
		}

		/**
		 * Called after new items are injected by load-more / infinite scroll.
		 * Wires up hover, autoplay, and preload for any uninitialised items.
		 */
		initNewItemsBehavior() {
			if ( ! this.autoplay && ! this.playOnHover ) {
				return;
			}

			// Find items that haven't been initialised yet.
			const uninitialised = this.items.filter(
				( item ) => ! this.initializedPreviewItems.has( item ),
			);

			if ( uninitialised.length === 0 ) {
				return;
			}

			uninitialised.forEach( ( item ) => this.initVideoPreviewItem( item ) );

			// Register new items with the preload observer.
			if ( this.viewportPreloadObserver ) {
				this.initViewportPreload( uninitialised );
			}

			// Register new items with the autoplay observer.
			if ( this.autoplay && this.autoplayObserver ) {
				this.initAutoplayObserver( uninitialised );
			}
		}

		/**
		 * Wire up preview-video behaviour for a single item.
		 * Safe to call multiple times — skips items already initialised.
		 *
		 * @param {Element} item Gallery tile.
		 */
		initVideoPreviewItem( item ) {
			if ( this.initializedPreviewItems.has( item ) ) {
				return;
			}

			const video = item.querySelector( '.godam-gallery-v2-item__preview-video' );
			if ( ! video ) {
				return;
			}

			this.initializedPreviewItems.add( item );
			this.initItemVideoState( item, video );

			if ( this.playOnHover ) {
				item.addEventListener( 'mouseenter', () => this.scheduleItemHoverStart( item ) );
				item.addEventListener( 'mouseleave', () => this.handleItemHoverEnd( item ) );
			}
		}

		/**
		 * Observe items entering/leaving the viewport and preload their video
		 * metadata — mirrors the shoppable video block so hover play is instant.
		 * @param {Element[]} newItems
		 */
		initViewportPreload( newItems = null ) {
			if ( ! this.viewportPreloadObserver ) {
				const observerRoot = this.element.dataset.layout === 'carousel'
					? ( this.element.querySelector( '.godam-gallery-v2__canvas' ) || null )
					: null;

				this.viewportPreloadObserver = new IntersectionObserver(
					( entries ) => {
						entries.forEach( ( entry ) => {
							entry.target.dataset.isPreloadVisible = entry.isIntersecting ? 'true' : 'false';
						} );
						this.updateVideoPreloadStrategy();
					},
					{ root: observerRoot, threshold: 0.1 },
				);
			}

			const targets = newItems || this.items;
			targets.forEach( ( item ) => {
				item.dataset.isPreloadVisible = 'false';
				this.viewportPreloadObserver.observe( item );
			} );

			// Run once immediately so items already in view are preloaded.
			this.updateVideoPreloadStrategy();
		}

		/**
		 * Set preload="metadata" on every visible item's preview video so the
		 * browser fetches metadata before the user hovers.
		 */
		updateVideoPreloadStrategy() {
			this.items.forEach( ( item ) => {
				const video = item.querySelector( '.godam-gallery-v2-item__preview-video' );
				if ( ! video || video.preload === 'metadata' ) {
					return;
				}

				if ( item.dataset.isPreloadVisible === 'true' ) {
					video.preload = 'metadata';
					video.load();
				}
			} );
		}

		/**
		 * For tiles that have no server-side thumbnail, show the preview video
		 * element itself as the thumbnail — the browser renders the first frame
		 * once metadata loads, exactly like the shoppable video block does.
		 *
		 * The pending <img> placeholder is hidden and the item receives
		 * `godam-gallery-v2-item--no-thumb` so CSS keeps the video visible at
		 * all times (not only on hover).
		 */
		initFirstFrameThumbnails() {
			this.items.forEach( ( item ) => {
				const pending = item.querySelector( '.godam-gallery-v2__thumbnail--pending' );
				if ( ! pending ) {
					return;
				}

				const video = item.querySelector( '.godam-gallery-v2-item__preview-video' );
				if ( ! video || ! video.src ) {
					return;
				}

				// Hide the unused placeholder img — the video is the thumbnail now.
				pending.hidden = true;

				// Mark the button so CSS makes the video visible immediately.
				item.classList.add( 'godam-gallery-v2-item--no-thumb' );

				// Start loading metadata so the browser can render the first frame.
				if ( video.preload === 'none' ) {
					video.preload = 'metadata';
					video.load();
				}
			} );
		}

		/**
		 * Track loadeddata / ended events so UI stays in sync.
		 *
		 * @param {Element}          item  The gallery tile.
		 * @param {HTMLVideoElement} video The preview video element.
		 */
		initItemVideoState( item, video ) {
			if ( video._godamGalleryStateBound ) {
				return;
			}
			video._godamGalleryStateBound = true;

			video.addEventListener( 'loadeddata', () => {
				this.loadedVideos.add( video );

				if (
					this.autoplay &&
					! this.modalOpen &&
					item === this.autoplayActiveItem &&
					video.paused
				) {
					video.muted = true;
					video.play().catch( () => {} );
				}
			} );

			video.addEventListener( 'ended', () => {
				if ( this.autoplay && ! this.modalOpen && item === this.autoplayActiveItem ) {
					this.advanceAutoplaySequence( item );
				}
			} );
		}

		/**
		 * Use IntersectionObserver to drive autoplay sequencing by viewport visibility.
		 * @param {Element[]} newItems
		 */
		initAutoplayObserver( newItems = null ) {
			if ( ! this.autoplayObserver ) {
				const observerRoot = this.element.dataset.layout === 'carousel'
					? ( this.element.querySelector( '.godam-gallery-v2__canvas' ) || null )
					: null;

				this.autoplayObserver = new IntersectionObserver(
					( entries ) => {
						entries.forEach( ( entry ) => {
							entry.target.dataset.isInViewport = entry.isIntersecting ? 'true' : 'false';
						} );
						this.syncAutoplaySequence();
					},
					{ root: observerRoot, threshold: 0.5 },
				);
			}

			const targets = newItems || this.items;
			targets.forEach( ( item ) => {
				item.dataset.isInViewport = 'false';
				this.autoplayObserver.observe( item );
			} );
		}

		/**
		 * @param {HTMLVideoElement} video
		 * @return {boolean} Whether the video is currently playing.
		 */
		isVideoPlaying( video ) {
			return !! ( video && ! video.paused && ! video.ended );
		}

		/**
		 * Start or stop preview playback for a tile.
		 *
		 * @param {Element} item       Gallery tile.
		 * @param {boolean} shouldPlay Whether to play.
		 * @param {Object}  options    { restart, muted, reset }
		 */
		syncPreviewVideo( item, shouldPlay, options = {} ) {
			const video = item?.querySelector( '.godam-gallery-v2-item__preview-video' );
			if ( ! video ) {
				return;
			}

			if ( shouldPlay ) {
				const shouldMute = Object.prototype.hasOwnProperty.call( options, 'muted' )
					? !! options.muted
					: true;

				const attemptPlay = () => {
					if ( this.hoverActiveItem === item || this.autoplayActiveItem === item ) {
						video.muted = shouldMute;
						if ( options.restart ) {
							video.currentTime = 0;
						}
						video.play().catch( () => {} );
					}
				};

				if ( this.loadedVideos.has( video ) ) {
					attemptPlay();
				} else {
					// Kick off loading if not already started.
					if ( video.preload !== 'metadata' ) {
						video.preload = 'metadata';
						video.load();
					}
					video.addEventListener( 'loadeddata', attemptPlay, { once: true } );
					video.addEventListener( 'canplay', attemptPlay, { once: true } );
				}
				return;
			}

			video.pause();
			if ( options.reset !== false ) {
				video.currentTime = 0;
			}
		}

		/**
		 * Pause all tiles except the active one.
		 *
		 * @param {Element|null} activeItem
		 */
		stopInactiveItems( activeItem = null ) {
			this.items.forEach( ( item ) => {
				if ( item !== activeItem ) {
					item.classList.remove( 'is-previewing' );
					this.syncPreviewVideo( item, false, { reset: true } );
				}
			} );
		}

		// ── Hover play ────────────────────────────────────────────────────────

		/**
		 * @param {Element} item
		 */
		scheduleItemHoverStart( item ) {
			if ( this.modalOpen ) {
				return;
			}

			const video = item.querySelector( '.godam-gallery-v2-item__preview-video' );
			if ( video && ! this.loadedVideos.has( video ) ) {
				video.preload = 'metadata';
			}

			if ( this.hoverIntentTimers.has( item ) ) {
				clearTimeout( this.hoverIntentTimers.get( item ) );
			}

			const timerId = setTimeout( () => {
				this.hoverIntentTimers.delete( item );
				this.handleItemHoverStart( item );
			}, HOVER_INTENT_DELAY_MS );

			this.hoverIntentTimers.set( item, timerId );
		}

		/**
		 * @param {Element} item
		 */
		handleItemHoverStart( item ) {
			if ( this.modalOpen ) {
				return;
			}

			this.hoverActiveItem = item;

			if ( this.autoplay ) {
				// In autoplay mode hover just redirects the sequence to this item.
				if ( this.autoplayActiveItem !== item ) {
					this.playAutoplayItem( item, { restart: true } );
				}
				return;
			}

			this.stopInactiveItems( item );
			item.classList.add( 'is-previewing' );

			// Hover play should loop so the video keeps playing while hovered.
			const hoverVideo = item.querySelector( '.godam-gallery-v2-item__preview-video' );
			if ( hoverVideo ) {
				hoverVideo.loop = true;
			}

			this.syncPreviewVideo( item, true, { restart: true, muted: true } );
		}

		/**
		 * @param {Element} item
		 */
		handleItemHoverEnd( item ) {
			if ( this.hoverIntentTimers.has( item ) ) {
				clearTimeout( this.hoverIntentTimers.get( item ) );
				this.hoverIntentTimers.delete( item );
			}

			if ( this.hoverActiveItem === item ) {
				this.hoverActiveItem = null;
			}

			if ( this.autoplay ) {
				return; // Let autoplay sequence continue.
			}

			item.classList.remove( 'is-previewing' );
			this.syncPreviewVideo( item, false, { reset: true } );
		}

		// ── Autoplay sequencing ───────────────────────────────────────────────

		/**
		 * @param {Element} item
		 * @param {Object}  options
		 */
		playAutoplayItem( item, options = {} ) {
			if ( ! item ) {
				return;
			}
			this.autoplayActiveItem = item;
			item.classList.add( 'is-previewing' );
			this.stopInactiveItems( item );

			// Ensure loop is off so the 'ended' event fires and advances the sequence.
			const video = item.querySelector( '.godam-gallery-v2-item__preview-video' );
			if ( video ) {
				video.loop = false;
			}

			this.syncPreviewVideo( item, true, { restart: options.restart !== false, muted: true } );
		}

		stopAutoplaySequence() {
			if ( this.autoplayActiveItem ) {
				this.autoplayActiveItem.classList.remove( 'is-previewing' );
				this.syncPreviewVideo( this.autoplayActiveItem, false, { reset: true } );
			}
			this.autoplayActiveItem = null;
		}

		/**
		 * @param {Element|null} currentItem
		 */
		advanceAutoplaySequence( currentItem = this.autoplayActiveItem ) {
			if ( ! this.autoplay || this.modalOpen ) {
				this.stopAutoplaySequence();
				return;
			}

			const visibleItems = this.items.filter( ( i ) => i.dataset.isInViewport === 'true' );
			const pool = visibleItems.length > 0 ? visibleItems : this.items;
			if ( pool.length === 0 ) {
				this.stopAutoplaySequence();
				return;
			}

			const currentIdx = pool.indexOf( currentItem );
			const nextIdx = currentIdx === -1 ? 0 : ( currentIdx + 1 ) % pool.length;
			this.playAutoplayItem( pool[ nextIdx ], { restart: true } );
		}

		syncAutoplaySequence() {
			if ( ! this.autoplay || this.modalOpen ) {
				return;
			}

			const visibleItems = this.items.filter( ( i ) => i.dataset.isInViewport === 'true' );
			if ( visibleItems.length === 0 ) {
				this.stopAutoplaySequence();
				return;
			}

			if (
				this.autoplayActiveItem &&
				visibleItems.includes( this.autoplayActiveItem )
			) {
				this.stopInactiveItems( this.autoplayActiveItem );
				return;
			}

			this.playAutoplayItem( visibleItems[ 0 ], { restart: true } );
		}

		openModalByIndex( index ) {
			this.refreshItems();
			const item = this.items[ index ];
			const videoId = item?.dataset?.videoId;

			if ( ! videoId ) {
				return;
			}

			if ( this.currentIndex === -1 ) {
				this.previouslyFocusedElement = this.element.ownerDocument.activeElement;
			}

			// Pause all preview videos when modal opens.
			this.modalOpen = true;
			this.hoverIntentTimers.forEach( ( t ) => clearTimeout( t ) );
			this.hoverIntentTimers.clear();
			this.hoverActiveItem = null;

			if ( this.autoplay ) {
				this.stopAutoplaySequence();
			} else {
				this.items.forEach( ( i ) => {
					i.classList.remove( 'is-previewing' );
					this.syncPreviewVideo( i, false, { reset: true } );
				} );
			}

			this.currentIndex = index;
			activeGallery = this;
			const engagementsParam = this.engagements === 'show' ? '&engagements=show' : '';
			const newIframeSrc = `${ this.embedBaseUrl }?godam_page=video-embed&id=${ encodeURIComponent( videoId ) }&godam_gallery=1${ engagementsParam }`;

			// Flush analytics from the previous video (navigation case) before
			// the iframe navigates away. First-open is a no-op because the
			// iframe is empty/about:blank — godamGalleryFlushPayloads is undefined.
			flushIframeAnalytics( this.modal.iframe );
			this.modal.iframe.src = newIframeSrc;

			this.modal.overlay.classList.add( 'is-active' );
			this.modal.modal.classList.add( 'is-active' );
			this.modal.closeButton.classList.add( 'is-active' );
			this.setModalNavState( this.items.length > 1 );
			document.body.classList.add( 'godam-gallery-v2-modal-open' );
			this.modal.closeButton.focus();
		}

		setModalNavState( isActive ) {
			this.modal.prevButton.classList.toggle( 'is-active', isActive );
			this.modal.nextButton.classList.toggle( 'is-active', isActive );
		}

		navigateModal( direction ) {
			this.refreshItems();

			if ( this.items.length <= 1 ) {
				return;
			}

			const total = this.items.length;
			const nextIndex = ( this.currentIndex + direction + total ) % total;
			this.openModalByIndex( nextIndex );
		}

		closeModal() {
			this.modal.overlay.classList.remove( 'is-active' );
			this.modal.modal.classList.remove( 'is-active' );
			this.modal.closeButton.classList.remove( 'is-active' );
			this.modal.prevButton.classList.remove( 'is-active' );
			this.modal.nextButton.classList.remove( 'is-active' );

			// Ask the iframe for its pending heatmap payloads and fire them from
			// here BEFORE resetting src. If we set src first the iframe is torn
			// down and its in-flight analytics POST is cancelled by the browser.
			flushIframeAnalytics( this.modal.iframe );
			this.modal.iframe.src = 'about:blank';

			document.body.classList.remove( 'godam-gallery-v2-modal-open' );
			this.currentIndex = -1;
			this.modalOpen = false;

			if ( activeGallery === this ) {
				activeGallery = null;
			}

			if ( this.previouslyFocusedElement ) {
				this.previouslyFocusedElement.focus();
				this.previouslyFocusedElement = null;
			}

			// Resume preview playback after modal closes.
			if ( this.autoplay ) {
				this.syncAutoplaySequence();
			}
		}
	}

	function initGalleries() {
		const galleries = document.querySelectorAll( '.godam-gallery-v2' );

		galleries.forEach( ( gallery ) => {
			if ( gallery.dataset.initialized === 'true' ) {
				return;
			}

			new GalleryV2( gallery );
			gallery.dataset.initialized = 'true';
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initGalleries );
	} else {
		initGalleries();
	}

	// Expose init so dynamic renderers (e.g. the Elementor editor preview, where
	// the widget is injected after DOMContentLoaded) can re-initialise galleries.
	// initGalleries() is idempotent via the data-initialized guard.
	window.GodamGalleryV2 = { init: initGalleries };
}() );
