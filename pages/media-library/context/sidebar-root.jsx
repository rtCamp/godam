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
