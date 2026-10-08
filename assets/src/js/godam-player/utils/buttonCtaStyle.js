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

// Default button size per variant, as a percentage of the content-box WIDTH —
// the button's analogue of the circle hotspot's DEFAULT_DIAMETER_PERCENT. A
// button with no stored `fontPercent` falls back to this, so EVERY button scales
// with the video (never a fixed px size), exactly like a circle always resolves a
// percent diameter. These equal 16px / 32px (the old `1rem` / `2rem` CSS
// defaults) at a 640px-wide content box.
const DEFAULT_BUTTON_FONT_PERCENT = { text: 2.5, sticker: 5 };

// Sanity clamp for a button's rendered font-size. MIN is only a "don't vanish"
// guard (a button can't collapse to nothing from a tiny stored value or a resize);
// MAX stops it dominating a 4K / fullscreen stage. Kept small so buttons stay
// responsive on phones — the width cap below may shrink below MIN to avoid
// overflow. Absolute px, applied after the percent → px conversion.
const MIN_BUTTON_FONT_PX = 4;
const MAX_BUTTON_FONT_PX = 200;

// Readability floor for the TEXT variant: a text button carries a label meant to
// be read and tapped, so on a small player its scaled font-size is held at a
// legible minimum, keeping the button near the WCAG 2.2 (2.5.8) 24px tap target
// instead of shrinking to ~9px on a phone. The width cap below may still go under
// this (a long label must be free to shrink rather than overflow). Stickers are
// display graphics that can't wrap, so they keep the lower "don't vanish" guard
// and stay free to shrink on narrow screens.
const MIN_TEXT_BUTTON_FONT_PX = 12;

// Overall-size cap: the button may not be wider than this fraction of the video
// content width. On a small player (or with a long label / an author-oversized
// button) the font is shrunk to fit. This is what keeps a sticker — which is a
// single nowrap line and can't wrap — from spilling off a narrow screen.
const MAX_BUTTON_WIDTH_FRACTION = 0.9;

/**
 * Resolve a button-style hotspot's size as a percentage of the content-box width.
 *
 * Like the circle hotspots' `diameter` (which always resolves to a percent —
 * stored or a computed fallback — so it scales with the video), a button always
 * has a percent size: its stored `fontPercent`, or the per-variant default. This
 * is what keeps the button "intact with reference to video pixels" as the player
 * or its container resizes.
 *
 * @param {Object} hotspot Button (hotspot) config.
 * @return {number} Font-size as a percentage of the content-box width.
 */
export function resolveButtonFontPercent( hotspot = {} ) {
	if ( Number.isFinite( hotspot?.fontPercent ) ) {
		return hotspot.fontPercent;
	}
	const variant = resolveButtonCtaStyle( hotspot ).variant;
	return DEFAULT_BUTTON_FONT_PERCENT[ variant ] ?? DEFAULT_BUTTON_FONT_PERCENT.text;
}

/**
 * Shrink a button's font-size so the button fits within MAX_BUTTON_WIDTH_FRACTION
 * of the video width — the "overall size" cap for small players and long labels.
 * The whole button is em-based, so scaling the font scales its width with it.
 * Returns the size unchanged when it already fits (or can't be measured).
 *
 * The fit has NO lower floor: on a narrow phone a long label (or a nowrap sticker,
 * which can't wrap) must be free to shrink as small as needed, or it overflows the
 * screen. Fitting the width always wins over the readability floor.
 *
 * @param {number} currentFontPx Current font-size in px.
 * @param {number} measuredWidth The button's measured px width at that font-size.
 * @param {number} contentWidth  Content-box width in px.
 * @return {number} Font-size in px, reduced if needed to fit.
 */
export function fitButtonFontPx( currentFontPx, measuredWidth, contentWidth ) {
	if ( ! Number.isFinite( currentFontPx ) || ! measuredWidth || ! Number.isFinite( contentWidth ) || contentWidth <= 0 ) {
		return currentFontPx;
	}
	const maxWidth = MAX_BUTTON_WIDTH_FRACTION * contentWidth;
	if ( measuredWidth <= maxWidth ) {
		return currentFontPx;
	}
	return currentFontPx * ( maxWidth / measuredWidth );
}

/**
 * Convert a button's size (percentage of content width) to a clamped px
 * font-size. The whole button (padding, sticker strokes, animations) is em-based,
 * so font-size alone scales it proportionally.
 *
 * Returns `null` only when the content width isn't known yet (stage not laid out)
 * so the caller can leave the CSS default until the next reposition.
 *
 * @param {number} fontPercent  Font-size as a percentage of content width (see resolveButtonFontPercent).
 * @param {number} contentWidth Content-box width in px.
 * @param {number} [minPx]      Lower clamp (defaults to the "don't vanish" guard; pass the text floor via `resolveButtonMinFontPx`).
 * @return {number|null} Clamped font-size in px, or null when it can't be computed.
 */
export function getButtonFontPx( fontPercent, contentWidth, minPx = MIN_BUTTON_FONT_PX ) {
	if ( ! Number.isFinite( fontPercent ) || ! Number.isFinite( contentWidth ) || contentWidth <= 0 ) {
		return null;
	}
	const floor = Number.isFinite( minPx ) ? minPx : MIN_BUTTON_FONT_PX;
	const px = ( fontPercent / 100 ) * contentWidth;
	return Math.max( floor, Math.min( px, MAX_BUTTON_FONT_PX ) );
}

/**
 * Lower font-size clamp for a button, by variant: text buttons get the
 * readability floor (`MIN_TEXT_BUTTON_FONT_PX`), stickers the lower "don't
 * vanish" guard (`MIN_BUTTON_FONT_PX`). Pass the result to `getButtonFontPx`.
 * The width cap (`fitButtonFontPx`) runs afterwards and may still go below it.
 *
 * @param {Object} hotspot Button (hotspot) config.
 * @return {number} Minimum font-size in px for this button's variant.
 */
export function resolveButtonMinFontPx( hotspot = {} ) {
	return resolveButtonCtaStyle( hotspot ).variant === 'sticker'
		? MIN_BUTTON_FONT_PX
		: MIN_TEXT_BUTTON_FONT_PX;
}

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
	DEFAULT_BUTTON_FONT_PERCENT,
	MIN_BUTTON_FONT_PX,
	MIN_TEXT_BUTTON_FONT_PX,
	MAX_BUTTON_FONT_PX,
	MAX_BUTTON_WIDTH_FRACTION,
};
