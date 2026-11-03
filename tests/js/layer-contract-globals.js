/**
 * Page globals for the Layer API contract tests (#2291).
 *
 * `SidebarLayers.js` reads plugin availability and add-on layer options from
 * `window` when the module is first evaluated, so these must be set before it
 * is imported. Import this file first in a test, ahead of the module under
 * test. It lives under /tests so it stays out of the release package.
 *
 * `acme` stands in for any third-party add-on layer. `woo` mirrors how the
 * godam-for-woo add-on registers its product hotspot layer today.
 */

window.videoData = {
	...( window.videoData || {} ),
	gfActive: true,
	wpformsActive: true,
};

window.easydamMediaLibrary = {
	...( window.easydamMediaLibrary || {} ),
	isPollPluginActive: true,
};

window.godamVideoEditorConfig = {
	...( window.godamVideoEditorConfig || {} ),
	// What `godam_video_editor_layer_options` localizes.
	layerOptions: [
		{ type: 'acme', title: 'Acme', layerText: 'Acme', iconUrl: 'acme.svg' },
		{ type: 'woo', title: 'Product Hotspot', layerText: 'Product Hotspot', iconUrl: 'woo.svg' },
		{ type: 'acme-inactive', title: 'Acme Inactive', layerText: 'Acme Inactive', isActive: false, tooltipMessage: 'Acme plugin is not active' },
		{ type: 'acme-no-creator', title: 'Acme No Creator', layerText: 'Acme No Creator' },
	],
	// What `godam_video_editor_layer_components` localizes.
	layerComponents: {
		acme: 'AcmeLayer',
	},
};
