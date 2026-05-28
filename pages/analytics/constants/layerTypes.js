/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Per-layer-type metadata for the Video Layer Timeline UI.
 *
 * One canonical source for icon, accent color, display label, and funnel
 * composition. Components import from here rather than hardcoding magic
 * strings — adding a sixth layer type means adding one entry, not grepping
 * for "cta" everywhere.
 *
 * Funnel composition is the ordered list of action_types rendered as bars
 * for that type's "Interaction Outcomes" panel. `no_action` is appended
 * unconditionally as the last bar — same definition across all types
 * ("viewer saw this layer but didn't interact"), but the per-type math
 * differs because the set of observable actions differs.
 *
 * Colors are hex strings; consumers can convert to rgba() with the
 * shadeAt helper below for partial-opacity backgrounds / glows.
 */

/**
 * Inline SVG icon for a layer type. Returned as a React element so the
 * marker can pass through className / fill via the parent's currentColor.
 *
 * @param {string} typeId Layer type id.
 * @return {JSX.Element} SVG element.
 */
function layerIcon( typeId ) {
	const common = {
		width: 18,
		height: 18,
		viewBox: '0 0 24 24',
		fill: 'none',
		stroke: 'currentColor',
		strokeWidth: 2,
		strokeLinecap: 'round',
		strokeLinejoin: 'round',
		'aria-hidden': true,
	};
	switch ( typeId ) {
		case 'cta':
			// paper plane — send / call to action
			return (
				<svg { ...common }>
					<path d="M22 2L11 13" />
					<path d="M22 2l-7 20-4-9-9-4 20-7z" />
				</svg>
			);
		case 'form':
			// document with horizontal lines
			return (
				<svg { ...common }>
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<path d="M14 2v6h6" />
					<path d="M8 13h8" />
					<path d="M8 17h5" />
				</svg>
			);
		case 'hotspot':
			// crosshair / target
			return (
				<svg { ...common }>
					<circle cx="12" cy="12" r="9" />
					<circle cx="12" cy="12" r="5" />
					<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
				</svg>
			);
		case 'poll':
			// bar chart
			return (
				<svg { ...common }>
					<line x1="6" y1="20" x2="6" y2="11" />
					<line x1="12" y1="20" x2="12" y2="4" />
					<line x1="18" y1="20" x2="18" y2="14" />
				</svg>
			);
		case 'woo':
			// shopping bag
			return (
				<svg { ...common }>
					<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
					<line x1="3" y1="6" x2="21" y2="6" />
					<path d="M16 10a4 4 0 0 1-8 0" />
				</svg>
			);
		default:
			// fallback dot
			return (
				<svg { ...common }>
					<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
				</svg>
			);
	}
}

/**
 * Layer type registry. Order here is the canonical ordering for any list
 * UI that wants to iterate all types (e.g. legend, color key).
 */
export const LAYER_TYPES = [
	{
		id: 'cta',
		label: __( 'CTA', 'godam' ),
		color: '#E11D5B',
		// CTA: viewer clicks through or skips. No hover (no tooltip affordance).
		funnel: [ 'viewed', 'clicked', 'skipped', 'no_action' ],
		hasSubHotspots: false,
		// Action used as the numerator in the marker's conversion-rate badge.
		conversionAction: 'clicked',
	},
	{
		id: 'form',
		label: __( 'Form', 'godam' ),
		color: '#7C3AED',
		funnel: [ 'viewed', 'submitted', 'skipped', 'no_action' ],
		hasSubHotspots: false,
		conversionAction: 'submitted',
	},
	{
		id: 'hotspot',
		label: __( 'Hotspot', 'godam' ),
		color: '#10B981',
		// Hotspot is a true funnel: hover is a prerequisite for click —
		// the tooltip has to be visible before you can click the link.
		funnel: [ 'viewed', 'hovered', 'clicked', 'no_action' ],
		hasSubHotspots: true,
		conversionAction: 'clicked',
	},
	{
		id: 'poll',
		label: __( 'Poll', 'godam' ),
		color: '#3B82F6',
		funnel: [ 'viewed', 'voted', 'skipped', 'no_action' ],
		hasSubHotspots: false,
		conversionAction: 'voted',
	},
	{
		id: 'woo',
		label: __( 'Woo Hotspot', 'godam' ),
		color: '#F97316',
		// Woo: post-hover the funnel branches — `clicked` (go to product
		// page) and `added_to_cart` (in-hotspot cart button) are both
		// terminal actions at the same depth. Rendered as adjacent bars.
		funnel: [ 'viewed', 'hovered', 'clicked', 'added_to_cart', 'no_action' ],
		hasSubHotspots: true,
		conversionAction: 'clicked',
	},
];

