/**
 * External dependencies
 */
import { createContext, useContext } from 'react';

/**
 * The sidebar root node this React app was mounted into.
 *
 * `assets/src/js/media-library/index.js` mounts one app per media frame, and a
 * closed-but-not-yet-unmounted sibling can still be live. Events that come in on
 * `document` therefore have to be addressed to a specific sidebar, and each app
 * needs to know which node is its own in order to ignore the rest.
 */
export const SidebarRootContext = createContext( null );

/**
 * The sidebar root node owned by the current app.
 *
 * @return {HTMLElement|null} The root node, or null outside the provider.
 */
export const useSidebarRoot = () => useContext( SidebarRootContext );

/**
 * Whether this app owns the page-level singleton UI (the move picker and the toast).
 *
 * Every mounted app renders its own copy of those, but they all read one shared store,
 * so with two live sidebars — two media frames on a post screen, or the ~100ms window
 * the modal-close cleanup leaves a closing frame mounted — the same open state would
 * stack two dialogs (two focus traps) and two toasts. Electing a single owner keeps
 * exactly one on screen.
 *
 * The owner is the first mounted root in document order (`renderSidebarInto` stamps
 * `data-godam-mounted` on each root before rendering). Recomputed on every render, so
 * it settles to a live owner the next time the shared state changes — which, for the
 * picker and toast, is exactly when one is about to be shown.
 *
 * @return {boolean} True when the current app should render the singleton UI.
 */
export const useIsPrimarySidebar = () => {
	const sidebarRoot = useSidebarRoot();

	// Outside a provider there is only ever one app (e.g. the upload screen), so it owns
	// the singleton UI by default.
	if ( ! sidebarRoot ) {
		return true;
	}

	const roots = document.querySelectorAll( '[data-godam-mounted="true"]' );

	return roots.length === 0 || roots[ 0 ] === sidebarRoot;
};
