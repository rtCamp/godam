/**
 * Shared hotspot style resolution.
 *
 * The refactored hotspot layer stores a single style for ALL hotspot points at
 * the layer level (`styleType` + `pulseColor` / `icon` / `customIconUrl` /
 * `iconColor`). The presence of `styleType` is the marker that a layer uses the
 * new shared model.
 *
 * Layers saved before the refactor stored style PER hotspot
 * (`hotspot.backgroundColor` / `hotspot.icon` / `hotspot.customIconUrl`). Those
 * legacy layers have no `styleType`, so we fall back to each hotspot's own
 * fields — preserving their individual icons & colours on the player.
 *
 * Both the admin preview (`HotspotLayer.js`) and the frontend player
 * (`hotspotLayerManager.js`) call this so editor and published output match.
 */

const DEFAULT_HOTSPOT_COLOR = '#0c80dfa6';

/**
 * Resolve the effective icon / custom icon / colour for a single hotspot.
 *
 * @param {Object} layer   Parent hotspot layer config.
 * @param {Object} hotspot Individual hotspot config.
 * @return {{icon: (string|null), customIconUrl: (string|null), color: string}} Effective style.
 */
export function resolveHotspotStyle( layer, hotspot = {} ) {
	// New shared model — every hotspot inherits the layer-level style.
	if ( layer?.styleType ) {
		if ( layer.styleType === 'icon' ) {
			return {
				icon: layer.icon || null,
				customIconUrl: layer.customIconUrl || null,
				color: layer.iconColor || DEFAULT_HOTSPOT_COLOR,
			};
		}
		// Pulse dot — no icon, just the pulse colour.
		return {
			icon: null,
			customIconUrl: null,
			color: layer.pulseColor || DEFAULT_HOTSPOT_COLOR,
		};
	}

	// Legacy per-hotspot style (pre-refactor layers).
	return {
		icon: hotspot.icon || null,
		customIconUrl: hotspot.customIconUrl || null,
		color: hotspot.backgroundColor || DEFAULT_HOTSPOT_COLOR,
	};
}

export { DEFAULT_HOTSPOT_COLOR };
