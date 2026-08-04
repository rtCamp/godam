/**
 * Entry point for the shared lightbox service.
 *
 * The service is published on `window` rather than only bundled, because the
 * whole reason a second lightbox exists in `godam-for-woo` is that the first one
 * had no handle another plugin could call. Anything that can enqueue the
 * `godam-lightbox-script` handle can now drive this modal.
 */

/**
 * Internal dependencies
 */
import {
	open,
	close,
	navigate,
	isOpen,
	getState,
	createIframeRenderer,
	CLASSES,
} from './service';

window.GodamLightbox = {
	open,
	close,
	navigate,
	isOpen,
	getState,
	createIframeRenderer,
	CLASSES,
};
