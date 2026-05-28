/**
 * Single source of truth for which action types each layer type tracks.
 *
 * Shared between:
 * - Layer managers (event emission)
 * - Admin analytics UI (tab summaries / charts)
 * - Add-ons (godam-for-woo) via window.GoDAM.LAYER_ACTIONS
 *
 * Conversion math is clicked|submitted / viewed (percentage). 'hovered' is
 * tracked but excluded from conversion math by design — hover is engagement,
 * not conversion intent.
 *
 * Adding a layer type:
 * 1. Append an entry below.
 * 2. Add it to LAYER_TYPE_WHITELIST on godam-analytics.
 * 3. Update the LayerType enum on godam-analytics.
 * 4. Implement a layer manager that calls window.GoDAM.addLayerInteraction.
 *
 * @typedef  {Object}   LayerActionConfig
 * @property {string[]} all            Every action_type emitted for this layer type.
 * @property {string}   conversion     The action_type that counts as a "conversion".
 * @property {string[]} displayMetrics Subset of `all` shown in cards/lists. Excludes 'viewed' (the implicit denominator).
 */

/** @type {Object<string, LayerActionConfig>} */
export const LAYER_ACTIONS = {
	cta: {
		all: [ 'viewed', 'clicked', 'skipped' ],
		conversion: 'clicked',
		displayMetrics: [ 'clicked', 'skipped' ],
	},
	form: {
		all: [ 'viewed', 'submitted', 'skipped' ],
		conversion: 'submitted',
		displayMetrics: [ 'submitted', 'skipped' ],
	},
	hotspot: {
		// No 'skipped' action — hotspots have no skip affordance; they
		// auto-hide when their display window ends, which isn't a user
		// dismissal. The manager never emits 'skipped' for hotspot.
		all: [ 'viewed', 'clicked', 'hovered' ],
		conversion: 'clicked',
		displayMetrics: [ 'clicked', 'hovered' ],
	},
	woo: {
		// 'clicked'        — viewer clicked the hotspot icon / through to the WC product page.
		// 'added_to_cart'  — viewer used the in-hotspot Add-to-Cart button (deeper conversion).
		// Both count toward total_conversion at the dashboard level; the
		// per-product UI renders them as separate cards so marketers see
		// "47 clicks, 12 added to cart" rather than a single number.
		all: [ 'viewed', 'clicked', 'hovered', 'added_to_cart' ],
		conversion: 'clicked',
		displayMetrics: [ 'clicked', 'added_to_cart', 'hovered' ],
	},
	poll: {
		// WP-Polls integration: 'voted' fires when the WP-Polls confirmation
		// state appears (form gone, results visible). 'skipped' fires when
		// the viewer dismisses without voting via the layer's skip button.
		all: [ 'viewed', 'voted', 'skipped' ],
		conversion: 'voted',
		displayMetrics: [ 'voted', 'skipped' ],
	},
};

/**
 * Layer types accepted by the analytics microservice. Mirror of
 * LAYER_TYPE_WHITELIST in godam-analytics/app/utils/helpers.py.
 */
export const LAYER_TYPE_WHITELIST = Object.freeze( Object.keys( LAYER_ACTIONS ) );

/**
 * Look up the action config for a given layer type.
 *
 * @param {string} layerType e.g. 'cta', 'form', 'hotspot', 'woo'.
 * @return {LayerActionConfig|null} Config when the type is known, null otherwise.
 */
export function getLayerActionConfig( layerType ) {
	return LAYER_ACTIONS[ layerType ] || null;
}

/**
 * English type labels used in the auto-generated fallback name. Kept
 * non-localized at emission time — the canonical record on the analytics
 * service should be locale-stable so a site that switches languages
 * doesn't fragment its historical layer names. The admin UI re-localizes
 * for display (see useVideoLayerData.js).
 */
const LAYER_TYPE_LABELS = {
	cta: 'CTA',
	form: 'Form',
	hotspot: 'Hotspot',
	poll: 'Poll',
	woo: 'Woo',
};

/**
 * Form-integration labels. Form layers carry `layer.form_type` set by the
 * marketer in the editor (gravity / wpforms / cf7 / …). Brand names — not
 * localized, even in non-English locales the editor uses these as-is.
 *
 * Mirrors the labels in pages/video-editor/components/SidebarLayers.js
 * `layerTypes[].formType[*].layerText` so the analytics name reads
 * identical to what the marketer sees in the sidebar.
 */
export const FORM_TYPE_LABELS = {
	gravity: 'Gravity Forms',
	wpforms: 'WPForms',
	cf7: 'Contact Form 7',
	jetpack: 'Jetpack Forms',
	sureforms: 'SureForms',
	forminator: 'Forminator Forms',
	fluentforms: 'Fluent Forms',
	everestforms: 'Everest Forms',
	ninjaforms: 'Ninja Forms',
	metform: 'MetForm',
};

const UUID_SHAPE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve the display name for a layer at emission time.
 *
 * Future custom-naming UI will set `layer.name` from the editor; that path
 * wins whenever a non-empty, non-UUID-shape value is present. When the
 * marketer hasn't named the layer, fall back to `<TypeLabel> layer at <t>s`
 * — matches the editor's sidebar label convention so the analytics UI
 * reads the same as the timeline marker in the editor.
 *
 * UUID-shape guard catches the legacy case where older clients sent the
 * layer's UUID as its name; we don't want a raw UUID flowing onto the
 * timeline.
 *
 * @param {Object} layer     Layer config with optional .name and .displayTime.
 * @param {string} layerType One of LAYER_TYPE_WHITELIST.
 * @return {string} Display name suitable for the `layer_name` wire field.
 */
export function getLayerDisplayName( layer, layerType ) {
	const customName = layer?.name ? String( layer.name ).trim() : '';
	if ( customName && ! UUID_SHAPE_RE.test( customName ) ) {
		return customName;
	}
	// Form layers prefer the form-integration label (e.g. "WPForms")
	// over the generic "Form" so analytics reads as it does in the
	// editor's sidebar.
	let typeLabel;
	if ( layerType === 'form' && layer?.form_type && FORM_TYPE_LABELS[ layer.form_type ] ) {
		typeLabel = FORM_TYPE_LABELS[ layer.form_type ];
	} else {
		typeLabel = LAYER_TYPE_LABELS[ layerType ] || ( layerType ? String( layerType ) : 'Layer' );
	}
	const t = parseFloat( layer?.displayTime );
	const tFormatted = Number.isFinite( t ) ? t.toFixed( 2 ) : '0.00';
	return `${ typeLabel } layer at ${ tFormatted }s`;
}
