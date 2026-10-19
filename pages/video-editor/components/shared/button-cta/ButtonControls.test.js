/**
 * Unit tests for `useDebouncedItemColor` — the debounced colour writer behind the
 * Hotspot layer's Button style pickers.
 *
 * The colour lands 150ms after the picker fires, so the write must be addressed
 * by the item's stable id: deleting a hotspot (or the whole layer) inside that
 * window must not move the edit onto a neighbour or dispatch to a missing layer.
 */

/**
 * External dependencies
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import { useDebouncedItemColor } from './ButtonControls.jsx';

// The real slice reads a `godamSettings` global at import time; only the action
// creator matters here.
jest.mock( '../../../redux/slice/videoSlice', () => ( {
	updateLayerField: ( payload ) => ( { type: 'updateLayerField', payload } ),
} ) );

const DEBOUNCE_MS = 150;

const reducer = ( state = { layers: [] }, action ) => {
	switch ( action.type ) {
		case 'setLayers':
			return { layers: action.layers };
		case 'updateLayerField': {
			const { id, field, value } = action.payload;
			return { layers: state.layers.map( ( l ) => ( l.id === id ? { ...l, [ field ]: value } : l ) ) };
		}
		default:
			return state;
	}
};

describe( 'useDebouncedItemColor', () => {
	let store, dispatched, setColor, root, container;

	const Harness = () => {
		setColor = useDebouncedItemColor( 'L1', 'hotspots' );
		return null;
	};

	const hotspots = () => store.getState().videoReducer.layers.find( ( l ) => l.id === 'L1' )?.hotspots;

	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
		jest.useFakeTimers();

		dispatched = [];
		store = configureStore( {
			reducer: { videoReducer: reducer },
			preloadedState: {
				videoReducer: {
					layers: [ { id: 'L1', hotspots: [ { id: 'A', bgColor: '#a' }, { id: 'B', bgColor: '#b' }, { id: 'C', bgColor: '#c' } ] } ],
				},
			},
			middleware: () => [
				() => ( next ) => ( action ) => {
					dispatched.push( action );
					return next( action );
				},
			],
		} );

		container = document.createElement( 'div' );
		root = createRoot( container );
		act( () => {
			root.render( <Provider store={ store }><Harness /></Provider> );
		} );
	} );

	afterEach( () => {
		if ( root ) {
			act( () => root.unmount() );
		}
		jest.useRealTimers();
	} );

	const flush = () => act( () => {
		jest.advanceTimersByTime( DEBOUNCE_MS );
	} );

	it( 'writes the colour to the right hotspot after the debounce', () => {
		setColor( 1, 'bgColor', '#new' );
		expect( hotspots()[ 1 ].bgColor ).toBe( '#b' );

		flush();

		expect( hotspots().map( ( h ) => h.bgColor ) ).toEqual( [ '#a', '#new', '#c' ] );
	} );

	it( 'collapses a burst of picker ticks into one write', () => {
		setColor( 0, 'bgColor', '#1' );
		setColor( 0, 'bgColor', '#2' );
		setColor( 0, 'bgColor', '#3' );
		flush();

		expect( dispatched.filter( ( a ) => a.type === 'updateLayerField' ) ).toHaveLength( 1 );
		expect( hotspots()[ 0 ].bgColor ).toBe( '#3' );
	} );

	it( 'keeps near-simultaneous edits to different fields of one hotspot', () => {
		setColor( 2, 'bgColor', '#bg' );
		setColor( 2, 'textColor', '#text' );
		flush();

		expect( hotspots()[ 2 ] ).toMatchObject( { id: 'C', bgColor: '#bg', textColor: '#text' } );
	} );

	it( 'does not move the colour onto a neighbour when the hotspot is deleted first', () => {
		setColor( 0, 'bgColor', '#for-A' );
		// Hotspot A is deleted before the timer fires, so B shifts into index 0.
		act( () => {
			store.dispatch( { type: 'setLayers', layers: [ { id: 'L1', hotspots: [ { id: 'B', bgColor: '#b' }, { id: 'C', bgColor: '#c' } ] } ] } );
		} );
		flush();

		expect( hotspots().map( ( h ) => h.bgColor ) ).toEqual( [ '#b', '#c' ] );
		expect( dispatched.filter( ( a ) => a.type === 'updateLayerField' ) ).toHaveLength( 0 );
	} );

	it( 'does nothing when the whole layer is removed first', () => {
		setColor( 0, 'bgColor', '#gone' );
		act( () => {
			store.dispatch( { type: 'setLayers', layers: [] } );
		} );
		flush();

		expect( dispatched.filter( ( a ) => a.type === 'updateLayerField' ) ).toHaveLength( 0 );
	} );

	it( 'ignores an index with no hotspot', () => {
		setColor( 9, 'bgColor', '#nope' );
		flush();

		expect( dispatched.filter( ( a ) => a.type === 'updateLayerField' ) ).toHaveLength( 0 );
	} );
} );
