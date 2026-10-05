/**
 * Shared Button CTA style resolution.
 *
 * A Button CTA layer stores a list of buttons (`buttons[]`). Each button carries
 * four colours (background, text, hover-background, hover-text) plus an optional
 * `attention` animation ('none' | 'pulse' | 'ripple' | 'glow') that draws the
 * viewer's eye. These are intentionally PER-BUTTON (unlike the refactored Hotspot
 * layer, which shares one style across all points) so a single layer can mix,
 * e.g., a pulsing "Buy now" and a static "Learn more".
 *
 * Both the admin preview (`ButtonCtaLayer.js`) and the frontend player
 * (`buttonCtaLayerManager.js`) call this so editor and published output match,
 * mirroring how `resolveHotspotStyle` is shared today (see `hotspotStyle.js`).
 */

// Primary filled button defaults. The background matches the player brand blue
// (`--rtgodam-control-bar-color` default / the CTA layer-type colour) so an
// untouched button reads as a clear call to action on most footage.
const DEFAULT_BUTTON_BG = '#3858e9';
const DEFAULT_BUTTON_TEXT = '#ffffff';
const DEFAULT_BUTTON_HOVER_BG = '#2c46bb';
const DEFAULT_BUTTON_HOVER_TEXT = '#ffffff';

// Supported attention animations. 'none' leaves the button static; the others map
// to `.godam-button-cta--attn-<value>` classes defined in `_button-cta.scss`.
const BUTTON_ATTENTION_TYPES = [ 'none', 'pulse', 'ripple', 'glow' ];

/**
 * Resolve the effective colours + attention animation for a single button,
 * applying the shared defaults for any unset field.
 *
 * @param {Object} button Individual button config.
 * @return {{bgColor: string, textColor: string, hoverBgColor: string, hoverTextColor: string, attention: string}} Effective style.
 */
export function resolveButtonCtaStyle( button = {} ) {
	return {
		bgColor: button?.bgColor || DEFAULT_BUTTON_BG,
		textColor: button?.textColor || DEFAULT_BUTTON_TEXT,
		hoverBgColor: button?.hoverBgColor || DEFAULT_BUTTON_HOVER_BG,
		hoverTextColor: button?.hoverTextColor || DEFAULT_BUTTON_HOVER_TEXT,
		attention: BUTTON_ATTENTION_TYPES.includes( button?.attention ) ? button.attention : 'none',
	};
}

export {
	DEFAULT_BUTTON_BG,
	DEFAULT_BUTTON_TEXT,
	DEFAULT_BUTTON_HOVER_BG,
	DEFAULT_BUTTON_HOVER_TEXT,
	BUTTON_ATTENTION_TYPES,
};
