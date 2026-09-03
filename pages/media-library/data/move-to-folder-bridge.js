/**
 * Cross-bundle contract for the "Move to folder" flow.
 *
 * The folder sidebar (React, `pages/media-library/`) and the wp.media view
 * overrides (Backbone, `assets/src/js/media-library/`) ship as separate webpack
 * entries and cannot share React state. The Backbone-side triggers — the grid
 * toolbar button, the list-view bulk action and the attachment details field —
 * therefore ask the sidebar to open the destination picker by dispatching a
 * document event. This module is imported by BOTH bundles so the event name and
 * the payload shape can never drift apart.
 *
 * The bridge is deliberately one-way: the React side already reaches into
 * wp.media directly (see `data/media-grid.js`), so refreshing the grid after a
 * move needs no event of its own.
 */

/**
 * Event asking the folder sidebar to open the "Move to folder" picker.
 *
 * `detail` carries `{ attachmentIds, source, root }`.
 */
export const MOVE_TO_FOLDER_OPEN_EVENT = 'godam:move-to-folder:open';

/**
 * The id of the sidebar root the React app renders into.
 */
const SIDEBAR_ROOT_ID = 'rt-transcoder-media-library-root';

/**
 * Resolve the folder-sidebar root that owns a given media frame.
 *
 * `assets/src/js/media-library/index.js` mounts one React app per media frame,
 * so an event has to say WHICH sidebar should respond — otherwise a click in one
 * frame opens a picker in every mounted app. In a picker/Elementor frame the root
 * lives inside the frame's own menu; on `upload.php` it is inserted as `#wpbody`'s
 * first child, outside the frame entirely.
 *
 * @param {Object|null} frameOrView A wp.media frame, or any view exposing `.controller`.
 * @return {HTMLElement|null} The sidebar root node, or null if none is mounted.
 */
export function resolveSidebarRoot( frameOrView ) {
	const frame = frameOrView && frameOrView.controller ? frameOrView.controller : frameOrView;
	const inFrame = frame && frame.$el && frame.$el.find( `#${ SIDEBAR_ROOT_ID }` ).get( 0 );

	if ( inFrame ) {
		return inFrame;
	}

	// upload.php: scope to #wpbody so an open picker's root can't be mistaken for
	// the page's own sidebar.
	return document.querySelector( `#wpbody > #${ SIDEBAR_ROOT_ID }` ) ||
		document.getElementById( SIDEBAR_ROOT_ID );
}

/**
 * Ask the folder sidebar to open the "Move to folder" picker.
 *
 * Attachment ids are normalised here rather than at each call site: the grid
 * reads them off Backbone models (numbers) while the list view reads them off
 * checkbox values (strings), and the REST endpoint expects integers.
 *
 * An empty id list is still dispatched — the sidebar answers it with a "select
 * some media first" notice, which is friendlier than an empty picker.
 *
 * @param {Object}           options               Request options.
 * @param {Array}            options.attachmentIds Attachment ids to move.
 * @param {string}           options.source        Which surface triggered this ('grid', 'list' or 'details').
 * @param {HTMLElement|null} options.root          Sidebar root that should respond.
 */
export function requestMoveToFolder( { attachmentIds = [], source = 'grid', root = null } = {} ) {
	const ids = [ ...new Set( attachmentIds.map( Number ) ) ].filter( ( id ) => Number.isInteger( id ) && id > 0 );

	document.dispatchEvent( new CustomEvent( MOVE_TO_FOLDER_OPEN_EVENT, {
		detail: {
			attachmentIds: ids,
			source,
			root,
		},
	} ) );
}
