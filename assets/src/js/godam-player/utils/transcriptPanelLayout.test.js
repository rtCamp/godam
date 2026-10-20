/**
 * Internal dependencies
 */
import {
	BELOW_MAX_HEIGHT,
	BELOW_MIN_HEIGHT,
	PANEL_MAX_WIDTH,
	PANEL_MIN_WIDTH,
	computeTranscriptLayout,
	findMatchRanges,
	normaliseQuery,
} from './transcriptPanelLayout';

// The panel must never overlap the video: in a side layout the video and the
// panel together must fit in the stage width.
const expectNoOverlap = ( layout ) => {
	expect( layout.playerWidth + layout.panelWidth ).toBeLessThanOrEqual( layout.width + 0.001 );
	expect( layout.playerHeight ).toBeLessThanOrEqual( layout.stageHeight + 0.001 );
	expect( layout.playerTop ).toBeGreaterThanOrEqual( 0 );
};

describe( 'computeTranscriptLayout', () => {
	it( 'puts the panel beside a 16:9 video and shrinks the video, keeping the stage height', () => {
		const layout = computeTranscriptLayout( { stageWidth: 800, stageHeight: 450, ratio: 16 / 9, room: 800 } );

		expect( layout.mode ).toBe( 'side' );
		expect( layout.width ).toBe( 800 );
		expect( layout.expandBy ).toBe( 0 );
		expect( layout.stageHeight ).toBe( 450 );
		expect( layout.panelWidth ).toBe( PANEL_MIN_WIDTH );
		expect( layout.playerWidth ).toBe( 540 );
		// Same shape as the video, so nothing is cropped.
		expect( layout.playerWidth / layout.playerHeight ).toBeCloseTo( 16 / 9 );
		// Letterboxed: centred vertically in the stage.
		expect( layout.playerTop ).toBeCloseTo( ( 450 - ( 540 * 9 / 16 ) ) / 2 );
		expectNoOverlap( layout );
	} );

	it( 'scales the panel up on a wide player, within the maximum', () => {
		const layout = computeTranscriptLayout( { stageWidth: 1600, stageHeight: 900, ratio: 16 / 9, room: 1600 } );

		expect( layout.mode ).toBe( 'side' );
		expect( layout.panelWidth ).toBe( PANEL_MAX_WIDTH );
		expectNoOverlap( layout );
	} );

	it( 'widens a 9:16 video toward 16:9 so it keeps its full size beside the panel', () => {
		// Player Height 600px gives a 338px-wide portrait block in a 700px column.
		const layout = computeTranscriptLayout( { stageWidth: 337.5, stageHeight: 600, ratio: 9 / 16, room: 700 } );

		expect( layout.mode ).toBe( 'side' );
		expect( layout.playerWidth ).toBeCloseTo( 337.5 );
		expect( layout.playerHeight ).toBeCloseTo( 600 );
		expect( layout.playerTop ).toBeCloseTo( 0 );
		expect( layout.width ).toBeCloseTo( 337.5 + layout.panelWidth );
		expect( layout.expandBy ).toBeCloseTo( layout.panelWidth );
		expectNoOverlap( layout );
	} );

	it( 'only widens as far as the column allows', () => {
		// 597.5px would fit the full-size video; the column only has 580px, so
		// the video scales down a little (to 95%) and stays beside the panel.
		const layout = computeTranscriptLayout( { stageWidth: 337.5, stageHeight: 600, ratio: 9 / 16, room: 580 } );

		expect( layout.mode ).toBe( 'side' );
		expect( layout.width ).toBe( 580 );
		expect( layout.playerWidth ).toBe( 580 - layout.panelWidth );
		expect( layout.playerWidth / layout.playerHeight ).toBeCloseTo( 9 / 16 );
		expectNoOverlap( layout );
	} );

	it( 'stacks the panel beneath a 9:16 video when the column has no room to widen', () => {
		// Beside the panel the video would shrink to a quarter of its size.
		const layout = computeTranscriptLayout( { stageWidth: 337.5, stageHeight: 600, ratio: 9 / 16, room: 337.5 } );

		expect( layout ).toEqual( { mode: 'below', width: 337.5, panelHeight: BELOW_MAX_HEIGHT } );
	} );

	it( 'stacks the panel beneath the video on a phone-width 16:9 player', () => {
		const layout = computeTranscriptLayout( { stageWidth: 375, stageHeight: 211, ratio: 16 / 9, room: 375 } );

		expect( layout ).toEqual( { mode: 'below', width: 375, panelHeight: BELOW_MIN_HEIGHT } );
	} );

	it( 'keeps a stacked layout inside the lightbox height by shrinking the video', () => {
		// Phone lightbox: a 9:16 video fills 359x638 of a 710px cap.
		const layout = computeTranscriptLayout( { stageWidth: 359, stageHeight: 638, ratio: 9 / 16, room: 359, maxHeight: 710 } );

		expect( layout.mode ).toBe( 'below' );
		const stageHeight = layout.width / ( 9 / 16 );
		expect( stageHeight + layout.panelHeight ).toBeLessThanOrEqual( 710.5 );
		// 638 + 360 would overflow; the video keeps half the cap, the panel the rest.
		expect( stageHeight ).toBeCloseTo( 355 );
		expect( layout.panelHeight ).toBe( 355 );
	} );

	it( 'never shrinks the video below half the lightbox height', () => {
		const layout = computeTranscriptLayout( { stageWidth: 300, stageHeight: 533, ratio: 9 / 16, room: 300, maxHeight: 500 } );
		const stageHeight = layout.width / ( 9 / 16 );

		expect( stageHeight ).toBeCloseTo( 250 );
		expect( layout.panelHeight ).toBe( 250 );
	} );

	it( 'leaves a stacked layout alone when it already fits the cap', () => {
		expect( computeTranscriptLayout( { stageWidth: 375, stageHeight: 211, ratio: 16 / 9, room: 375, maxHeight: 700 } ) )
			.toEqual( { mode: 'below', width: 375, panelHeight: BELOW_MIN_HEIGHT } );
	} );

	it( 'stacks the panel under a 16:9 video in a typical content column, and goes beside it on wider players', () => {
		const layouts = [ 400, 480, 600, 645, 720, 740, 760, 960, 1200 ].map( ( stageWidth ) => computeTranscriptLayout( {
			stageWidth,
			stageHeight: stageWidth * 9 / 16,
			ratio: 16 / 9,
			room: stageWidth,
		} ) );
		const side = layouts.filter( ( layout ) => layout.mode === 'side' );

		expect( layouts.map( ( layout ) => layout.mode ) ).toEqual( [
			'below', 'below', 'below', 'below', 'below', 'side', 'side', 'side', 'side',
		] );
		side.forEach( ( layout ) => {
			// Keeps the desktop control layout (the compact one starts below 480px).
			expect( layout.playerWidth ).toBeGreaterThanOrEqual( 480 );
			expectNoOverlap( layout );
		} );
	} );

	it( 'falls back to stacking when the stage has not been laid out', () => {
		expect( computeTranscriptLayout( { stageWidth: 0, stageHeight: 0, ratio: 16 / 9, room: 0 } ).mode ).toBe( 'below' );
	} );
} );

