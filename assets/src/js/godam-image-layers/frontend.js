/**
 * GoDAM Image Layers — front-end bootstrap.
 *
 * Renders hotspot and WooCommerce product-hotspot layers on a `godam/image`
 * block. The actual drawing lives in the shared `render-image-frame` module so
 * the block editor preview (edit.js) can reuse it; this file only finds the
 * server-rendered frames and initializes them.
 */

/**
 * Internal dependencies
 */
import { initImageFrame } from './render-image-frame.js';

const initAllFrames = () => {
	document
		.querySelectorAll( '.godam-image__frame[data-godam-image-layers]' )
		.forEach( initImageFrame );
};

// Run on DOMContentLoaded, or immediately if the DOM is already parsed — the
// script may execute after that event (e.g. injected by a page builder).
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', initAllFrames );
} else {
	initAllFrames();
}

/**
 * Detect a page-builder editor preview (WPBakery inline editor or Elementor
 * editor). Both render the block markup (hotspot / product-hotspot layers) into
 * an iframe AFTER this script has run — and re-render it on every edit — so a
 * one-shot init never sees it and the layers stay invisible in the canvas even
 * though the published page renders them fine. The Gutenberg canvas draws them
 * via edit.js instead.
 *
 * @return {boolean} True when running inside a WPBakery or Elementor editor preview.
 */
const isBuilderPreview = () => {
	try {
		const fe = window.frameElement;
		// WPBakery inline editor iframe ids/classes, and Elementor's preview iframe id.
		if ( fe && /vc[-_]inline-frame|vc_editor|elementor-preview-iframe/i.test( ( fe.id || '' ) + ' ' + ( fe.className || '' ) ) ) {
			return true;
		}
	} catch ( e ) {}
	try {
		const cls = document.body?.classList;
		return !! ( cls && ( cls.contains( 'vc_editor' ) || cls.contains( 'elementor-editor-active' ) ) );
	} catch ( e ) {
		return false;
	}
};

// Editor preview only: re-run init on a few deferred passes plus an observer for
// ongoing edits. initImageFrame() is idempotent (guarded by
// data-godam-layers-rendered), so re-running is safe. Nothing extra is scheduled
// on the published front end.
if ( isBuilderPreview() ) {
	[ 300, 1200, 3000 ].forEach( ( delay ) => setTimeout( initAllFrames, delay ) );

	if ( 'MutationObserver' in window ) {
		let scheduled = false;
		const observer = new MutationObserver( () => {
			if ( scheduled ) {
				return;
			}
			scheduled = true;
			window.requestAnimationFrame( () => {
				scheduled = false;
				initAllFrames();
			} );
		} );
		const startObserving = () => observer.observe( document.body, { childList: true, subtree: true } );
		if ( document.body ) {
			startObserving();
		} else {
			document.addEventListener( 'DOMContentLoaded', startObserving );
		}
	}
}
