/**
 * Artwork for the first-run welcome modals.
 *
 * Kept in one place so the "Make your videos interactive" chooser card and the
 * single-option "Get Started with GoDAM" intro use the same image, and so the
 * Woo card and its counterpart stay in sync. Bundled via webpack's file-loader.
 */

/**
 * Internal dependencies
 */
import interactiveImage from './images/make-your-videos-interactive.webp';
import wooImage from './images/turn-product-videos-into-sales.webp';

export const WELCOME_IMAGES = {
	interactive: interactiveImage,
	woo: wooImage,
};
