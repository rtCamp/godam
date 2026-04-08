/**
 * Global Escape Key Manager
 *
 * Allows components to register their own Escape close handlers.
 * The most recently registered handler will be executed first.
 */

const escapeStack = [];

/**
 * Registers a close handler for Escape key.
 *
 * @param {Function} handler - Function to execute on Escape.
 */
export function registerEscapeHandler( handler ) {
	if ( typeof handler !== 'function' ) {
		return;
	}

	escapeStack.push( handler );
}

/**
 * Removes a previously registered Escape handler.
 *
 * @param {Function} handler
 */
export function unregisterEscapeHandler( handler ) {
	const index = escapeStack.lastIndexOf( handler );
	if ( index !== -1 ) {
		escapeStack.splice( index, 1 );
	}
}

/**
 * Initializes the global Escape listener.
 * Should be called only once in the entire app.
 */
export function initEscapeManager() {
	document.addEventListener( 'keydown', ( e ) => {
		if ( e.key !== 'Escape' && e.key !== 'Esc' ) {
			return;
		}

		const lastHandler = escapeStack[ escapeStack.length - 1 ];
		lastHandler?.();
	} );
}
