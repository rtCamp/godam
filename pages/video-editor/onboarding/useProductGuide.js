/**
 * React binding for the product-guide controller.
 *
 * Subscribes to the module singleton so components re-render as the guide
 * advances, and re-exports the imperative controls. Keeping the controller
 * outside React is deliberate — see productGuide.js.
 */

/**
 * WordPress dependencies
 */
import { useEffect, useState, useCallback } from '@wordpress/element';

/**
 * Internal dependencies
 */
import {
	subscribe,
	configure,
	start,
	notify,
	resume,
	dismiss,
	isActive,
} from './productGuide';

/**
 * Hook exposing the guide's live state plus its imperative controls.
 *
 * @param {Object}   [handlers]               Optional callbacks registered with the controller.
 * @param {Function} [handlers.onRequestEnd]  Called when the user clicks the popover's close (X).
 * @param {Function} [handlers.onFinalAction] Called when the final (Copy) step completes.
 * @return {Object} `{ active, stepId, index, total, start, notify, resume, dismiss }`.
 */
export const useProductGuide = ( handlers = {} ) => {
	const [ state, setState ] = useState( () => ( {
		active: isActive(),
		index: 0,
		total: 0,
		stepId: null,
	} ) );

	// Register React callbacks once (and whenever they change identity).
	useEffect( () => {
		configure( {
			onRequestEnd: handlers.onRequestEnd,
			onFinalAction: handlers.onFinalAction,
			onRequestWelcome: handlers.onRequestWelcome,
		} );
	}, [ handlers.onRequestEnd, handlers.onFinalAction, handlers.onRequestWelcome ] );

	useEffect( () => subscribe( setState ), [] );

	return {
		...state,
		start: useCallback( () => start(), [] ),
		notify: useCallback( ( actionId ) => notify( actionId ), [] ),
		resume: useCallback( () => resume(), [] ),
		dismiss: useCallback( () => dismiss(), [] ),
	};
};
