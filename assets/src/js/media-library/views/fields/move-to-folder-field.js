/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { isFolderOrgDisabled } from '../../utility';
import { requestMoveToFolder, resolveSidebarRoot } from '../../../../../../pages/media-library/data/move-to-folder-bridge';

/**
 * Folder name per attachment id, so the repeat renders these views do (navigating
 * between attachments, reloading details) don't refetch what we already know.
 */
const folderNameCache = new Map();

/** Class on the control, also used to find live controls that need re-reading. */
const CONTROL_CLASS = 'godam-move-to-folder-setting__control';

/** Class on the span holding the folder name. */
const CURRENT_CLASS = 'godam-move-to-folder-setting__current';

/** Prefix of the control's element id, which carries the attachment id. */
const FIELD_ID_PREFIX = 'godam-move-to-folder-';

/**
 * The name of the folder an attachment currently lives in.
 *
 * wp.media's attachment models come from `query-attachments` (admin-ajax), which
 * carries no taxonomy terms, so this has to be asked for separately. The terms
 * controller's `post` filter answers it in a single request.
 *
 * @param {number} id Attachment ID.
 * @return {Promise<string|null>} Folder name, '' when unfiled, or null if unknown.
 */
const getFolderName = async ( id ) => {
	if ( folderNameCache.has( id ) ) {
		return folderNameCache.get( id );
	}

	try {
		const terms = await apiFetch( {
			path: `/wp/v2/media-folder?post=${ id }&_fields=id,name&per_page=1`,
		} );
		// An attachment holds at most one folder: assigning replaces rather than adds.
		const name = terms?.[ 0 ]?.name || '';

		folderNameCache.set( id, name );

		return name;
	} catch {
		// Leave the control showing its placeholder rather than claiming "Uncategorized".
		return null;
	}
};

/**
 * Write an attachment's current folder into one control.
 *
 * @param {HTMLElement} control The control button.
 */
const fillFolderName = ( control ) => {
	const id = Number( control.id.replace( FIELD_ID_PREFIX, '' ) );
	const current = control.querySelector( `.${ CURRENT_CLASS }` );

	if ( ! id || ! current ) {
		return;
	}

	getFolderName( id ).then( ( name ) => {
		// The modal may have moved on to another attachment, or closed, while the
		// request was in flight.
		if ( ! current.isConnected || name === null ) {
			return;
		}

		current.textContent = name || __( 'Uncategorized', 'godam' );
	} );
};

// Every move dispatches this. Clearing the cache alone was not enough: a move made
// while a details modal is open does not re-render that view, so the control went
// on naming the folder the item had just left. Re-read the controls that are
// actually on screen rather than waiting for a render that may never come.
document.addEventListener( 'godam-attachment-browser:changed', () => {
	folderNameCache.clear();
	document.querySelectorAll( `.${ CONTROL_CLASS }` ).forEach( fillFolderName );
} );

/**
 * Add a "Folder" row to an attachment's details sidebar.
 *
 * This is the single-item route into the folder picker: it needs no bulk-select
 * mode, which makes it the shortest path on a phone, where the alternative — drag
 * and drop — does not work at all.
 *
 * Rendered as a native `span.setting` inside `.settings`, alongside Alt Text /
 * Title / Caption / File URL, so it inherits WP's own row styling. It must NOT
 * carry a `data-setting` attribute: that is how the view binds a row to a model
 * attribute for auto-save, and this row saves through the picker instead.
 *
 * Safe to call on every render — it removes its own previous row first.
 *
 * Deliberately not gated on the client by attachment ownership. The server checks
 * `edit_post` per attachment and returns a `rest_forbidden` message that the move
 * hook surfaces verbatim, whereas the local `canManageAttachment()` helper is fed
 * `model.get( 'author' )` — a display name, not an id — so it cannot decide this.
 *
 * @param {Object} view A wp.media.view.Attachment.Details (or .TwoColumn) instance.
 */
const renderMoveToFolderField = ( view ) => {
	if ( isFolderOrgDisabled() ) {
		return;
	}

	const id = view.model?.get?.( 'id' );

	if ( ! id ) {
		return;
	}

	// The details column. Appending to `view.el` instead would drop the row below
	// BOTH columns of the two-column layout, spanning the full modal width.
	const settings = view.el.querySelector( '.settings' );

	if ( ! settings ) {
		return;
	}

	view.$el.find( '.godam-move-to-folder-setting' ).remove();

	const fieldId = `${ FIELD_ID_PREFIX }${ id }`;

	const row = document.createElement( 'span' );
	row.className = 'setting godam-move-to-folder-setting';

	const label = document.createElement( 'label' );
	label.className = 'name';
	label.htmlFor = fieldId;
	label.textContent = __( 'Folder', 'godam' );
	row.appendChild( label );

	// The current folder IS the control, rather than a label with a separate button
	// beside it: every other row in this sidebar puts a full-width bordered control
	// in the value column, and a bare string next to a right-floated button broke
	// that rhythm.
	const control = document.createElement( 'button' );
	control.type = 'button';
	control.id = fieldId;
	control.className = `value ${ CONTROL_CLASS }`;
	// It opens the picker dialog rather than an inline list, so announce it as such.
	control.setAttribute( 'aria-haspopup', 'dialog' );
	control.addEventListener( 'click', () => requestMoveToFolder( {
		attachmentIds: [ id ],
		source: 'details',
		root: resolveSidebarRoot( view ),
	} ) );

	const current = document.createElement( 'span' );
	current.className = CURRENT_CLASS;
	// An em dash until the request resolves, so the control never briefly asserts
	// the wrong folder.
	current.textContent = '—';
	control.appendChild( current );

	const chevron = document.createElement( 'span' );
	chevron.className = 'dashicons dashicons-arrow-down-alt2 godam-move-to-folder-setting__chevron';
	chevron.setAttribute( 'aria-hidden', 'true' );
	control.appendChild( chevron );

	row.appendChild( control );

	// Before the plugin-fields container, so this sits with WP's own fields rather
	// than after the transcoding rows.
	const compat = settings.querySelector( '.attachment-compat' );
	settings.insertBefore( row, compat || null );

	fillFolderName( control );
};

export default renderMoveToFolderField;
