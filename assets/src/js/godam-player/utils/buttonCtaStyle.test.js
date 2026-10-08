/**
 * Unit tests for the button size resolvers shared by the frontend player and the
 * editor preview so they stay in sync. `resolveButtonFontPercent` gives a button's
 * size as a % of the content-box width — stored, or a per-variant default so EVERY
 * button scales with the video — and `getButtonFontPx` turns that percent into a
 * clamped px font-size.
 */

/**
 * Internal dependencies
 */
import { getButtonFontPx, fitButtonFontPx, resolveButtonFontPercent, resolveButtonMinFontPx, DEFAULT_BUTTON_FONT_PERCENT, MIN_BUTTON_FONT_PX, MIN_TEXT_BUTTON_FONT_PX, MAX_BUTTON_FONT_PX, MAX_BUTTON_WIDTH_FRACTION } from './buttonCtaStyle';

describe( 'resolveButtonFontPercent', () => {
	it( 'returns the stored fontPercent when set', () => {
		expect( resolveButtonFontPercent( { fontPercent: 7 } ) ).toBe( 7 );
		expect( resolveButtonFontPercent( { fontPercent: 7, variant: 'sticker' } ) ).toBe( 7 );
	} );

	it( 'falls back to the per-variant default when unset, so the button still scales', () => {
		expect( resolveButtonFontPercent( {} ) ).toBe( DEFAULT_BUTTON_FONT_PERCENT.text );
		expect( resolveButtonFontPercent( { variant: 'text' } ) ).toBe( DEFAULT_BUTTON_FONT_PERCENT.text );
		expect( resolveButtonFontPercent( { variant: 'sticker' } ) ).toBe( DEFAULT_BUTTON_FONT_PERCENT.sticker );
	} );

	it( 'ignores a non-numeric stored value', () => {
		expect( resolveButtonFontPercent( { fontPercent: null } ) ).toBe( DEFAULT_BUTTON_FONT_PERCENT.text );
		expect( resolveButtonFontPercent( { fontPercent: NaN } ) ).toBe( DEFAULT_BUTTON_FONT_PERCENT.text );
	} );
} );

describe( 'getButtonFontPx', () => {
	it( 'scales the font-size with the content width', () => {
		expect( getButtonFontPx( 5, 800 ) ).toBe( 40 );
		expect( getButtonFontPx( 5, 400 ) ).toBe( 20 );
	} );

	it( 'returns null without a usable content width (stage not laid out yet)', () => {
		expect( getButtonFontPx( 5, 0 ) ).toBeNull();
		expect( getButtonFontPx( 5, undefined ) ).toBeNull();
		expect( getButtonFontPx( undefined, 800 ) ).toBeNull();
	} );

	it( 'clamps to the min and max font-size', () => {
		// 0.25% of 800 = 2px → clamped up to the "don't vanish" floor.
		expect( getButtonFontPx( 0.25, 800 ) ).toBe( MIN_BUTTON_FONT_PX );
		// 50% of 800 = 400px → clamped down to the ceiling.
		expect( getButtonFontPx( 50, 800 ) ).toBe( MAX_BUTTON_FONT_PX );
	} );

	it( 'honours a caller-supplied minimum (text readability floor)', () => {
		// 2.5% of 360 (phone) = 9px → held at the text floor instead of vanishing.
		expect( getButtonFontPx( 2.5, 360, MIN_TEXT_BUTTON_FONT_PX ) ).toBe( MIN_TEXT_BUTTON_FONT_PX );
		// Above the floor, the floor does not interfere.
		expect( getButtonFontPx( 5, 800, MIN_TEXT_BUTTON_FONT_PX ) ).toBe( 40 );
	} );
} );

describe( 'resolveButtonMinFontPx', () => {
	it( 'gives text buttons the readability floor and stickers the don\'t-vanish guard', () => {
		expect( resolveButtonMinFontPx( { variant: 'text' } ) ).toBe( MIN_TEXT_BUTTON_FONT_PX );
		expect( resolveButtonMinFontPx( {} ) ).toBe( MIN_TEXT_BUTTON_FONT_PX ); // default variant is text
		expect( resolveButtonMinFontPx( { variant: 'sticker' } ) ).toBe( MIN_BUTTON_FONT_PX );
	} );

	it( 'keeps the text floor above the sticker guard', () => {
		expect( MIN_TEXT_BUTTON_FONT_PX ).toBeGreaterThan( MIN_BUTTON_FONT_PX );
	} );
} );

describe( 'fitButtonFontPx', () => {
	it( 'leaves the font unchanged when the button already fits the width cap', () => {
		// 90% of 800 = 720px; a 700px-wide button fits.
		expect( fitButtonFontPx( 40, 700, 800 ) ).toBe( 40 );
		expect( MAX_BUTTON_WIDTH_FRACTION ).toBe( 0.9 );
	} );

	it( 'shrinks the font so an over-wide button fits 90% of the video width', () => {
		// 900px wide on an 800px video (cap 720) → 40 * 720/900 = 32px.
		expect( fitButtonFontPx( 40, 900, 800 ) ).toBe( 32 );
	} );

	it( 'shrinks without a floor so a long label always fits (stays responsive on phones)', () => {
		// 10000px wide on an 800px video (cap 720) → 11 * 720/10000 = 0.792px, no floor.
		expect( fitButtonFontPx( 11, 10000, 800 ) ).toBeCloseTo( 0.792, 3 );
		expect( fitButtonFontPx( 11, 10000, 800 ) ).toBeLessThan( MIN_BUTTON_FONT_PX );
	} );

	it( 'returns the size unchanged when it can not be measured', () => {
		expect( fitButtonFontPx( 40, 0, 800 ) ).toBe( 40 );
		expect( fitButtonFontPx( 40, 700, 0 ) ).toBe( 40 );
	} );
} );
