/* global jQuery */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { isAPIKeyValid, isFolderOrgDisabled } from '../utility';
import GodamLogo from '../../../images/godam-logo-gradient.svg';

/**
 * SVG icons for transcoding states
 */
const ICONS = {
	exclamation: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#fa0000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M13.995 1.827a1.745 1.745 0 0 0-2.969 0l-9.8 17.742a1.603 1.603 0 0 0 0 1.656 1.678 1.678 0 0 0 1.48.775H22.28a1.68 1.68 0 0 0 1.484-.775 1.608 1.608 0 0 0 .003-1.656zM12 8h1v7h-1zm.5 10.5a1 1 0 1 1 1-1 1.002 1.002 0 0 1-1 1z"></path><path fill="none" d="M0 0h24v24H0z"></path></g></svg>`,
};

const $ = jQuery;

const Attachment = wp?.media?.view?.Attachment?.extend( {

	/**
	 * Enables the checkmark for bulk selection of items.
	 *
	 * While the exact cause and effect of this implementation are unclear, it is required to ensure the checkmark appears during bulk selection.
	 * If any issues arise, this functionality should be reviewed as a potential source.
	 */
	buttons: {
		check: true,
	},

	initialize() {
		wp.media.view.Attachment.prototype.initialize.call( this );

		const currentSelectedFolder = window.godam?.selectedFolder;
		if ( isFolderOrgDisabled() || currentSelectedFolder?.meta?.locked ) {
			return;
		}
		/**
		 * Attach drag event to the attachment element, this will allow the user to drag the attachment.
		 * It's more useful to do this here, because on re-render, the draggable event will be lost.
		 */
		const dragState = {
			lastAllowed: null,
			debounceTimeout: null,
		};

		this.$el.draggable( {
			cursor: 'move',

			/**
			 * Using arrow function here is necessary to bind the context of `this` to the parent view.
			 * Otherwise, `this` will refer to the draggable instance.
			 *
			 * not using it here would result in you having to use timeout function to wait for the initialization of the view.
			 */
			helper: () => {
				// Get the current selection from Backbone's state
				const selection = wp.media.frame.state().get( 'selection' );

				// Map through the selection to extract IDs
				let draggedItemIds = selection?.map( ( model ) => model.get( 'id' ) );

				// If no items are selected, use the current item's ID
				if ( ! draggedItemIds || draggedItemIds.length === 0 ) {
					const currentItemId = this.model.get( 'id' ); // Get the ID of the current attachment
					draggedItemIds = [ currentItemId ];
				}

				this.$el.data( 'draggedItems', draggedItemIds );

				return $( '<div>', {
					text: `Moving ${ draggedItemIds.length } item${ draggedItemIds.length > 1 ? 's' : '' }`,
					css: {
						background: '#333',
						color: '#fff',
						padding: '8px 12px',
						borderRadius: '4px',
						fontSize: '14px',
						fontWeight: 'bold',
						boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
						zIndex: 160001, // Ensure that the helper is above media library popup
						PointerEvent: 'none',
						pointerEvents: 'none', // Prevent helper from interfering with element detection
						position: 'relative',
					},
				} );
			},
			opacity: 0.7,
			appendTo: 'body',
			cursorAt: { top: 5, left: 5 },
			// eslint-disable-next-line no-unused-vars
			start: ( event, ui ) => {
				// Cancel drag if folder is locked
				if ( window.godam?.selectedFolder?.meta?.locked ) {
					event.preventDefault();
					$( event.target ).draggable( 'cancel' );
				}
			},
			drag: ( event, ui ) => {
				// Find what’s under the current cursor position
				const $helper = ui.helper;
				const $targetUnderCursor = $( document.elementFromPoint( event.clientX, event.clientY ) );

				// Disallowed if hovered over a locked folder or some no-drop zone
				const isDisallowed = $targetUnderCursor.closest( '.no-drop' ).length > 0;

				// Only process if state actually changed
				if ( dragState.lastAllowed !== isDisallowed ) {
					// Clear any pending state change
					clearTimeout( dragState.debounceTimeout );

					// Debounce to prevent rapid flickering
					dragState.debounceTimeout = setTimeout( () => {
						dragState.lastAllowed = isDisallowed;

						if ( isDisallowed ) {
							$( 'body' ).css( 'cursor', 'not-allowed' );
							$helper
								.css( {
									background: '#8b0000',
									color: '#fff',
									boxShadow: '0 2px 5px rgba(255,0,0,0.6)',
								} )
								.text( '🚫 Drop not allowed' );
						} else {
							$( 'body' ).css( 'cursor', 'move' );
							const draggedItemIds = this.$el.data( 'draggedItems' ) || [];
							$helper
								.css( {
									background: '#333',
									color: '#fff',
									boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
								} )
								.text( `Moving ${ draggedItemIds.length } item${ draggedItemIds.length > 1 ? 's' : '' }` );
						}
					}, 50 ); // 50ms debounce - prevents rapid state changes
				}
			},
			stop: () => {
				// Clean up on drag end
				clearTimeout( dragState.debounceTimeout );
				dragState.lastAllowed = null;
				$( 'body' ).removeClass( 'is-dragging' ).css( 'cursor', '' );
			},
		} );
	},

	render() {
		/**
		 * Finish the parent's render method call before making custom modifications.
		 *
		 * This is necessary because the parent's render method will set up the view's element and other properties.
		 */
		wp.media.view.Attachment.prototype.render.call( this );

		// If the mode is 'godam', we don't need to render the transcoding status.
		if ( 'godam' === this.controller.content.mode() ) {
			return this;
		}

		if ( isAPIKeyValid() && ( this.model.get( 'type' ) === 'video' || this.model.get( 'type' ) === 'audio' || ( this.model.get( 'type' ) === 'application' && this.model.get( 'subtype' ) === 'pdf' ) || this.model.get( 'type' ) === 'image' ) ) {
			// Get the transcoding status from the model
			const transcodingStatus = this.model.get( 'transcoding_status' );
			const virtual = this.model.get( 'virtual' );

			if ( undefined !== virtual && virtual ) {
				this.$el.append( `
					<div class="transcoding-status__loader" data-percent="100">
						<img src="${ GodamLogo }" alt="${ __( 'GoDAM Logo', 'godam' ) }" width="24" height="24" />
					</div>
				` );
				this.$el.addClass( 'transcoding-status--completed' );
			} else if ( transcodingStatus === 'transcoded' ) {
				// Check if the status is 'transcoded' or if we have a transcoded URL
				this.$el.append( `
					<div class="transcoding-status__loader" data-percent="100">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
							<path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" />
						</svg>
					</div>
				` );

				this.$el.addClass( 'transcoding-status' );
				this.$el.addClass( 'transcoding-status--completed' );
			} else if ( transcodingStatus === 'blocked' ) {
				// Show blocked status with warning icon (same as transcoding failed)
				this.$el.append( `
					<div class="transcoding-status__loader" data-percent="100">
						${ ICONS.exclamation }
					</div>
				` );

				this.$el.addClass( 'transcoding-status' );
				this.$el.addClass( 'transcoding-status--blocked' );
			} else {
				this.$el.append( `
					<div class="transcoding-status__loader" data-percent="100">
						<svg class="transcoding-status__loader__progress">
							<circle class="background" cx="50%" cy="50%" r="45%" />
							<circle class="progress"   cx="50%" cy="50%" r="45%" />
						</svg>
					</div>
				` );

				this.$el.addClass( 'transcoding-status' );
				this.$el.addClass( 'transcoding-status--in-progress' );
			}
		}

		return this;
	},
} );

export default Attachment;
