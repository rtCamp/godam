/**
 * Declarative step list for the Media Library guided tour.
 *
 * Step shape (all optional except `id`, `element`, `text`):
 * - `id`           Stable id (used to resume after a reload and for `backTo`).
 * - `title`        Short heading shown above the message.
 * - `text`         Message; a string or `( ctx ) => string`.
 * - `element`      Target selector; a string or `( ctx ) => string`.
 * - `side`/`align` driver.js popover placement.
 * - `when`         `( ctx ) => boolean` — skip the step when false.
 * - `onEnter`      `( ctx ) => void` — prepare the page before highlighting.
 * - `advanceOn`    Document event name that completes the step (see EVENTS);
 * `onEvent( ctx, detail )` may veto (return false) / record context.
 * - `advanceWhen`  `( ctx ) => boolean` polled while the step is shown.
 * - `abortWhen`    `( ctx ) => boolean` polled; when true the tour jumps to `backTo`
 * (e.g. the user closed the folder modal without creating).
 * - `showNext`     Show a Next button (informational steps). `nextLabel` overrides it.
 * - `skipTo`       Step id the Next/Skip button jumps to (skips an interactive sequence).
 * - `interactive`  Extra selectors that stay clickable while the step is shown
 * (driver.js otherwise blocks everything but the highlight).
 * - `focus`        Selector to (re)focus after the popover renders.
 * - `skipWhen`     `( ctx ) => boolean` checked while waiting for the target; skip at once.
 * - `reveal`       Selector (or fn) scrolled into view once it renders, e.g. a drop target.
 * - `optimistic`   Count the step in n/total before its `when` can pass.
 *
 * Interactive steps (create a folder, create a sub-folder, drag media into it,
 * open it) advance when the user actually does the thing; informational steps
 * use Next / Back.
 */

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	SELECTORS,
	EVENTS,
	folderRow,
	folderName,
	isFolderModalOpen,
	isContextMenuOpen,
	isSelectMode,
	isMoveModalOpen,
	showAllMedia,
	isGridEmpty,
	expandFolder,
	ensureSidebarOpen,
} from './dom';
import { tourConfig } from './state';

const nameOf = ( ctx, key ) => ctx[ `${ key }Name` ] || folderName( ctx[ key ] ) || __( 'your folder', 'godam' );

const folderNameStep = ( { id, recordKey, parentKey, backTo, title, text } ) => ( {
	id,
	title,
	element: SELECTORS.folderModal,
	text,
	side: 'right',
	align: 'start',
	interactive: [ SELECTORS.modalOverlay ],
	focus: `${ SELECTORS.folderModal } input`,
	advanceOn: EVENTS.FOLDER_CREATED,
	onEvent: ( ctx, detail ) => {
		// The sub-folder step only counts a folder created inside the parent.
		if ( parentKey && Number( detail?.parent ) !== Number( ctx[ parentKey ] ) ) {
			return false;
		}
		ctx[ recordKey ] = Number( detail?.id ) || 0;
		ctx[ `${ recordKey }Name` ] = detail?.name || '';
		ctx[ `${ recordKey }Parent` ] = Number( detail?.parent ) || 0;
		return true;
	},
	abortWhen: () => ! isFolderModalOpen(),
	backTo,
} );

/**
 * Build the ordered step list. A function so i18n strings are evaluated after
 * the locale data is registered.
 *
 * @return {Array<Object>} Tour steps.
 */
