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
		// the video scales down a little rather than being covered.
		const layout = computeTranscriptLayout( { stageWidth: 337.5, stageHeight: 600, ratio: 9 / 16, room: 580 } );

		expect( layout.mode ).toBe( 'side' );
		expect( layout.width ).toBe( 580 );
		expect( layout.playerWidth ).toBe( 580 - layout.panelWidth );
		expect( layout.playerWidth / layout.playerHeight ).toBeCloseTo( 9 / 16 );
		expectNoOverlap( layout );
	} );

	it( 'stacks the panel beneath a 9:16 video when the column has no room to widen', () => {
		const layout = computeTranscriptLayout( { stageWidth: 337.5, stageHeight: 600, ratio: 9 / 16, room: 337.5 } );

		expect( layout ).toEqual( { mode: 'below', panelHeight: BELOW_MAX_HEIGHT } );
	} );

	it( 'stacks the panel beneath the video on a phone-width 16:9 player', () => {
		const layout = computeTranscriptLayout( { stageWidth: 375, stageHeight: 211, ratio: 16 / 9, room: 375 } );

		expect( layout ).toEqual( { mode: 'below', panelHeight: BELOW_MIN_HEIGHT } );
	} );

	it( 'never returns a side layout that would make the video narrower than the minimum', () => {
		const layouts = [ 400, 480, 520, 540, 560, 640, 720, 960, 1200 ].map( ( stageWidth ) => computeTranscriptLayout( {
			stageWidth,
			stageHeight: stageWidth * 9 / 16,
			ratio: 16 / 9,
			room: stageWidth,
		} ) );
		const side = layouts.filter( ( layout ) => layout.mode === 'side' );

		expect( layouts.map( ( layout ) => layout.mode ) ).toEqual( [
			'below', 'below', 'below', 'side', 'side', 'side', 'side', 'side', 'side',
		] );
		side.forEach( ( layout ) => {
			expect( layout.playerWidth ).toBeGreaterThanOrEqual( 280 );
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
} );
