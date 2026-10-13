/**
 * Shared hotspot style resolution.
 *
 * The refactored hotspot layer stores a single style for ALL hotspot points at
 * the layer level (`styleType` + `pulseColor` / `icon` / `customIconUrl` /
 * `iconColor` / `backgroundColor`). The presence of `styleType` is the marker
 * that a layer uses the new shared model; without it we infer the mode from
 * whether an icon is set and fall back to each hotspot's own fields, preserving
 * layers saved before the refactor (`hotspot.backgroundColor` / `hotspot.icon`
 * / `hotspot.customIconUrl`).
 *
 * Colours and behaviour mirror the WooCommerce (product) hotspot layer EXACTLY
 * (see godam-for-woo `wooCommerceLayerManager.js` / `WoocommerceLayer.js`). In
 * pulse mode the circle uses `pulseColor` (falling back to a per-hotspot
 * `backgroundColor`, then the default). In icon mode the circle uses
 * `backgroundColor` (same fallback chain) and the library glyph is recoloured
 * with `iconColor` (default black); a custom uploaded image can't be recoloured
 * so `iconColor` is ignored for it.
 *
 * Both the admin preview (`HotspotLayer.js`) and the frontend player
 * (`hotspotLayerManager.js`) call this so editor and published output match.
 */

const DEFAULT_HOTSPOT_COLOR = '#0c80dfa6';
// The FontAwesome glyph defaults to white (matching the Woo hotspot layer),
// so an untouched library icon reads clearly on the default blue circle. The
// Icon colour picker swatch defaults to the same white.
const DEFAULT_HOTSPOT_ICON_COLOR = '#ffffff';
// A custom uploaded image sits on a neutral white circle by default (a library
// glyph keeps the brand-blue circle, DEFAULT_HOTSPOT_COLOR).
const DEFAULT_HOTSPOT_CUSTOM_ICON_BG = '#ffffff';

/**
 * Resolve the effective icon / custom icon / colours for a single hotspot.
 *
 * @param {Object} layer   Parent hotspot layer config.
 * @param {Object} hotspot Individual hotspot config.
 * @return {{icon: (string|null), customIconUrl: (string|null), color: string, iconColor: string}} Effective style. `color` is the circle fill (pulse colour in pulse mode, background colour in icon mode); `iconColor` recolours a library glyph.
 */
export function resolveHotspotStyle( layer, hotspot = {} ) {
	// `styleType` marks a layer as using the shared layer-level model — set both
	// on layers created after the refactor and on legacy layers once migrated on
	// editor open. For those layers the layer-level fields are AUTHORITATIVE: an
	// explicitly cleared field (e.g. `icon` set to '' by the picker's trash
	// button) must resolve to "no icon", not fall back to the stale per-hotspot
	// value that migration leaves behind. Only a truly legacy layer — saved
	// before the refactor and never re-opened, so it has no `styleType` — falls
	// back to each hotspot's own fields, preserving its original appearance.
	const legacy = layer?.styleType ? {} : hotspot;

	const icon = layer?.icon || legacy.icon || null;
	const customIconUrl = layer?.customIconUrl || legacy.customIconUrl || null;
	const hasIcon = !! ( icon || customIconUrl );
	const styleType = layer?.styleType || ( hasIcon ? 'icon' : 'pulse' );

	if ( styleType === 'icon' ) {
		// A custom uploaded image sits on a neutral white circle by default; a
		// library glyph — or an icon slot with nothing chosen yet — keeps the
		// brand-blue circle so it never renders as an invisible white dot on
		// light content.
		const bgDefault = customIconUrl ? DEFAULT_HOTSPOT_CUSTOM_ICON_BG : DEFAULT_HOTSPOT_COLOR;
		return {
			icon,
			customIconUrl,
			color: layer?.backgroundColor || legacy.backgroundColor || bgDefault,
			iconColor: layer?.iconColor || legacy.iconColor || DEFAULT_HOTSPOT_ICON_COLOR,
		};
	}

	// Pulse dot — no icon, just the pulse colour.
	return {
		icon: null,
		customIconUrl: null,
		color: layer?.pulseColor || legacy.backgroundColor || DEFAULT_HOTSPOT_COLOR,
		iconColor: DEFAULT_HOTSPOT_ICON_COLOR,
	};
}

export { DEFAULT_HOTSPOT_COLOR, DEFAULT_HOTSPOT_ICON_COLOR, DEFAULT_HOTSPOT_CUSTOM_ICON_BG };
