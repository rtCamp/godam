/**
 * Internal dependencies
 */
import { LAYER_KPI_SPEC, actionRate, buildLayerKpis } from './layerKpis';
import { LAYER_TYPES } from '../constants/layerTypes';

describe( 'actionRate', () => {
	it( 'divides the action by the row\'s impressions', () => {
		expect( actionRate( { viewed: 200, clicked: 50 }, 'clicked' ) ).toBe( 25 );
	} );

	it( 'treats a missing action as zero', () => {
		expect( actionRate( { viewed: 10 }, 'added_to_cart' ) ).toBe( 0 );
	} );

	it( 'returns null with no impressions, so the tile shows a dash not 0%', () => {
		expect( actionRate( { viewed: 0, clicked: 3 }, 'clicked' ) ).toBeNull();
		expect( actionRate( {}, 'clicked' ) ).toBeNull();
		expect( actionRate( undefined, 'clicked' ) ).toBeNull();
	} );

	it( 'does not clamp above 100%, so disagreeing counts stay visible', () => {
		expect( actionRate( { viewed: 10, clicked: 12 }, 'clicked' ) ).toBe( 120 );
	} );
} );

describe( 'LAYER_KPI_SPEC', () => {
	it( 'covers every registered layer type', () => {
		const registered = LAYER_TYPES.map( ( t ) => t.id ).sort();
		expect( Object.keys( LAYER_KPI_SPEC ).sort() ).toEqual( registered );
	} );

	it( 'gives every type a primary tile and exactly two secondary tiles', () => {
		Object.values( LAYER_KPI_SPEC ).forEach( ( spec ) => {
			expect( spec.primary ).toBeTruthy();
			expect( spec.primary.label ).toBeTruthy();
			expect( spec.primary.tooltip ).toBeTruthy();
			expect( spec.secondary ).toHaveLength( 2 );
		} );
	} );

	it( 'only fills the donut arc with an action the type\'s funnel tracks', () => {
		Object.entries( LAYER_KPI_SPEC ).forEach( ( [ id, spec ] ) => {
			const funnel = LAYER_TYPES.find( ( t ) => t.id === id ).funnel;
			expect( funnel ).toContain( spec.donutArc );
		} );
	} );

	it( 'labels the retention-derived tile "Viewer Reach", never "Impressions"', () => {
		// Reach and Impressions count different populations, so the two must
		// never borrow each other's wording.
		const allTiles = Object.values( LAYER_KPI_SPEC ).flatMap( ( spec ) => [
			spec.primary,
			...spec.secondary,
		] );
		const reachLabels = allTiles
			.filter( ( tile ) => tile.kind === 'reachRate' )
			.map( ( tile ) => tile.label );
		const countLabels = allTiles
			.filter( ( tile ) => tile.kind === 'count' )
			.map( ( tile ) => tile.label );

		expect( reachLabels.length ).toBeGreaterThan( 0 );
		expect( reachLabels.every( ( label ) => /Reach/.test( label ) ) ).toBe( true );
		expect( countLabels.some( ( label ) => /Reach/.test( label ) ) ).toBe( false );
	} );
} );

