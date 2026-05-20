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

	// Hard upper bound for how long we wait for an iframe to acknowledge an
	// analytics flush request. The iframe processes the message synchronously
	// and only needs to initiate a keepalive fetch, which is essentially
	// instant — 50ms is a generous safety margin that stays imperceptible to
	// the user closing or navigating the modal.
	const FLUSH_ACK_TIMEOUT_MS = 50;

	/**
	 * Ask the embed iframe to send any pending type 2 (heatmap) analytics for
	 * the video it is currently playing, then resolve once the iframe acks
	 * (or the safety timeout elapses).
	 *
	 * iframes do not reliably fire pagehide / beforeunload when their src is
	 * mutated — Safari in particular can drop those events on iframe-level
	 * navigation. Without this explicit handshake, the type 2 heatmap fetch
	 * that normally runs in those handlers is lost. We send a same-origin
	 * postMessage that the analytics script inside the iframe handles by
	 * issuing a synchronous keepalive fetch while its document is still alive.
	 *
	 * @param {HTMLIFrameElement} iframe Modal iframe currently hosting the embed.
	 * @return {Promise<void>} Resolves after ack or timeout — never rejects.
	 */
	function flushIframeAnalytics( iframe ) {
		return new Promise( ( resolve ) => {
			if ( ! iframe || ! iframe.contentWindow ) {
				resolve();
				return;
			}

			// Nothing to flush if the iframe is empty or already on about:blank.
			const currentSrc = iframe.src || '';
			if ( ! currentSrc || currentSrc === 'about:blank' ) {
				resolve();
				return;
			}

			let targetOrigin;
			try {
				targetOrigin = new URL( currentSrc, window.location.origin ).origin;
			} catch ( err ) {
				resolve();
				return;
			}

			// Cross-origin embeds cannot handle our message — bail rather than
			// leak the request to an unrelated origin via postMessage('*').
			if ( targetOrigin !== window.location.origin ) {
				resolve();
				return;
			}

			let settled = false;

			const finish = () => {
				if ( settled ) {
					return;
				}
				settled = true;
				window.removeEventListener( 'message', ackHandler );
				clearTimeout( timeoutId );
				resolve();
			};

			const ackHandler = ( event ) => {
				if (
					event.source === iframe.contentWindow &&
					event.origin === targetOrigin &&
					event.data?.type === 'godamFlushAnalyticsAck'
				) {
					finish();
				}
			};

			window.addEventListener( 'message', ackHandler );
			const timeoutId = setTimeout( finish, FLUSH_ACK_TIMEOUT_MS );

			try {
				iframe.contentWindow.postMessage(
					{ type: 'godamFlushAnalytics' },
					targetOrigin,
				);
			} catch ( err ) {
				// postMessage can throw if the iframe document is already gone.
				// In that case fall through to the timeout — there's nothing
				// useful left to flush anyway.
				finish();
			}
		} );
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

	class GalleryV2 {
		constructor( element ) {
			this.element = element;
			this.mode = element.dataset.mode || 'handpicked';
			this.embedBaseUrl = element.dataset.embedBaseUrl || '/';
			this.engagements = element.dataset.engagements || '';
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

			this.refreshItems();
			initBlurUpPlaceholders( this.element );
			this.bindEvents();
			this.initInfiniteScroll();
			this.updateLoadControls();
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
					const newItems = Array.from(
						template.content.querySelectorAll( '.godam-gallery-v2__query-item' ),
					);

					if ( newItems.length > 0 ) {
						const insertionTarget = this.loadMoreItem || this.sentinel;
						this.queryList.insertBefore( template.content, insertionTarget );
						this.currentOffset += newItems.length;
						initBlurUpPlaceholders( this.element );
					} else {
						this.currentOffset = this.totalItems;
					}
				} else {
					this.currentOffset = this.totalItems;
				}
				this.refreshItems();
			} catch ( error ) {
				// eslint-disable-next-line no-console
				console.error( 'Error loading more gallery items:', error );
			} finally {
				this.isLoading = false;
				this.updateLoadControls();
			}
		}

		async openModalByIndex( index ) {
			this.refreshItems();
			const item = this.items[ index ];
			const videoId = item?.dataset?.videoId;

			if ( ! videoId ) {
				return;
			}

			if ( this.currentIndex === -1 ) {
				this.previouslyFocusedElement = this.element.ownerDocument.activeElement;
			}

			this.currentIndex = index;
			activeGallery = this;

			// When the modal is already showing a video, flush its analytics
			// before reassigning iframe.src. The previous document's
			// pagehide/beforeunload cannot be relied on for iframe-level
			// navigation.
			await flushIframeAnalytics( this.modal.iframe );

			const engagementsParam = this.engagements === 'show' ? '&engagements=show' : '';
			this.modal.iframe.src = `${ this.embedBaseUrl }?godam_page=video-embed&id=${ encodeURIComponent( videoId ) }&godam_gallery=1${ engagementsParam }`;
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

		async closeModal() {
			// Restore the visual state immediately so the modal closing feels
			// responsive. The iframe teardown is deferred until after the
			// analytics flush — a sub-50ms wait that the user does not see.
			this.modal.overlay.classList.remove( 'is-active' );
			this.modal.modal.classList.remove( 'is-active' );
			this.modal.closeButton.classList.remove( 'is-active' );
			this.modal.prevButton.classList.remove( 'is-active' );
			this.modal.nextButton.classList.remove( 'is-active' );
			document.body.classList.remove( 'godam-gallery-v2-modal-open' );
			this.currentIndex = -1;

			if ( activeGallery === this ) {
				activeGallery = null;
			}

			if ( this.previouslyFocusedElement ) {
				this.previouslyFocusedElement.focus();
				this.previouslyFocusedElement = null;
			}

			// Flush analytics before navigating the iframe to about:blank so
			// the heatmap fetch is initiated while the embed document is alive.
			await flushIframeAnalytics( this.modal.iframe );
			this.modal.iframe.src = 'about:blank';
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
}() );
