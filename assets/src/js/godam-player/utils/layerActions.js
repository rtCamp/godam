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
