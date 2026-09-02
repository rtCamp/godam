/**
 * WordPress dependencies
 */
import { Icon, moreVertical } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Three-dot trigger that opens a folder's context menu.
 *
 * Right-click is the desktop way into ContextMenu, but touch devices have no
 * right-click, so every folder row carries this button too. The menu is anchored
 * under the button rather than at the pointer: a button press has no meaningful
 * pointer position (a keyboard activation reports clientX/clientY as 0), and a
 * dropdown pinned to its trigger is what a tap expects.
 *
 * @param {Object}   props
 * @param {number}   props.folderId      - Folder term ID the menu should act on.
 * @param {Function} props.onContextMenu - Called as ( event, folderId, anchor ).
 * @return {JSX.Element} The trigger button.
 */
const FolderMenuToggle = ( { folderId, onContextMenu } ) => {
	const handleClick = ( event ) => {
		const { left, bottom } = event.currentTarget.getBoundingClientRect();

		onContextMenu( event, folderId, { x: left, y: bottom + 4 } );
	};

	return (
		<button
			type="button"
			className="tree-item__menu-toggle"
			aria-label={ __( 'Folder options', 'godam' ) }
			aria-haspopup="menu"
			// The row wrapping this button carries dnd-kit's drag listeners (both the
			// pointer and the mouse sensor), so a press that starts here must not also
			// start dragging the folder.
			onPointerDown={ ( event ) => event.stopPropagation() }
			onMouseDown={ ( event ) => event.stopPropagation() }
			onClick={ handleClick }
		>
			<Icon icon={ moreVertical } size={ 20 } />
		</button>
	);
};

export default FolderMenuToggle;