describe( 'buildLayerKpis', () => {
	const retention = [ 100, 90, 80, 70, 60 ];

	it( 'returns null for an unknown layer type', () => {
		expect( buildLayerKpis( { layerType: 'audio', counts: {} } ) ).toBeNull();
	} );

	it( 'builds the CTA panel: CTR primary, reach rate + impressions', () => {
		const kpis = buildLayerKpis( {
			layerType: 'cta',
			counts: { viewed: 200, clicked: 50, skipped: 20 },
			noAction: 130,
			retentionArray: retention,
			timestamp: 2,
		} );

		expect( kpis.primary.id ).toBe( 'ctr' );
		expect( kpis.primary.value ).toBe( 25 );
		expect( kpis.secondary.map( ( t ) => t.id ) ).toEqual( [
			'reach-rate',
			'impressions',
		] );
		// 80 viewers at second 2 out of 100 starters.
		expect( kpis.secondary[ 0 ].value ).toBe( 80 );
		expect( kpis.secondary[ 1 ].value ).toBe( 200 );
	} );

	it( 'puts reach in the donut centre and the arc action as a share of impressions', () => {
		const kpis = buildLayerKpis( {
			layerType: 'cta',
			counts: { viewed: 200, clicked: 50 },
			retentionArray: retention,
			timestamp: 4,
		} );

		expect( kpis.donut.reach ).toBe( 60 );
		expect( kpis.donut.arcAction ).toBe( 'clicked' );
		expect( kpis.donut.arcValue ).toBe( 50 );
		expect( kpis.donut.arcShare ).toBe( 25 );
	} );

	it( 'exposes no_action as an addressable numerator for the Form abandon tile', () => {
		const kpis = buildLayerKpis( {
			layerType: 'form',
			counts: { viewed: 100, submitted: 24, skipped: 16 },
			noAction: 60,
			retentionArray: retention,
			timestamp: 1,
		} );

		const byId = Object.fromEntries(
			[ kpis.primary, ...kpis.secondary ].map( ( t ) => [ t.id, t.value ] ),
		);
		expect( byId[ 'submission-rate' ] ).toBe( 24 );
		expect( byId[ 'abandon-rate' ] ).toBe( 60 );
		expect( byId[ 'skip-rate' ] ).toBe( 16 );
		// The decision behind the definition: the three account for everything.
		expect(
			byId[ 'submission-rate' ] + byId[ 'abandon-rate' ] + byId[ 'skip-rate' ],
		).toBe( 100 );
		// The Form donut ring is the abandoned share, per the Figma tooltip.
		expect( kpis.donut.arcAction ).toBe( 'no_action' );
		expect( kpis.donut.arcValue ).toBe( 60 );
	} );

	it( 'reports unknown reach as null so the donut can hide instead of showing 0', () => {
		const kpis = buildLayerKpis( {
			layerType: 'cta',
			counts: { viewed: 10, clicked: 1 },
			retentionArray: [],
			timestamp: 2,
		} );
		expect( kpis.donut.reach ).toBeNull();
		expect( kpis.secondary[ 0 ].value ).toBeNull();
		// Impression-based tiles still work without retention data.
		expect( kpis.primary.value ).toBe( 10 );
	} );

	it( 'reports unknown reach for a layer positioned past the recorded length', () => {
		const kpis = buildLayerKpis( {
			layerType: 'hotspot',
			counts: { viewed: 40, clicked: 10, hovered: 20 },
			retentionArray: retention,
			timestamp: 99,
		} );
		expect( kpis.donut.reach ).toBeNull();
		expect( kpis.primary.value ).toBe( 25 );
	} );

	it( 'builds Woo from add-to-cart, not from clicks', () => {
		const kpis = buildLayerKpis( {
			layerType: 'woo',
			counts: { viewed: 50, clicked: 10, added_to_cart: 5, hovered: 30 },
			retentionArray: retention,
			timestamp: 0,
		} );
		expect( kpis.primary.id ).toBe( 'add-to-cart-rate' );
		expect( kpis.primary.value ).toBe( 10 );
		expect( kpis.secondary[ 0 ].id ).toBe( 'product-click-rate' );
		expect( kpis.secondary[ 0 ].value ).toBe( 20 );
		expect( kpis.donut.arcAction ).toBe( 'added_to_cart' );
	} );

	it( 'is pure, so the same inputs give an equal result twice over', () => {
		const args = {
			layerType: 'poll',
			counts: { viewed: 80, voted: 20, skipped: 10 },
			noAction: 50,
			retentionArray: retention,
			timestamp: 3,
		};
		expect( buildLayerKpis( args ) ).toEqual( buildLayerKpis( args ) );
	} );

	it( 'tolerates a missing counts object', () => {
		const kpis = buildLayerKpis( { layerType: 'cta', retentionArray: retention } );
		expect( kpis.primary.value ).toBeNull();
		expect( kpis.donut.arcValue ).toBe( 0 );
	} );
} );
