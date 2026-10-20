/**
 * Internal dependencies
 */
import {
	BELOW_MAX_HEIGHT,
	BELOW_MIN_HEIGHT,
	CAPPED_MIN_PANEL_HEIGHT,
	CAPPED_MIN_PLAYER_WIDTH,
	PANEL_MAX_WIDTH,
	PANEL_MIN_WIDTH,
	computeTranscriptLayout,
	compileQuery,
	findMatchRanges,
	matchRanges,
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

	it( 'keeps a stacked layout inside the lightbox height by shrinking the video, but not below 300px wide', () => {
		// Phone lightbox (393x852): a 9:16 video fills 362x643 of a 716.8px cap.
		// Shrunk to half the cap it would be 202px wide, with its skip buttons
		// overlapping; it stays 300px wide and the panel takes the rest.
		const layout = computeTranscriptLayout( { stageWidth: 362, stageHeight: 643, ratio: 9 / 16, room: 362, maxHeight: 716.8 } );

		expect( layout.mode ).toBe( 'below' );
		expect( layout.width ).toBeCloseTo( CAPPED_MIN_PLAYER_WIDTH );
		const stageHeight = layout.width / ( 9 / 16 );
		expect( stageHeight ).toBeCloseTo( 533.3, 1 );
		expect( layout.panelHeight ).toBe( 183 );
		expect( stageHeight + layout.panelHeight ).toBeLessThanOrEqual( 717.3 );
	} );

	it( 'leaves a 16:9 video in a phone lightbox at its full width', () => {
		expect( computeTranscriptLayout( { stageWidth: 362, stageHeight: 203.6, ratio: 16 / 9, room: 362, maxHeight: 716.8 } ) )
			.toEqual( { mode: 'below', width: 362, panelHeight: BELOW_MIN_HEIGHT } );
	} );

	it( 'keeps the panel at least 160px tall on a short cap, shrinking the video for it', () => {
		// A landscape phone: a 9:16 video 203x360 under a 360px cap.
		const layout = computeTranscriptLayout( { stageWidth: 203, stageHeight: 360, ratio: 9 / 16, room: 203, maxHeight: 360 } );
		const stageHeight = layout.width / ( 9 / 16 );

		expect( layout.panelHeight ).toBe( CAPPED_MIN_PANEL_HEIGHT );
		expect( stageHeight ).toBeCloseTo( 200 );
		expect( layout.width ).toBeLessThan( 203 );
	} );

	it( 'uses the closed width as the floor when the video is already narrower than 300px', () => {
		const layout = computeTranscriptLayout( { stageWidth: 250, stageHeight: 444.4, ratio: 9 / 16, room: 250, maxHeight: 700 } );

		expect( layout.width ).toBeCloseTo( 250 );
		expect( layout.panelHeight ).toBe( 256 );
	} );

	it( 'never shrinks the video below half the lightbox height', () => {
		// So small a cap that even the panel minimum would leave the video
		// under half of it: the video keeps half, the panel the rest.
		const layout = computeTranscriptLayout( { stageWidth: 300, stageHeight: 533, ratio: 9 / 16, room: 300, maxHeight: 300 } );
		const stageHeight = layout.width / ( 9 / 16 );

		expect( stageHeight ).toBeCloseTo( 150 );
		expect( layout.panelHeight ).toBe( 150 );
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

describe( 'compileQuery and matchRanges', () => {
	it( 'match like findMatchRanges, with one pattern reused across cues', () => {
		const pattern = compileQuery( normaliseQuery( 'Video' ) );

		// A global pattern remembers where it stopped; each cue starts afresh.
		expect( matchRanges( 'Video SEO for video sites', pattern ) ).toEqual( [ [ 0, 5 ], [ 14, 19 ] ] );
		expect( matchRanges( 'video first', pattern ) ).toEqual( [ [ 0, 5 ] ] );
		expect( matchRanges( 'no match here', pattern ) ).toEqual( [] );
		expect( matchRanges( 'a video', pattern ) ).toEqual( [ [ 2, 7 ] ] );
	} );

	it( 'compiles nothing for an empty query', () => {
		expect( compileQuery( '' ) ).toBeNull();
		expect( matchRanges( 'anything', null ) ).toEqual( [] );
	} );
} );
