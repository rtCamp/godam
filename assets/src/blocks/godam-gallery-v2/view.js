/**
 * Frontend runtime for GoDAM Gallery V2.
 */

( function() {
	'use strict';

	let activeGallery = null;
	let sharedModal = null;

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
		document.body.appendChild( modal );

		const iframe = document.createElement( 'iframe' );
		iframe.className = 'godam-gallery-v2-modal__iframe';
		iframe.setAttribute( 'allowfullscreen', 'allowfullscreen' );
		iframe.setAttribute( 'loading', 'lazy' );
		modal.appendChild( iframe );

		const closeButton = document.createElement( 'button' );
		closeButton.type = 'button';
		closeButton.className = 'godam-gallery-v2-modal__close';
		closeButton.setAttribute( 'aria-label', 'Close' );
		closeButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
		document.body.appendChild( closeButton );

		const prevButton = document.createElement( 'button' );
		prevButton.type = 'button';
		prevButton.className = 'godam-gallery-v2-modal__nav godam-gallery-v2-modal__nav--prev';
		prevButton.setAttribute( 'aria-label', 'Previous video' );
		prevButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
		document.body.appendChild( prevButton );

		const nextButton = document.createElement( 'button' );
		nextButton.type = 'button';
		nextButton.className = 'godam-gallery-v2-modal__nav godam-gallery-v2-modal__nav--next';
		nextButton.setAttribute( 'aria-label', 'Next video' );
		nextButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
		document.body.appendChild( nextButton );

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
			this.currentIndex = -1;
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
			this.infiniteScroll = this.queryArea?.dataset.infiniteScroll === 'true';
			this.items = [];

			this.refreshItems();
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
				const shouldShow = ! this.infiniteScroll && this.hasMorePages();
				this.loadMoreButton.hidden = ! shouldShow;
				this.loadMoreButton.disabled = this.isLoading;
				this.loadMoreButton.classList.toggle( 'is-loading', this.isLoading );
			}

			if ( this.loadMoreItem ) {
				this.loadMoreItem.hidden = this.loadMoreButton ? this.loadMoreButton.hidden : true;
			}

			if ( this.sentinel ) {
				this.sentinel.hidden = ! this.infiniteScroll || ! this.hasMorePages();
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

			try {
				const response = await fetch( `${ this.queryRestUrl }?${ params.toString() }`, {
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
					} else {
						this.currentOffset = this.totalItems;
					}
				} else {
					this.currentOffset = this.totalItems;
				}
				this.refreshItems();
			} catch ( error ) {
			} finally {
				this.isLoading = false;
				this.updateLoadControls();
			}
		}

		openModalByIndex( index ) {
			this.refreshItems();
			const item = this.items[ index ];
			const videoId = item?.dataset?.videoId;

			if ( ! videoId ) {
				return;
			}

			this.currentIndex = index;
			activeGallery = this;
			this.modal.iframe.src = `/?godam_page=video-embed&id=${ encodeURIComponent( videoId ) }`;
			this.modal.overlay.classList.add( 'is-active' );
			this.modal.modal.classList.add( 'is-active' );
			this.modal.closeButton.classList.add( 'is-active' );
			this.setModalNavState( this.items.length > 1 );
			document.body.classList.add( 'godam-gallery-v2-modal-open' );
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
			this.modal.iframe.src = 'about:blank';
			document.body.classList.remove( 'godam-gallery-v2-modal-open' );
			this.currentIndex = -1;

			if ( activeGallery === this ) {
				activeGallery = null;
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
}() );