describe( 'normaliseQuery', () => {
	it( 'trims, collapses whitespace and lower-cases', () => {
		expect( normaliseQuery( '  Hello   World ' ) ).toBe( 'hello world' );
		expect( normaliseQuery( '' ) ).toBe( '' );
		expect( normaliseQuery( undefined ) ).toBe( '' );
	} );
} );

describe( 'findMatchRanges', () => {
	it( 'finds every case-insensitive occurrence', () => {
		expect( findMatchRanges( 'Video SEO for video sites', 'video' ) ).toEqual( [ [ 0, 5 ], [ 14, 19 ] ] );
	} );

	it( 'returns nothing for an empty query or no match', () => {
		expect( findMatchRanges( 'anything', '' ) ).toEqual( [] );
		expect( findMatchRanges( 'anything', 'zebra' ) ).toEqual( [] );
	} );

	it( 'does not overlap matches', () => {
		expect( findMatchRanges( 'aaaa', 'aa' ) ).toEqual( [ [ 0, 2 ], [ 2, 4 ] ] );
	} );

	it( 'matches a phrase across a line break or extra spaces in the cue', () => {
		expect( findMatchRanges( 'the\nquick  fox', normaliseQuery( 'Quick fox' ) ) ).toEqual( [ [ 4, 14 ] ] );
		expect( findMatchRanges( 'the\nquick', normaliseQuery( 'the quick' ) ) ).toEqual( [ [ 0, 9 ] ] );
	} );

	it( 'indexes the text as displayed when lower-casing changes its length', () => {
		// "İ".toLowerCase() is two code units; the range must still cover "Ankara".
		const text = 'İstanbul and Ankara';
		const [ [ start, end ] ] = findMatchRanges( text, 'ankara' );
		expect( text.slice( start, end ) ).toBe( 'Ankara' );
	} );

	it( 'treats regular expression characters in the query as text', () => {
		expect( findMatchRanges( 'Price (USD) is $5.00', normaliseQuery( '(usd)' ) ) ).toEqual( [ [ 6, 11 ] ] );
		expect( findMatchRanges( 'a.c abc', 'a.c' ) ).toEqual( [ [ 0, 3 ] ] );
	} );
} );