export const getSteps = () => [
	{
		id: 'sidebar',
		title: __( 'Your folder panel', 'godam' ),
		element: SELECTORS.sidebar,
		text: __( 'GoDAM adds folders to your Media Library. All Media shows everything, and Uncategorized collects media that isn’t in a folder yet.', 'godam' ),
		side: 'right',
		align: 'start',
		onEnter: () => ensureSidebarOpen(),
		showNext: true,
	},
	{
		id: 'new-folder',
		title: __( 'Create a folder', 'godam' ),
		element: SELECTORS.newFolderButton,
		text: __( 'Let’s create your first folder. Click “New Folder”.', 'godam' ),
		side: 'right',
		align: 'center',
		advanceWhen: () => isFolderModalOpen(),
		when: () => Boolean( document.querySelector( SELECTORS.newFolderButton ) ),
	},
	folderNameStep( {
		id: 'name-folder',
		recordKey: 'folder',
		backTo: 'new-folder',
		title: __( 'Name it', 'godam' ),
		text: __( 'Type a name, for example “Marketing”, and click Create.', 'godam' ),
	} ),
	{
		id: 'folder-ready',
		optimistic: true,
		title: __( 'Folder options', 'godam' ),
		element: ( ctx ) => folderRow( ctx.folder ),
		text: ( ctx ) => sprintf(
			/* translators: %s: folder name. */
			__( '“%s” is ready! Click the three-dot menu next to it (or right-click the folder) to see what you can do with it.', 'godam' ),
			nameOf( ctx, 'folder' ),
		),
		side: 'right',
		align: 'center',
		when: ( ctx ) => Boolean( ctx.folder ),
		advanceWhen: () => isContextMenuOpen(),
		// Remember which folder's menu was opened — the sub-folder is created there.
		onAdvance: ( ctx ) => {
			const toggle = document.querySelector( `${ SELECTORS.folderTree } .tree-item__menu-toggle[aria-expanded="true"]` );
			ctx.menuFolder = Number( toggle?.closest( '.tree-item' )?.dataset.id ) || ctx.folder;
		},
	},
	{
		id: 'folder-menu',
		optimistic: true,
		title: __( 'Everything in one menu', 'godam' ),
		element: SELECTORS.contextMenu,
		text: __( 'Rename, lock, bookmark, download as ZIP or delete folders from here. Now click “New Sub-folder” to nest a folder inside this one.', 'godam' ),
		side: 'right',
		align: 'start',
		when: ( ctx ) => Boolean( ctx.folder ),
		advanceWhen: () => isFolderModalOpen(),
		abortWhen: () => ! isContextMenuOpen() && ! isFolderModalOpen(),
		backTo: 'folder-ready',
	},
	{
		...folderNameStep( {
			id: 'name-subfolder',
			recordKey: 'subfolder',
			parentKey: 'menuFolder',
			backTo: 'folder-ready',
			title: __( 'Name the sub-folder', 'godam' ),
			text: __( 'Give the sub-folder a name, for example “Campaign assets”, and click Create.', 'godam' ),
		} ),
		when: ( ctx ) => Boolean( ctx.folder ),
		optimistic: true,
	},
	{
		id: 'subfolder-ready',
		optimistic: true,
		title: __( 'Nested folders', 'godam' ),
		// Sub-folders render only under an expanded parent, and the parent's
		// chevron appears a render after the create. Keep expanding until the new
		// row shows; fall back to the parent row if it never does.
		element: ( ctx ) => {
			if ( document.querySelector( folderRow( ctx.subfolder ) ) ) {
				return folderRow( ctx.subfolder );
			}
			// Click the chevron once; clicking again while React re-renders would collapse it.
			if ( ! ctx.expanded ) {
				ctx.expanded = expandFolder( ctx.subfolderParent );
			}
			ctx.expandTries = ( ctx.expandTries || 0 ) + 1;
			return ctx.expandTries > 25 ? folderRow( ctx.subfolderParent ) : folderRow( ctx.subfolder );
		},
		text: ( ctx ) => sprintf(
			/* translators: %s: sub-folder name. */
			__( '“%s” now lives inside its parent. Tip: drag and drop any folder to reorder it or move it into another folder.', 'godam' ),
			nameOf( ctx, 'subfolder' ),
		),
		side: 'right',
		align: 'center',
		when: ( ctx ) => Boolean( ctx.subfolder ),
		onEnter: ( ctx ) => {
			ctx.expandTries = 0;
			ctx.expanded = false;
		},
		showNext: true,
	},
	{
		id: 'bookmarks-locked',
		title: __( 'Bookmarks & locked folders', 'godam' ),
		element: SELECTORS.folderTabs,
		text: __( 'Bookmark the folders you use most and lock the ones that shouldn’t change. They are collected here for quick access.', 'godam' ),
		side: 'right',
		align: 'start',
		showNext: true,
	},
	{
		id: 'add-media',
		optimistic: true,
		title: __( 'Add media to a folder', 'godam' ),
		element: SELECTORS.firstAttachment,
		text: ( ctx ) => sprintf(
			/* translators: %s: folder name. */
			__( 'Drag this item and drop it on “%s” in the sidebar. You can select multiple items to move them together.', 'godam' ),
			nameOf( ctx, 'folder' ),
		),
		side: 'bottom',
		align: 'start',
		when: ( ctx ) => Boolean( ctx.folder ),
		// Creating a folder switches the grid to that (empty) folder — go back to
		// All Media so there is something to drag.
		onEnter: () => showAllMedia(),
		// Library genuinely empty: skip right away instead of waiting it out.
		skipWhen: () => isGridEmpty() && Boolean( document.querySelector( `${ SELECTORS.allMedia }.folder-list__item--active` ) ),
		// Bring the drop target into view in the (scrollable) folder tree.
		reveal: ( ctx ) => folderRow( ctx.folder ),
		interactive: [ SELECTORS.folderTree, SELECTORS.folderList, SELECTORS.attachmentsBrowser ],
		advanceOn: EVENTS.ATTACHMENTS_MOVED,
		onEvent: ( ctx, detail ) => {
			ctx.movedTo = Number( detail?.targetFolderId ) > 0 ? Number( detail.targetFolderId ) : 0;
			return true;
		},
		showNext: true,
		nextLabel: __( 'Skip', 'godam' ),
	},
	{
		id: 'open-folder',
		optimistic: true,
		title: __( 'Open your folder', 'godam' ),
		element: ( ctx ) => folderRow( ctx.movedTo || ctx.folder ),
		text: __( 'Click the folder to open it and see the media inside.', 'godam' ),
		side: 'right',
		align: 'center',
		when: ( ctx ) => Boolean( ctx.movedTo ),
		advanceWhen: ( ctx ) => Boolean( document.querySelector( `${ folderRow( ctx.movedTo ) }.tree-item--active` ) ),
	},
	{
		id: 'bulk-select',
		title: __( 'Move many at once', 'godam' ),
		element: SELECTORS.bulkSelect,
		text: __( 'Prefer clicking to dragging? Click “Bulk select” to pick several items at once.', 'godam' ),
		side: 'bottom',
		align: 'center',
		advanceWhen: () => isSelectMode(),
		showNext: true,
		nextLabel: __( 'Skip', 'godam' ),
		skipTo: 'upload',
	},
	{
		id: 'bulk-pick',
		title: __( 'Pick your media', 'godam' ),
		element: SELECTORS.attachmentsBrowser,
		text: __( 'Click one or more items to select them.', 'godam' ),
		side: 'top',
		align: 'start',
		interactive: [ SELECTORS.attachmentsBrowser ],
		advanceWhen: () => Boolean( document.querySelector( SELECTORS.selectedAttachment ) ),
		abortWhen: () => ! isSelectMode(),
		backTo: 'bulk-select',
		showNext: true,
		nextLabel: __( 'Skip', 'godam' ),
		skipTo: 'bulk-exit',
	},
	{
		id: 'bulk-move',
		title: __( 'Move to folder', 'godam' ),
		element: SELECTORS.moveToFolder,
		text: __( 'Now click “Move to folder”. You can keep adding items to the selection first.', 'godam' ),
		side: 'bottom',
		align: 'center',
		// Keep the grid clickable so the selection can still change.
		interactive: [ SELECTORS.attachmentsBrowser ],
		advanceWhen: () => isMoveModalOpen(),
		abortWhen: () => ! isSelectMode() || ! document.querySelector( SELECTORS.selectedAttachment ),
		backTo: 'bulk-select',
		showNext: true,
		nextLabel: __( 'Skip', 'godam' ),
		skipTo: 'bulk-exit',
	},
	{
		id: 'bulk-destination',
		title: __( 'Choose a destination', 'godam' ),
		element: SELECTORS.moveModal,
		text: ( ctx ) => {
			const name = ctx.subfolderName || ctx.folderName;
			return name
				? sprintf(
					/* translators: %s: folder name. */
					__( 'Pick a folder, for example “%s”, and click Move.', 'godam' ),
					name,
				)
				: __( 'Pick a destination folder and click Move.', 'godam' );
		},
		side: 'right',
		align: 'start',
		interactive: [ SELECTORS.modalOverlay ],
		advanceOn: EVENTS.ATTACHMENTS_MOVED,
		onEvent: ( ctx, detail ) => {
			// 0 is a real destination ("Uncategorized"); only a missing id is not.
			const target = Number( detail?.targetFolderId );
			ctx.bulkMovedTo = Number.isInteger( target ) && target >= 0 ? target : -1;
			ctx.bulkMovedCount = detail?.attachmentIds?.length || 1;
			return true;
		},
		abortWhen: () => ! isMoveModalOpen(),
		backTo: 'bulk-move',
	},
	{
		id: 'bulk-moved',
		optimistic: true,
		title: __( 'Moved!', 'godam' ),
		// Point at the destination folder. A sub-folder only renders under an
		// expanded parent, so open its parent first; fall back to the tree.
		element: ( ctx ) => {
			const row = folderRow( ctx.bulkMovedTo );
			if ( document.querySelector( row ) ) {
				return row;
			}
			// Sub-folder of a loaded parent: expand it and give the row a moment.
			const parentRow = ctx.bulkMovedTo === ctx.subfolder && document.querySelector( folderRow( ctx.subfolderParent ) );
			if ( parentRow ) {
				if ( ! ctx.bulkExpanded ) {
					ctx.bulkExpanded = expandFolder( ctx.subfolderParent );
				}
				ctx.bulkTries = ( ctx.bulkTries || 0 ) + 1;
				if ( ctx.bulkTries <= 15 ) {
					return row;
				}
			}
			// Not rendered (e.g. on a later "Load More" page): point at the tree.
			return SELECTORS.folderTree;
		},
		reveal: ( ctx ) => folderRow( ctx.bulkMovedTo ),
		text: ( ctx ) => {
			const name = folderName( ctx.bulkMovedTo ) || ( ctx.bulkMovedTo === ctx.subfolder && ctx.subfolderName ) || ( ctx.bulkMovedTo === ctx.folder && ctx.folderName ) || __( 'the folder', 'godam' );
			if ( ! document.querySelector( folderRow( ctx.bulkMovedTo ) ) ) {
				return sprintf(
					/* translators: 1: number of items, 2: folder name. */
					_n(
						'%1$d item is now in “%2$s”. Open that folder anytime to see it. That’s all it takes to move media in bulk.',
						'%1$d items are now in “%2$s”. Open that folder anytime to see them. That’s all it takes to move media in bulk.',
						ctx.bulkMovedCount || 1,
						'godam',
					),
					ctx.bulkMovedCount || 1,
					name,
				);
			}
			return sprintf(
				/* translators: 1: number of items, 2: folder name. */
				_n(
					'%1$d item is now in “%2$s” — the count next to the folder went up. That’s all it takes to move media in bulk.',
					'%1$d items are now in “%2$s” — the count next to the folder went up. That’s all it takes to move media in bulk.',
					ctx.bulkMovedCount || 1,
					'godam',
				),
				ctx.bulkMovedCount || 1,
				name,
			);
		},
		side: 'right',
		align: 'center',
		when: ( ctx ) => Number.isInteger( ctx.bulkMovedTo ) && ctx.bulkMovedTo >= 0,
		onEnter: ( ctx ) => {
			ctx.bulkTries = 0;
			ctx.bulkExpanded = false;
		},
		showNext: true,
	},
	{
		id: 'bulk-exit',
		title: __( 'Leave Bulk select', 'godam' ),
		element: SELECTORS.bulkSelect,
		text: __( 'Click “Cancel” to leave Bulk select mode before we continue.', 'godam' ),
		side: 'bottom',
		align: 'center',
		when: () => isSelectMode(),
		optimistic: true,
		advanceWhen: () => ! isSelectMode(),
	},
	{
		id: 'upload',
		title: __( 'Upload straight into a folder', 'godam' ),
		element: SELECTORS.addMediaButton,
		text: __( 'Files you upload while a folder is open are saved in that folder automatically.', 'godam' ),
		side: 'bottom',
		align: 'start',
		showNext: true,
	},
	{
		id: 'filters',
		title: __( 'Find anything fast', 'godam' ),
		element: SELECTORS.mediaToolbar,
		text: __( 'Filter by media type or date range, or search across your whole library.', 'godam' ),
		side: 'bottom',
		align: 'center',
		showNext: true,
	},
	{
		id: 'folder-tools',
		title: __( 'Folder tools', 'godam' ),
		element: SELECTORS.folderControls,
		text: __( 'Search folders by name, sort them A–Z or Z–A, or use Bulk Select to act on several folders at once.', 'godam' ),
		side: 'right',
		align: 'start',
		showNext: true,
	},
	{
		id: 'manage-media',
		title: __( 'GoDAM Central', 'godam' ),
		element: SELECTORS.manageMedia,
		text: __( 'Open GoDAM Central for advanced media management, sharing and analytics.', 'godam' ),
		side: 'bottom',
		align: 'center',
		when: () => Boolean( tourConfig.isApiKeyValid ) && Boolean( document.querySelector( SELECTORS.manageMedia ) ),
		showNext: true,
	},
	{
		id: 'replay',
		title: __( 'Replay anytime', 'godam' ),
		element: SELECTORS.bulb,
		text: __( 'That’s the tour! Click the bulb whenever you want to take it again.', 'godam' ),
		side: 'bottom',
		align: 'end',
		showNext: true,
		nextLabel: __( 'Finish', 'godam' ),
	},
];
