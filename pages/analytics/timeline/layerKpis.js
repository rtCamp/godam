/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { reachAt, reachRateAt } from './reach';

/**
 * Per-layer-type KPI composition for the layer detail panel (W7–W11).
 *
 * One descriptor per layer type, next to `funnel` in constants/layerTypes.js in
 * spirit: adding a KPI means editing a descriptor, not adding a branch in JSX.
 *
 * ## The one rule for rates
 *
 * Every rate here is `action / viewed` **taken from the same microservice row**.
 * That matters because `viewed` is not one unit across layer types: atomic
 * layers (CTA / Form / Poll) and sub-hotspot rows are aggregated with
 * `COUNT(*)` (raw events) while hotspot / Woo parent rows use
 * `uniqExact(page_load_session_id)` (distinct sessions). Within a single row
 * every action shares its row's unit, so a ratio of two actions from that row
 * is always internally consistent and always matches the funnel bars rendered
 * directly beneath the tiles.
 *
 * The one exception is Viewer Reach, which comes off the retention array
 * instead (see reach.js) and therefore counts a different population. It is
 * labelled "Viewer Reach", never "Impressions", and carries a tooltip saying
 * so.
 *
 * The panel deliberately does NOT reuse the server's `conversion_rate` for
 * these tiles. That value's numerator is distinct converting *sessions* over
 * `viewed`, which for atomic layers mixes sessions with events. It stays where
 * it already ships (the sub-hotspot rail header), untouched.
 */

const IMPRESSIONS_TOOLTIP = __(
	'How many times this layer was shown to a viewer. Counted from the layer\'s own impression events, so it can exceed the number of plays when a viewer rewatches.',
	'godam',
);

const REACH_RATE_TOOLTIP = __(
	'Share of the viewers who started this video that were still watching when this layer appeared. Read from the same retention data as the Viewer Retention Curve, so it counts viewers rather than layer impressions.',
	'godam',
);

/**
 * KPI descriptor per layer type.
 *
 * - `donutArc` — which action fills the ring around the Viewer Reach centre.
 * - `primary` — the wide tile, the one that carries a trend badge.
 * - `secondary` — the two tiles below it.
 *
 * Tile shapes: `{ kind: 'rate', numerator }` divides that action by `viewed`;
 * `{ kind: 'count', key }` shows a raw tally; `{ kind: 'reachRate' }` is the
 * retention-derived percentage.
 */
export const LAYER_KPI_SPEC = {
	cta: {
		donutArc: 'clicked',
		primary: {
			id: 'ctr',
			kind: 'rate',
			numerator: 'clicked',
			label: __( 'CTR', 'godam' ),
			tooltip: __(
				'Share of this layer\'s impressions that resulted in a click.',
				'godam',
			),
		},
		secondary: [
			{
				id: 'reach-rate',
				kind: 'reachRate',
				label: __( 'Viewer Reach rate', 'godam' ),
				tooltip: REACH_RATE_TOOLTIP,
			},
			{
				id: 'impressions',
				kind: 'count',
				key: 'viewed',
				label: __( 'Impressions', 'godam' ),
				tooltip: IMPRESSIONS_TOOLTIP,
			},
		],
	},
	form: {
		donutArc: 'no_action',
		primary: {
			id: 'submission-rate',
			kind: 'rate',
			numerator: 'submitted',
			label: __( 'Submission Rate', 'godam' ),
			tooltip: __(
				'Share of this layer\'s impressions that ended in a submitted form.',
				'godam',
			),
		},
		secondary: [
			{
				id: 'abandon-rate',
				kind: 'rate',
				numerator: 'no_action',
				label: __( 'Abandon Rate', 'godam' ),
				// The definition is stated outright because it is the honest
				// limit of what the current events can tell us: there is no
				// "started filling in the form" event, so this counts viewers
				// who ignored the form the same as viewers who began and left.
				tooltip: __(
					'Share of impressions where the viewer neither submitted the form nor dismissed it. Submission, Skip and Abandon together account for every impression.',
					'godam',
				),
			},
			{
				id: 'skip-rate',
				kind: 'rate',
				numerator: 'skipped',
				label: __( 'Skip Rate', 'godam' ),
				tooltip: __(
					'Share of this layer\'s impressions where the viewer dismissed the form.',
					'godam',
				),
			},
		],
	},
	hotspot: {
		donutArc: 'clicked',
		primary: {
			id: 'conversion-rate',
			kind: 'rate',
			numerator: 'clicked',
			label: __( 'Conversion Rate', 'godam' ),
			tooltip: __(
				'Share of this layer\'s impressions where a hotspot was clicked.',
				'godam',
			),
		},
		secondary: [
			{
				id: 'impressions',
				kind: 'count',
				key: 'viewed',
				label: __( 'Impressions', 'godam' ),
				tooltip: IMPRESSIONS_TOOLTIP,
			},
			{
				id: 'hover-rate',
				kind: 'rate',
				numerator: 'hovered',
				label: __( 'Hover Rate', 'godam' ),
				tooltip: __(
					'Share of this layer\'s impressions where the viewer hovered a hotspot to reveal its tooltip.',
					'godam',
				),
			},
		],
	},
	poll: {
		donutArc: 'voted',
		primary: {
			id: 'conversion-rate',
			kind: 'rate',
			numerator: 'voted',
			label: __( 'Conversion Rate', 'godam' ),
			tooltip: __(
				'Share of this layer\'s impressions that ended in a vote.',
				'godam',
			),
		},
		secondary: [
			{
				id: 'impressions',
				kind: 'count',
				key: 'viewed',
				label: __( 'Impressions', 'godam' ),
				tooltip: IMPRESSIONS_TOOLTIP,
			},
			{
				id: 'skip-rate',
				kind: 'rate',
				numerator: 'skipped',
				label: __( 'Skip Rate', 'godam' ),
				tooltip: __(
					'Share of this layer\'s impressions where the viewer dismissed the poll.',
					'godam',
				),
			},
		],
	},
	woo: {
		donutArc: 'added_to_cart',
		primary: {
			id: 'add-to-cart-rate',
			kind: 'rate',
			numerator: 'added_to_cart',
			label: __( 'Add to Cart Rate', 'godam' ),
			tooltip: __(
				'Share of this layer\'s impressions where a product was added to the cart from the hotspot.',
				'godam',
			),
		},
		secondary: [
			{
				id: 'product-click-rate',
				kind: 'rate',
				numerator: 'clicked',
				label: __( 'Product Click Rate', 'godam' ),
				tooltip: __(
					'Share of this layer\'s impressions where the viewer clicked through to a product page.',
					'godam',
				),
			},
			{
				id: 'reach-rate',
				kind: 'reachRate',
				label: __( 'Viewer Reach rate', 'godam' ),
				tooltip: REACH_RATE_TOOLTIP,
			},
		],
	},
};

