/**
 * Declarative step list for the Video Editor product guide.
 *
 * Each step targets a stable DOM hook (data-test-id / id already present on the
 * Video Editor components) and renders a driver.js popover styled to match the
 * design: a single message, an X, an n/total counter and a progress bar. The
 * flow is action-driven: a step advances when the user performs the real action
 * (`advanceOn`, fired via `productGuide.notify`). One step (the config panel)
 * also offers a Next button (`showNext`) so the user can tweak settings first.
 *
 * `element` is resolved lazily at display time; the controller waits for it to
 * appear (and for an optional `ready` predicate) before highlighting, so steps
 * can span the list → editor transition and wait for async content like the
 * loaded video timeline.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getTourPrioritizeId } from './tourPrioritize';

/**
 * Build the ordered step list. A function (not a constant) so the i18n strings
 * are evaluated after the locale is ready. `text` is the verbatim design copy.
 *
 * @return {Array<Object>} Ordered product-guide steps.
 */
export const getSteps = () => {
	// When the tour pinned a demo video first (id set on start), tell the user we
	// seeded one so the highlighted first card isn't mistaken for their own upload.
	const listEditText = getTourPrioritizeId()
		? __( 'Start by adding layers to this video to make it interactive.', 'godam' ) + ' ' + __( 'Downloaded a demo video.', 'godam' )
		: __( 'Start by adding layers to this video to make it interactive.', 'godam' );

	return [
		{
			id: 'list-edit',
			// First video card in the grid (the demo video sits first during the tour).
			element: '[data-test-id^="godam-video-editor-element-card-"]',
			text: listEditText,
			side: 'left',
			align: 'center',
			advanceOn: 'edit-video',
		},
		{
			id: 'pick-time',
			element: '.godam-ve-timeline__track-area',
			// Only prompt once the video metadata has loaded and the timeline is
			// actually scrubbable (duration known).
			ready: () => {
				const video = document.querySelector( '#root-video-editor video' );
				return Boolean( video && Number.isFinite( video.duration ) && video.duration > 0 );
			},
			text: __( 'Select a spot on the timeline where you want to add your layer.', 'godam' ),
			side: 'top',
			align: 'start',
			advanceOn: 'timeline-select',
		},
		{
			id: 'add-layer',
			element: '#add-layer-btn',
			text: __( 'Start by selecting a layer from the dropdown to add it here.', 'godam' ),
			side: 'right',
			align: 'start',
			advanceOn: 'open-add-layer',
		},
		{
			id: 'pick-cta',
			// The CTA option inside the open "Add layer" dropdown. It lives in the
			// dropdown's portal; highlighting it keeps focus inside the menu so the
			// dropdown stays open.
			element: '[data-test-id="godam-video-editor-control-add-cta"]',
			text: __( 'Start with a CTA — it’s the quickest way to make your video interactive.', 'godam' ),
			side: 'right',
			align: 'start',
			advanceOn: 'layer-added',
		},
		{
			id: 'config-panel',
			element: '.godam-video-editor__config',
			text: __( 'Use this panel to customize and configure your layer settings.', 'godam' ),
			side: 'left',
			align: 'start',
			// Informational — let the user tweak settings, then click Next.
			showNext: true,
		},
		{
			id: 'save-video',
			element: '[data-test-id="godam-video-editor-button-save"]',
			text: __( 'Save the video to use it anywhere on your WordPress site.', 'godam' ),
			side: 'bottom',
			align: 'end',
			advanceOn: 'save-video',
		},
		{
			id: 'copy',
			element: '[data-test-id="godam-video-editor-button-copy-block"]',
			text: __( 'Now copy the video to use it in a page.', 'godam' ),
			side: 'bottom',
			align: 'end',
			advanceOn: 'copy',
			isFinal: true,
		},
	];
};
