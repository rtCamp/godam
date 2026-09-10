/**
 * External dependencies
 */
import { createContext, useContext } from 'react';

/**
 * The folder id whose context menu is currently open, or null when none is.
 *
 * The three-dot toggles are several components deep in the tree, so this carries the
 * open state down without threading a prop through every intermediate row — enough for
 * each toggle to report its own `aria-expanded` accurately.
 */
export const OpenFolderMenuContext = createContext( null );

/**
 * The folder id whose context menu is currently open.
 *
 * @return {number|null} The open folder's id, or null when no menu is open.
 */
export const useOpenFolderMenuId = () => useContext( OpenFolderMenuContext );
