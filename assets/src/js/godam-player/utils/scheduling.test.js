/**
 * Internal dependencies
 */
import { runWhenIdleOrPlay, yieldToMain } from './scheduling';
import { ensurePlayerStyles, DEFERRED_STYLE_ATTRIBUTE } from './playerStyles';

/**
 * A minimal Video.js player double with `one`/`off` for `play`.
 *
 * @return {Object} The player, plus `firePlay()`.
 */
const makePlayer = () => {
	const listeners = new Set();
	return {
		one: jest.fn( ( type, fn ) => listeners.add( fn ) ),
		off: jest.fn( ( type, fn ) => listeners.delete( fn ) ),
		isDisposed: () => false,
		firePlay: () => [ ...listeners ].forEach( ( fn ) => fn() ),
	};
};

describe( 'runWhenIdleOrPlay', () => {
	afterEach( () => {
		delete window.requestIdleCallback;
		delete window.cancelIdleCallback;
		jest.useRealTimers();
	} );

	it( 'runs once the browser is idle', () => {
		let idle;
		window.requestIdleCallback = jest.fn( ( fn ) => {
			idle = fn;
			return 1;
		} );
		window.cancelIdleCallback = jest.fn();
		const callback = jest.fn();

		runWhenIdleOrPlay( makePlayer(), callback );
		expect( callback ).not.toHaveBeenCalled();

		idle();
		expect( callback ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'runs at once when playback starts first, and only once', () => {
		let idle;
		window.requestIdleCallback = jest.fn( ( fn ) => {
			idle = fn;
			return 7;
		} );
		window.cancelIdleCallback = jest.fn();
		const player = makePlayer();
		const callback = jest.fn();

		runWhenIdleOrPlay( player, callback );
		player.firePlay();
		idle();

		expect( callback ).toHaveBeenCalledTimes( 1 );
		expect( window.cancelIdleCallback ).toHaveBeenCalledWith( 7 );
	} );

	it( 'falls back to a timeout without requestIdleCallback', () => {
		jest.useFakeTimers();
		const callback = jest.fn();

		runWhenIdleOrPlay( makePlayer(), callback );
		jest.runAllTimers();

		expect( callback ).toHaveBeenCalledTimes( 1 );
	} );
} );

describe( 'yieldToMain', () => {
	it( 'continues in a later task', async () => {
		const order = [];
		setTimeout( () => order.push( 'queued task' ), 0 );
		await yieldToMain();
		order.push( 'after yield' );
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

		expect( order[ 0 ] ).toBe( 'queued task' );
	} );
} );

describe( 'ensurePlayerStyles', () => {
	afterEach( () => {
		document.head.innerHTML = '';
	} );

	it( 'switches deferred stylesheets on and waits for them to load', async () => {
		document.head.innerHTML = `<link rel="stylesheet" href="player.css" media="print" ${ DEFERRED_STYLE_ATTRIBUTE }="all">`;
		const link = document.querySelector( 'link' );

		let settled = false;
		const pending = ensurePlayerStyles().then( () => {
			settled = true;
		} );

		expect( link.media ).toBe( 'all' );
		await Promise.resolve();
		expect( settled ).toBe( false );

		link.dispatchEvent( new Event( 'load' ) );
		await pending;
		expect( settled ).toBe( true );
	} );

	it( 'does not wait forever for a stylesheet that never loads', async () => {
		jest.useFakeTimers();
		document.head.innerHTML = `<link rel="stylesheet" href="player.css" media="print" ${ DEFERRED_STYLE_ATTRIBUTE }="all">`;

		const pending = ensurePlayerStyles( { timeout: 50 } );
		jest.advanceTimersByTime( 50 );
		await expect( pending ).resolves.toBeUndefined();
		jest.useRealTimers();
	} );

	it( 'leaves other stylesheets alone', async () => {
		document.head.innerHTML = '<link rel="stylesheet" href="other.css" media="print">';
		await ensurePlayerStyles();
		expect( document.querySelector( 'link' ).media ).toBe( 'print' );
	} );
} );
