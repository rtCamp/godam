/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { requestMoveToFolder, resolveSidebarRoot } from '../../../../../../pages/media-library/data/move-to-folder-bridge';

/**
 * "Move to folder" bulk action for the attachment browser toolbar.
 *
 * Drag-and-drop is the only other way to file media into a folder, and jQuery UI
 * drag does not respond to touch — so on phones and tablets this button is the
 * only route. It lives in the toolbar rather than the folder sidebar because
 * below 900px the sidebar is a full-screen overlay that covers the grid: a button
 * there would mean closing the overlay to select items and reopening it to act.
 *
 * Modelled on `media-retranscode.js`, which solves the same visibility problem.
 */
let MediaMoveToFolder = wp?.media?.view?.Button;

MediaMoveToFolder = MediaMoveToFolder?.extend( {

	events: {
		click: 'openFolderPicker',
	},

	initialize() {
		wp.media.view.Button.prototype.initialize.apply( this, arguments );

		this.controller.on( 'selection:toggle', this.toggleDisabled, this );
		this.controller.on( 'select:activate', this.toggleDisabled, this );
		this.controller.on( 'select:activate select:deactivate', this.toggleVisibility, this );

		this.model.set( 'text', __( 'Move to folder', 'godam' ) );
	},

	/**
	 * Whether this frame gates bulk actions behind core's "Bulk Select" toggle.
	 *
	 * The media grid does; picker frames have no such toggle and select inline, so
	 * there the button is simply always visible and disabled until something is
	 * picked.
	 *
	 * @return {boolean} True on the media grid.
	 */
	isSelectGated() {
		return this.controller.isModeActive( 'grid' );
	},

	/**
	 * Show the button only where a selection can exist.
	 *
	 * wp.media.view.Button renders with class `media-button`, which core's
	 * `toggleBulkEditHandler` does not touch, so visibility has to be managed here.
	 */
	toggleVisibility() {
		const isVisible = ! this.isSelectGated() || this.controller.isModeActive( 'select' );

		this.$el.toggleClass( 'hidden', ! isVisible );
	},

	toggleDisabled() {
		this.model.set( 'disabled', ! this.controller.state().get( 'selection' ).length );
	},

	openFolderPicker() {
		const selection = this.controller.state().get( 'selection' );
		const attachmentIds = selection.map( ( model ) => model.get( 'id' ) );

		if ( ! attachmentIds.length ) {
			return;
		}

		requestMoveToFolder( {
			attachmentIds,
			source: 'grid',
			root: resolveSidebarRoot( this.controller ),
		} );
	},

	render() {
		wp.media.view.Button.prototype.render.apply( this, arguments );

		this.$el.addClass( 'media-library-bulk-actions godam-move-to-folder-button' );
		this.toggleVisibility();
		this.toggleDisabled();

		return this;
	},
} );

export default MediaMoveToFolder;
