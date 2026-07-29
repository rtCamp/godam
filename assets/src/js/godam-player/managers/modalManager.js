/**
 * External dependencies
 */
import videojs from 'video.js';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * "Play on modal" — open a GoDAM player inside a lightbox.
 *
 * Inspired by the GoDAM-for-Woo shoppable video modal: the already-initialised
 * inline player is simply moved into a shared, centered overlay on click and
 * played there; closing moves it back and pauses it. The inline render (poster,
 * player markup, etc.) is left completely untouched.
 */
export default class ModalManager {
	constructor() {
		this.modal = null; // { overlay, closeBtn, wrapper, content }, created on first open.
		this.activeEntry = null; // { video, playerRoot, anchor }.
		this.lastFocused = null;
		this.handleKeydown = this.handleKeydown.bind( this );
	}

	/**
	 * Turn an inline play-on-modal player into a click-to-open trigger.
	 *
	 * @param {HTMLElement} video - The `.easydam-player.video-js` element.
	 */
	register( video ) {
		const figure = video.closest( 'figure' );
		// Move the outer wrapper (parent of <figure>) because it carries the
		// aspect-ratio / brand-color CSS custom properties.
		const playerRoot = figure?.parentElement || video.closest( '.godam-video-wrapper' );
		if ( ! playerRoot || playerRoot.dataset.godamModalBound === '1' ) {
			return;
		}
		playerRoot.dataset.godamModalBound = '1';

		// Intercept clicks in the capture phase — before Video.js handles them —
		// so an inline click opens the modal instead of playing inline.
		playerRoot.addEventListener(
			'click',
			( event ) => {
				// Once the player is live inside the modal, let clicks through to
				// the Video.js controls.
				if ( this.activeEntry && this.activeEntry.video === video ) {
					return;
				}
				event.preventDefault();
				event.stopPropagation();
				this.open( video, playerRoot );
			},
			true,
		);
	}

	/**
	 * Build the shared modal DOM once (overlay + close button + wrapper).
	 *
	 * @return {Object} The cached modal elements.
	 */
	ensureModal() {
		if ( this.modal ) {
			return this.modal;
		}

		const overlay = document.createElement( 'div' );
		overlay.className = 'godam-player-modal-overlay';
		overlay.addEventListener( 'click', () => this.close() );

		const closeBtn = document.createElement( 'button' );
		closeBtn.type = 'button';
		closeBtn.className = 'godam-player-modal-close';
		closeBtn.setAttribute( 'aria-label', __( 'Close', 'godam' ) );
		closeBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
		closeBtn.addEventListener( 'click', () => this.close() );

		const wrapper = document.createElement( 'div' );
		wrapper.className = 'godam-player-modal-wrapper';
		wrapper.setAttribute( 'role', 'dialog' );
		wrapper.setAttribute( 'aria-modal', 'true' );
		wrapper.setAttribute( 'tabindex', '-1' );

		const content = document.createElement( 'div' );
		content.className = 'godam-player-modal-video';
		wrapper.appendChild( content );

		document.body.appendChild( overlay );
		document.body.appendChild( closeBtn );
		document.body.appendChild( wrapper );

		this.modal = { overlay, closeBtn, wrapper, content };
		return this.modal;
	}

	/**
	 * Move the player into the modal and play it.
	 *
	 * @param {HTMLElement} video      - The video element.
	 * @param {HTMLElement} playerRoot - The outer element to move into the modal.
	 */
	open( video, playerRoot ) {
		if ( this.activeEntry ) {
			this.close();
		}

		const modal = this.ensureModal();
		this.lastFocused = playerRoot.ownerDocument.activeElement;

		// Leave an anchor so the player returns to its exact inline position.
		const anchor = document.createComment( 'godam-modal-anchor' );
		playerRoot.parentNode.insertBefore( anchor, playerRoot );
		modal.content.appendChild( playerRoot );
		playerRoot.classList.add( 'godam-player-modal-item' );

		this.activeEntry = { video, playerRoot, anchor };

		modal.overlay.classList.add( 'is-active' );
		modal.closeBtn.classList.add( 'is-active' );
		modal.wrapper.classList.add( 'is-active' );
		document.body.classList.add( 'godam-player-modal-open' );
		document.addEventListener( 'keydown', this.handleKeydown );
		modal.wrapper.focus( { preventScroll: true } );

		const player = videojs.getPlayer( video );
		if ( player ) {
			const playPromise = player.play();
			if ( playPromise && typeof playPromise.catch === 'function' ) {
				// Autoplay policies can still reject; ignore — the user can press
				// play in the modal.
				playPromise.catch( () => {} );
			}
		}
	}

	/**
	 * Pause, restore the player to its inline spot, and hide the modal.
	 */
	close() {
		if ( ! this.activeEntry ) {
			return;
		}
		const { video, playerRoot, anchor } = this.activeEntry;

		const player = videojs.getPlayer( video );
		player?.pause();

		playerRoot.classList.remove( 'godam-player-modal-item' );

		if ( anchor && anchor.parentNode ) {
			anchor.parentNode.insertBefore( playerRoot, anchor );
			anchor.parentNode.removeChild( anchor );
		}

		if ( this.modal ) {
			this.modal.overlay.classList.remove( 'is-active' );
			this.modal.closeBtn.classList.remove( 'is-active' );
			this.modal.wrapper.classList.remove( 'is-active' );
		}
		document.body.classList.remove( 'godam-player-modal-open' );
		document.removeEventListener( 'keydown', this.handleKeydown );

		this.activeEntry = null;

		if ( this.lastFocused && typeof this.lastFocused.focus === 'function' ) {
			this.lastFocused.focus();
		}
		this.lastFocused = null;
	}

	/**
	 * Close on Escape.
	 *
	 * @param {KeyboardEvent} event - Keydown event.
	 */
	handleKeydown( event ) {
		if ( 'Escape' === event.key ) {
			this.close();
		}
	}
}
