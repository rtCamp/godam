/**
 * Unit tests for the Top Products CSV cell escaper.
 *
 * `escapeCsvCell` is the formula-injection guard on the "Export" path: product
 * names are user-settable, so a name beginning with a spreadsheet formula
 * trigger (=, +, -, @, or a leading tab/CR that a spreadsheet strips before
 * evaluating what follows) must be neutralised before it lands in a .csv, or
 * opening the export in Excel/Sheets would execute it. This mirrors the guard
 * on TopVideosTable.
 *
 * @package
 */

/**
 * Internal dependencies
 */
import { escapeCsvCell, sourceLabel } from './TopProductsTable';

describe( 'escapeCsvCell — formula-injection guard', () => {
	// A value whose FIRST character is one of these is what a spreadsheet would
	// evaluate as a formula, so the guard prefixes it with a single quote.
	it.each( [
		[ '=SUM(A1:A9)', "'=SUM(A1:A9)" ],
		[ '=1+1', "'=1+1" ],
		[ '+1', "'+1" ],
		[ '-1', "'-1" ],
		[ '@foo', "'@foo" ],
	] )( 'prefixes a leading formula trigger: %s', ( input, expected ) => {
		const out = escapeCsvCell( input );
		expect( out ).toBe( expected );
		expect( out.startsWith( "'" ) ).toBe( true );
	} );

	it( 'prefixes a value that leads with a tab (a spreadsheet strips it, then sees =)', () => {
		expect( escapeCsvCell( '\t=1+1' ) ).toBe( "'\t=1+1" );
	} );

	it( 'prefixes a value that leads with a carriage return', () => {
		expect( escapeCsvCell( '\r=1+1' ) ).toBe( "'\r=1+1" );
	} );

	it( 'quotes a value that leads with a newline so it cannot break out of its cell', () => {
		// A leading newline is not in the prefix set, but the field-quoting pass
		// wraps it in double quotes, so the payload stays inside one cell rather
		// than starting a new record a spreadsheet would then evaluate.
		const out = escapeCsvCell( '\n=1+1' );
		expect( out ).toBe( '"\n=1+1"' );
		expect( out.startsWith( '"' ) ).toBe( true );
	} );

	it( 'still applies the guard when the trigger also needs field-quoting', () => {
		// Leading '=' -> single-quote prefix, then the comma forces double-quote
		// wrapping around the already-prefixed value.
		expect( escapeCsvCell( '=cmd,arg' ) ).toBe( '"\'=cmd,arg"' );
	} );

	describe( 'ordinary values are left executable-safe and otherwise unchanged', () => {
		it( 'passes a plain product name through untouched', () => {
			expect( escapeCsvCell( 'Blue Ceramic Mug' ) ).toBe( 'Blue Ceramic Mug' );
		} );

		it( 'does not prefix a formula trigger that appears mid-string', () => {
			expect( escapeCsvCell( 'Mug =v2' ) ).toBe( 'Mug =v2' );
		} );

		it( 'stringifies a numeric value without adding a guard', () => {
			expect( escapeCsvCell( 42 ) ).toBe( '42' );
		} );

		it( 'quotes (but does not formula-prefix) a plain value containing a comma', () => {
			expect( escapeCsvCell( 'Mug, Blue' ) ).toBe( '"Mug, Blue"' );
		} );

		it( 'doubles embedded quotes in a plain value', () => {
			expect( escapeCsvCell( '7" Pan' ) ).toBe( '"7"" Pan"' );
		} );
	} );
} );

describe( 'sourceLabel — Source chip label mapping', () => {
	it( 'maps each implemented/known block_source to its human label', () => {
		expect( sourceLabel( 'woo-layer' ) ).toBe( 'Woo Layer' );
		expect( sourceLabel( 'shoppable-video' ) ).toBe( 'Shoppable Video' );
		expect( sourceLabel( 'reel-pop' ) ).toBe( 'Reel Pop' );
		expect( sourceLabel( 'wc-product-gallery' ) ).toBe( 'Product Gallery' );
		expect( sourceLabel( 'godam-image' ) ).toBe( 'Image' );
	} );

	it( 'falls back to the raw value for an unknown source', () => {
		expect( sourceLabel( 'something-new' ) ).toBe( 'something-new' );
	} );
} );
