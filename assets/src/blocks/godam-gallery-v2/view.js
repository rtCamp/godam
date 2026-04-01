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
			this.items = Array.from(
				element.querySelectorAll( '[data-godam-gallery-v2-trigger="true"]' ),
			);
			this.currentIndex = -1;
			this.modal = getSharedModal();
			this.bindEvents();
		}

		bindEvents() {
			this.items.forEach( ( item, index ) => {
				item.addEventListener( 'click', () => {
					this.openModalByIndex( index );
				} );
			} );
		}

		openModalByIndex( index ) {
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