/**
 * Map of id -> layer type entry. O(1) lookup.
 */
export const LAYER_TYPE_BY_ID = LAYER_TYPES.reduce( ( acc, t ) => {
	acc[ t.id ] = t;
	return acc;
}, {} );

/**
 * Get the icon SVG element for a layer type id. Returns a fallback dot
 * for unknown types so the timeline never blanks out for new server-side
 * types we haven't shipped frontend metadata for yet.
 *
 * @param {string} typeId Layer type id.
 * @return {JSX.Element} SVG element.
 */
export function getLayerIcon( typeId ) {
	return layerIcon( typeId );
}

/**
 * Human-readable label for an action_type, used in funnel bar labels,
 * tooltips, and the sub-rail.
 *
 * @param {string} actionKey 'viewed', 'clicked', 'submitted', etc.
 * @return {string} Localized label.
 */
export function actionLabel( actionKey ) {
	const labels = {
		viewed: __( 'Viewed', 'godam' ),
		clicked: __( 'Clicked', 'godam' ),
		submitted: __( 'Submitted', 'godam' ),
		hovered: __( 'Hovered', 'godam' ),
		skipped: __( 'Skipped', 'godam' ),
		voted: __( 'Voted', 'godam' ),
		added_to_cart: __( 'Added to Cart', 'godam' ),
		no_action: __( 'No Action', 'godam' ),
	};
	return labels[ actionKey ] || actionKey;
}

/**
 * Convert a hex color to an `rgba()` string with the given alpha. Used for
 * tinted backgrounds, glow rings, sub-rail row highlights.
 *
 * @param {string} hex   '#E11D5B' or 'E11D5B'.
 * @param {number} alpha 0..1.
 * @return {string} 'rgba(225, 29, 91, 0.12)'.
 */
export function withAlpha( hex, alpha ) {
	const cleaned = String( hex || '' ).replace( '#', '' );
	if ( cleaned.length !== 6 ) {
		return hex;
	}
	const r = parseInt( cleaned.slice( 0, 2 ), 16 );
	const g = parseInt( cleaned.slice( 2, 4 ), 16 );
	const b = parseInt( cleaned.slice( 4, 6 ), 16 );
	return `rgba(${ r }, ${ g }, ${ b }, ${ alpha })`;
}

/**
 * Stable color for a sub-hotspot row in the SubHotspotRail. Sub-hotspots
 * don't have their own brand color — we cycle through a small palette
 * scoped to the parent's type color so dots stay visually grouped.
 *
 * @param {string} parentTypeColor Hex color of the parent layer type.
 * @param {number} index           0-based sub-hotspot index within the parent.
 * @return {string} Hex color for this sub-hotspot's dot.
 */
export function subHotspotColor( parentTypeColor, index ) {
	// Small palette of stable dot colors — these aren't derived from the
	// parent's color directly because we want the rail readable, not
	// monochromatic. The parent's color is reserved for the marker, the
	// detail panel's left border, and the funnel bars.
	const palette = [
		'#EF4444', // red
		'#10B981', // emerald
		'#3B82F6', // blue
		'#1F2937', // slate
		'#E5E7EB', // light grey
		'#06B6D4', // teal
		'#A855F7', // purple
		'#F59E0B', // amber
	];
	// Suppress unused-arg warning — parentTypeColor reserved for future
	// "tint dots to parent" experiments without breaking callers.
	void parentTypeColor;
	return palette[ index % palette.length ];
}
