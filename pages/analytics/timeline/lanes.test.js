/**
 * Internal dependencies
 */
import { assignLanes } from './lanes';

// A marker is positioned only by its `timestamp`; nothing else matters to lanes.
const at = ( timestamp ) => ( { timestamp } );

describe( 'assignLanes', () => {
	it( 'keeps well-spaced markers on a single lane', () => {
		// 0s / 50s / 100s over a 100s video on a 1000px strip → 0/500/1000px apart.
		const { lanes, laneCount } = assignLanes(
			[ at( 0 ), at( 50 ), at( 100 ) ],
			100,
			1000,
		);
		expect( lanes ).toEqual( [ 0, 0, 0 ] );
		expect( laneCount ).toBe( 1 );
	} );

	it( 'staggers three near-simultaneous markers onto lanes 0/1/2', () => {
		// 0 / 0.1 / 0.2s → ~0/1/2px apart, all within MIN_GAP_PX → a staircase.
		const { lanes, laneCount } = assignLanes(
			[ at( 0 ), at( 0.1 ), at( 0.2 ) ],
			100,
			1000,
		);
		expect( lanes ).toEqual( [ 0, 1, 2 ] );
		expect( laneCount ).toBe( 3 );
	} );

	it( 'returns a marker to lane 0 once there is room again', () => {
		// Two collide (0, 0.1s), the third (80s) is far → back to lane 0.
		const { lanes } = assignLanes(
			[ at( 0 ), at( 0.1 ), at( 80 ) ],
			100,
			1000,
		);
		expect( lanes ).toEqual( [ 0, 1, 0 ] );
	} );

	it( 'clamps out-of-range timestamps and never overlaps within a lane', () => {
		// Two markers both at/after the end clamp to 100% → same x → must split.
		const { lanes } = assignLanes( [ at( 100 ), at( 200 ) ], 100, 1000 );
		expect( lanes ).toEqual( [ 0, 1 ] );
	} );

	it( 'handles an empty marker list', () => {
		expect( assignLanes( [], 100, 1000 ) ).toEqual( {
			lanes: [],
			laneCount: 0,
		} );
	} );
} );
