/**
 * Shared button style resolution for the Hotspot layer's "Button" style.
 *
 * A button-style hotspot carries a `variant` ('text' | 'sticker'): `text` renders
 * the label with four colours (background, text, hover-background, hover-text);
 * `sticker` renders the same label as a die-cut sticker, with one Fill colour
 * (stored in `bgColor`). Every hotspot also carries an optional `attention`
 * animation ('none' | 'pulse' | 'ripple' | 'glow') that draws the viewer's eye.
 * These are PER-HOTSPOT (unlike the Pulse / Icon styles, which share one look
 * across the layer) so a single layer can mix, e.g., a pulsing text "Buy now" and
 * a sticker.
 *
 * Both the admin preview (`HotspotLayer.js`) and the frontend player
 * (`hotspotLayerManager.js`) call this so editor and published output match,
 * mirroring how `resolveHotspotStyle` is shared (see `hotspotStyle.js`).
 */

// Filled button defaults. The background matches the player brand blue
// (`--rtgodam-control-bar-color` default) so an untouched button reads as a clear
// call to action on most footage. For a sticker the background is the letter fill.
const DEFAULT_BUTTON_BG = '#3858e9';
const DEFAULT_BUTTON_TEXT = '#ffffff';
const DEFAULT_BUTTON_HOVER_BG = '#2c46bb';
const DEFAULT_BUTTON_HOVER_TEXT = '#ffffff';

// Supported attention animations. 'none' leaves the button static; the others map
// to `.godam-button-cta--attn-<value>` classes defined in `_button-cta.scss`.
const BUTTON_ATTENTION_TYPES = [ 'none', 'pulse', 'ripple', 'glow' ];

// Supported variants: a text label, or the label as a die-cut sticker.
const BUTTON_VARIANTS = [ 'text', 'sticker' ];

/**
 * Resolve the effective variant + colours + attention animation for a single
 * button, applying the shared defaults for any unset field.
 *
 * @param {Object} button Individual button (hotspot) config.
 * @return {{variant: string, bgColor: string, textColor: string, hoverBgColor: string, hoverTextColor: string, attention: string}} Effective style.
 */
export function resolveButtonCtaStyle( button = {} ) {
	return {
		variant: BUTTON_VARIANTS.includes( button?.variant ) ? button.variant : 'text',
		bgColor: button?.bgColor || DEFAULT_BUTTON_BG,
		textColor: button?.textColor || DEFAULT_BUTTON_TEXT,
		hoverBgColor: button?.hoverBgColor || DEFAULT_BUTTON_HOVER_BG,
		hoverTextColor: button?.hoverTextColor || DEFAULT_BUTTON_HOVER_TEXT,
		attention: BUTTON_ATTENTION_TYPES.includes( button?.attention ) ? button.attention : 'none',
	};
}

/**
 * Class list for a rendered button, from its resolved style.
 *
 * @param {Object} style           Result of `resolveButtonCtaStyle()`.
 * @param {Object} [options]       Options.
 * @param {string} [options.extra] Extra class names to append.
 * @return {string} Space-separated class names.
 */
export function getButtonCtaClassName( style, { extra = '' } = {} ) {
	return [
		'godam-button-cta',
		style.variant === 'sticker' && 'godam-button-cta--sticker',
		style.attention !== 'none' && `godam-button-cta--attn-${ style.attention }`,
		extra,
	].filter( Boolean ).join( ' ' );
}

/**
 * Colour custom properties consumed by `_button-cta.scss`.
 *
 * @param {Object} style Result of `resolveButtonCtaStyle()`.
 * @return {Object} Map of `--godam-btn-*` property names to colours.
 */
export function getButtonCtaCssVars( style ) {
	return {
		'--godam-btn-bg': style.bgColor,
		'--godam-btn-text': style.textColor,
		'--godam-btn-hover-bg': style.hoverBgColor,
		'--godam-btn-hover-text': style.hoverTextColor,
	};
}

export {
	DEFAULT_BUTTON_BG,
	DEFAULT_BUTTON_TEXT,
	DEFAULT_BUTTON_HOVER_BG,
	DEFAULT_BUTTON_HOVER_TEXT,
	BUTTON_ATTENTION_TYPES,
	BUTTON_VARIANTS,
};
