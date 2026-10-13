/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	customLink,
	customPostType,
	preformatted,
	thumbsUp,
} from '@wordpress/icons';

// Re-use the same asset files the video editor's sidebar renders for
// form integrations so analytics reads visually identical to the
// editor for any given form layer.
/**
 * Internal dependencies
 */
import GFIcon from '../../video-editor/assets/layers/GFIcon.svg';
import WPFormsIcon from '../../video-editor/assets/layers/WPForms-Mascot.svg';
import EverestFormsIcon from '../../video-editor/assets/layers/EverestFormsIcon.svg';
import CF7Icon from '../../video-editor/assets/layers/CF7Icon.svg';
import JetpackIcon from '../../video-editor/assets/layers/JetpackIcon.svg';
import SureformsIcon from '../../video-editor/assets/layers/SureFormsIcons.svg';
import ForminatorIcon from '../../video-editor/assets/layers/Forminator.png';
import FluentFormsIcon from '../../video-editor/assets/layers/FluentFormsIcon.png';
import NinjaFormsIcon from '../../video-editor/assets/layers/NinjaFormsIcon.png';
import MetformIcon from '../../video-editor/assets/layers/MetFormIcon.png';

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
 * Icons match the video editor's seekbar markers ([VideoJSPlayer.js](
 * pages/video-editor/VideoJSPlayer.js#L29-L57)) so the marker users see
 * on the analytics timeline is recognizable as the same layer they
 * positioned in the editor. Built-in types use `@wordpress/icons` glyphs
 * (cards via `<Icon>`); add-on types (Woo) supply an `iconUrl` from the
 * `godam_video_editor_layer_options` PHP filter, picked up here via
 * `window.godamAnalyticsConfig.addonLayerOptions` (see class-pages.php
 * enqueue side).
 *
 * Colors are hex strings; consumers can convert to rgba() with the
 * withAlpha helper below for partial-opacity backgrounds / glows.
 */

/**
 * Built-in icons keyed by layer type. Add-on types resolve via
 * `addonIconUrlFor()` below, which reads the PHP-localized layerOptions.
 */
const BUILTIN_ICONS = {
	cta: customLink,
	form: preformatted,
	hotspot: customPostType,
	poll: thumbsUp,
};

/**
 * Form-integration icons keyed by `layer.form_type`. When a form layer's
 * metadata carries one of these keys, the timeline marker renders the
 * matching brand asset (WPForms mascot, Gravity Forms logo, etc.) instead
 * of the generic `preformatted` glyph. Mirrors the editor's sidebar
 * convention.
 */
const FORM_TYPE_ICONS = {
	gravity: GFIcon,
	wpforms: WPFormsIcon,
	cf7: CF7Icon,
	jetpack: JetpackIcon,
	sureforms: SureformsIcon,
	forminator: ForminatorIcon,
	fluentforms: FluentFormsIcon,
	everestforms: EverestFormsIcon,
	ninjaforms: NinjaFormsIcon,
	metform: MetformIcon,
};

/**
 * Display labels for `layer.form_type`. Brand names — kept as-is across
 * locales (the editor's sidebar follows the same convention).
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

/**
 * Look up the URL-based icon for an add-on layer type from the
 * PHP-localized layer options. Returns an empty string when missing.
 *
 * @param {string} typeId Layer type id.
 * @return {string} Asset URL or ''.
 */
function addonIconUrlFor( typeId ) {
	const options =
		( typeof window !== 'undefined' &&
			window.godamAnalyticsConfig &&
			Array.isArray( window.godamAnalyticsConfig.addonLayerOptions ) )
			? window.godamAnalyticsConfig.addonLayerOptions
			: [];
	const match = options.find( ( o ) => o && o.type === typeId );
	return match?.iconUrl || match?.formIcon || '';
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
 * Resolve the renderable icon descriptor for a layer type id.
 *
 * Two shapes:
 * `{ kind: 'wp', icon: <@wordpress/icons object> }` — render via `<Icon>`.
 * `{ kind: 'url', url: '/path/to/icon.svg' }` — render via `<img>`.
 *
 * Built-in types (cta/form/hotspot/poll) use the same `@wordpress/icons`
 * glyphs the editor seekbar renders. Form layers can override the generic
 * glyph with a form-integration brand asset (WPForms / Gravity / CF7 / …)
 * via the second argument, mirroring the editor sidebar's convention.
 * Add-on types (woo) come in via the PHP `godam_video_editor_layer_options`
 * filter and ship a URL.
 *
 * Returns null for unknown types so callers can decide a fallback.
 *
 * @param {string} typeId     Layer type id.
 * @param {string} [formType] Form integration id for form layers (gravity/wpforms/cf7/…).
 * @return {{kind:'wp'|'url', icon?:Object, url?:string}|null} Icon descriptor.
 */
export function getLayerIcon( typeId, formType ) {
	// Form layers with a known form integration → use the brand asset.
	if ( typeId === 'form' && formType && FORM_TYPE_ICONS[ formType ] ) {
		return { kind: 'url', url: FORM_TYPE_ICONS[ formType ] };
	}
	if ( BUILTIN_ICONS[ typeId ] ) {
		return { kind: 'wp', icon: BUILTIN_ICONS[ typeId ] };
	}
	const url = addonIconUrlFor( typeId );
	if ( url ) {
		return { kind: 'url', url };
	}
	return null;
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