/**
 * One action count as a percentage of the row's impressions.
 *
 * Returns null when there are no impressions, so the tile renders a dash
 * instead of a misleading 0%. Unclamped on purpose: a value above 100% means
 * the counts genuinely disagree and should be visible, not hidden (the ticket's
 * "correctness at source, no clamp" rule).
 *
 * @param {Object} counts       Action counts for one layer row, including `no_action`.
 * @param {string} numeratorKey Which action forms the numerator.
 * @return {number|null} Percentage, or null when there are no impressions.
 */
export function actionRate( counts, numeratorKey ) {
	const impressions = Number( counts?.viewed ) || 0;
	if ( impressions <= 0 ) {
		return null;
	}
	const numerator = Number( counts?.[ numeratorKey ] ) || 0;
	return ( numerator / impressions ) * 100;
}

/**
 * Resolve one tile descriptor into a value.
 *
 * @param {Object}        tile           Tile descriptor from LAYER_KPI_SPEC.
 * @param {Object}        counts         Action counts including `no_action`.
 * @param {number[]}      retentionArray Per-second view counts.
 * @param {number|string} timestamp      Layer position in seconds.
 * @return {{id:string,kind:string,label:string,tooltip:string,value:number|null}} Resolved tile.
 */
function resolveTile( tile, counts, retentionArray, timestamp ) {
	let value = null;
	if ( tile.kind === 'rate' ) {
		value = actionRate( counts, tile.numerator );
	} else if ( tile.kind === 'count' ) {
		value = Number( counts?.[ tile.key ] ) || 0;
	} else if ( tile.kind === 'reachRate' ) {
		value = reachRateAt( retentionArray, timestamp );
	}
	return {
		id: tile.id,
		kind: tile.kind,
		label: tile.label,
		tooltip: tile.tooltip,
		value,
	};
}

/**
 * Build the donut + tile values for one layer.
 *
 * Pure: the same inputs always give the same output, so the panel calls it
 * twice (selected range and previous equal range) and diffs the two to get the
 * trend badges. No fetching, no formatting.
 *
 * @param {Object}        props
 * @param {string}        props.layerType        'cta' | 'form' | 'hotspot' | 'poll' | 'woo'.
 * @param {Object}        props.counts           Action counts for the layer row.
 * @param {number}        [props.noAction]       Viewers who saw the layer and did nothing.
 * @param {number[]}      [props.retentionArray] Per-second view counts for the range.
 * @param {number|string} [props.timestamp]      Layer position in seconds.
 * @return {{donut:Object,primary:Object,secondary:Object[]}|null} Resolved KPIs, or null for an unknown type.
 */
export function buildLayerKpis( {
	layerType,
	counts,
	noAction = 0,
	retentionArray = [],
	timestamp = 0,
} ) {
	const spec = LAYER_KPI_SPEC[ layerType ];
	if ( ! spec ) {
		return null;
	}

	// `no_action` is derived in the data hook rather than returned by the
	// microservice, so fold it in here to make it addressable like any other
	// action (the Form panel's Abandon Rate needs it as a numerator).
	const withNoAction = { ...( counts || {} ), no_action: Number( noAction ) || 0 };

	const reach = reachAt( retentionArray, timestamp );
	const arcValue = Number( withNoAction[ spec.donutArc ] ) || 0;

	return {
		donut: {
			// Null reach means "unknown", and the panel hides the donut rather
			// than drawing an empty ring that reads as zero viewers.
			reach,
			arcAction: spec.donutArc,
			arcValue,
			// The ring is the arc action as a share of impressions, which keeps
			// it in one unit. Reach is the centre label, not the denominator:
			// mixing the two populations into one ratio is exactly what the
			// tooltips warn against.
			arcShare: actionRate( withNoAction, spec.donutArc ),
		},
		primary: resolveTile( spec.primary, withNoAction, retentionArray, timestamp ),
		secondary: spec.secondary.map( ( tile ) =>
			resolveTile( tile, withNoAction, retentionArray, timestamp ),
		),
	};
}
