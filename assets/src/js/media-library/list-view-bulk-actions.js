/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { isFolderOrgDisabled, isUploadPage } from './utility';
import { requestMoveToFolder, resolveSidebarRoot } from '../../../../pages/media-library/data/move-to-folder-bridge';

/**
 * Value of the injected bulk-action option.
 */
export const MOVE_ACTION = 'godam_move_to_folder';

/**
 * "Move to folder…" in the list view's bulk-actions dropdown.
 *
 * The option is added from JavaScript and Apply is intercepted rather than
 * submitted, because picking a destination needs UI: there is no server handler
 * to post to, and none is registered — if this script does not run, the option
 * simply is not offered.
 */
export default class ListViewBulkActions {
	constructor() {
		if ( isFolderOrgDisabled() || ! isUploadPage() ) {
			return;
		}

		this.form = document.getElementById( 'posts-filter' );

		// Grid mode has no list table, and neither does any other screen using
		// #posts-filter.
		if ( ! this.form || ! this.form.querySelector( '.wp-list-table.media' ) ) {
			return;
		}

		this.injectOption();

		// Capture phase, and on `submit` rather than the Apply buttons' clicks: that
		// also catches an Enter keypress in the search field, which a click listener
		// would miss and would let through as a real form post.
		this.form.addEventListener( 'submit', ( event ) => this.onSubmit( event ), true );
	}

	/**
	 * Add the option to both the top and bottom bulk-action selects.
	 */
	injectOption() {
		const label = __( 'Move to folder…', 'godam' );

		this.form.querySelectorAll( 'select[name="action"], select[name="action2"]' ).forEach( ( select ) => {
			if ( select.querySelector( `option[value="${ MOVE_ACTION }"]` ) ) {
				return;
			}

			// Insert above the last option so the destructive "Delete permanently"
			// stays at the bottom of the list.
			select.add( new Option( label, MOVE_ACTION ), select.options[ select.options.length - 1 ] || null );
		} );
	}

	/**
	 * The action the user actually chose, from whichever select they used.
	 *
	 * @return {string} The selected action, or '-1' when none is chosen.
	 */
	selectedAction() {
		const selects = [
			this.form.querySelector( 'select[name="action"]' ),
			this.form.querySelector( 'select[name="action2"]' ),
		];

		return selects
			.map( ( select ) => select && select.value )
			.find( ( value ) => value && value !== '-1' ) || '-1';
	}

	/**
	 * Ids of the checked rows.
	 *
	 * Scoped to `input[name="media[]"]` rather than every checkbox in the table, so
	 * the "select all" header/footer boxes are excluded.
	 *
	 * @return {Array} Checked attachment ids.
	 */
	checkedIds() {
		return Array.from(
			this.form.querySelectorAll( '.wp-list-table.media tbody input[name="media[]"]:checked' ),
		).map( ( checkbox ) => Number( checkbox.value ) ).filter( Boolean );
	}

	/**
	 * Intercept Apply for our action and open the folder picker instead.
	 *
	 * @param {Event} event The form's submit event.
	 */
	onSubmit( event ) {
		if ( this.selectedAction() !== MOVE_ACTION ) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		requestMoveToFolder( {
			// An empty list is still dispatched: the sidebar answers it with a
			// "select some media first" notice rather than an empty picker.
			attachmentIds: this.checkedIds(),
			source: 'list',
			root: resolveSidebarRoot( null ),
		} );
	}
}
