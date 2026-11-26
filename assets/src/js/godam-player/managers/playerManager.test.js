/**
 * Tests for PlayerManager batching: players start in batches as they near the
 * viewport, so page-wide setup must happen once and every batch must be
 * covered by the shared autoplay-on-view observer.
 */

/**
 * Internal dependencies
 */
import PlayerManager from './playerManager';
import VideoPlayer from '../videoPlayer.js';
import { getLightbox } from './modalManager.js';

jest.mock( '../videoPlayer.js', () =>
	jest.fn().mockImplementation( () => ( { initialize: jest.fn( () => Promise.resolve() ) } ) ),
);

jest.mock( './modalManager.js', () => {
	const lightbox = { register: jest.fn() };
	return { getLightbox: jest.fn( () => lightbox ) };
} );

jest.mock( '../utils/playerReady.js', () => ( {
	whenPlayerReady: jest.fn( () => new Promise( () => {} ) ),
} ) );

jest.mock( 'isomorphic-dompurify', () => ( { sanitize: ( html ) => html } ) );

/**
 * IntersectionObserver instances created during a test.
 *
 * @type {Array<Object>}
 */
const observers = [];

class MockIntersectionObserver {
	constructor( callback, options ) {
		this.callback = callback;
		this.options = options;
		this.targets = [];
		observers.push( this );
	}

	observe( target ) {
		this.targets.push( target );
	}

	unobserve() {}

	disconnect() {}
}

/**
 * Render GoDAM `<video>` elements and return them.
 *
 * @param {Array<Object>} videos - Data attributes for each video.
 * @return {Array<HTMLElement>} The videos.
 */
const renderVideos = ( videos ) => {
	const html = videos
		.map(
			( data, index ) =>
				`<video class="easydam-player video-js" data-instance-id="v${ index }-${ Math.random() }"${ Object.entries( data )
					.map( ( [ key, value ] ) => ` data-${ key }="${ value }"` )
					.join( '' ) }></video>`,
		)
		.join( '' );
	document.body.insertAdjacentHTML( 'beforeend', html );
	return Array.from( document.querySelectorAll( 'video' ) ).slice( -videos.length );
};

describe( 'PlayerManager batches', () => {
	beforeAll( () => {
		window.IntersectionObserver = MockIntersectionObserver;
	} );

	beforeEach( () => {
		VideoPlayer.mockClear();
		getLightbox.mockClear();
	} );

	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'starts each video once, even when batches overlap', async () => {
		const manager = new PlayerManager( null, { autoInit: false } );
		const [ first, second ] = renderVideos( [ {}, {} ] );

		await Promise.all( [
			manager.initializeVideos( [ first ] ),
			manager.initializeVideos( [ first, second ] ),
		] );

		expect( VideoPlayer ).toHaveBeenCalledTimes( 2 );
		expect( first.dataset.godamInitialized ).toBe( '1' );
		expect( second.dataset.godamInitialized ).toBe( '1' );
	} );

	it( 'dispatches godamAllPlayersReady once per batch', async () => {
		const manager = new PlayerManager( null, { autoInit: false } );
		const listener = jest.fn();
		document.addEventListener( 'godamAllPlayersReady', listener );

		await manager.initializeVideos( renderVideos( [ {} ] ) );
		await manager.initializeVideos( renderVideos( [ {} ] ) );

		expect( listener ).toHaveBeenCalledTimes( 2 );
		document.removeEventListener( 'godamAllPlayersReady', listener );
	} );

	it( 'only creates the lightbox when a batch has a lightbox video', async () => {
		const manager = new PlayerManager( null, { autoInit: false } );

		await manager.initializeVideos( renderVideos( [ {} ] ) );
		expect( getLightbox ).not.toHaveBeenCalled();

		await manager.initializeVideos( renderVideos( [ { 'show-in-lightbox': 'true' } ] ) );
		expect( getLightbox ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'watches autoplay-on-view videos from every batch with one shared observer', async () => {
		const manager = new PlayerManager( null, { autoInit: false } );
		const [ early ] = renderVideos( [ { 'autoplay-on-view': 'true' } ] );
		await manager.initializeVideos( [ early ] );

		const [ late ] = renderVideos( [ { 'autoplay-on-view': 'true' }, {} ] );
		await manager.initializeVideos( document.querySelectorAll( 'video' ) );

		const autoplayObservers = observers.filter( ( observer ) => observer.options.threshold === 0.35 );
		expect( autoplayObservers ).toHaveLength( 1 );
		expect( autoplayObservers[ 0 ].targets ).toEqual( [ early, late ] );
	} );
} );

describe( 'PlayerManager.playVideoWhenReady', () => {
	/**
	 * A minimal Video.js player double.
	 *
	 * @param {Object} state            - Player state.
	 * @param {number} state.readyState - Value `readyState()` returns.
	 * @param {string} state.preload    - Value `preload()` returns.
	 * @return {Object} The player.
	 */
	const makePlayer = ( { readyState, preload } ) => ( {
		muted: jest.fn(),
		play: jest.fn( () => Promise.resolve() ),
		readyState: () => readyState,
		preload: () => preload,
		one: jest.fn(),
		isDisposed: () => false,
	} );

	it( 'asks to play straight away when nothing preloads, instead of waiting for data', () => {
		const manager = new PlayerManager( null, { autoInit: false } );
		const player = makePlayer( { readyState: 0, preload: 'none' } );

		manager.playVideoWhenReady( player );

		expect( player.muted ).toHaveBeenCalledWith( true );
		expect( player.play ).toHaveBeenCalled();
		expect( player.one ).not.toHaveBeenCalled();
	} );

	it( 'waits for loadeddata while metadata is still loading', () => {
		const manager = new PlayerManager( null, { autoInit: false } );
		const player = makePlayer( { readyState: 0, preload: 'metadata' } );

		manager.playVideoWhenReady( player );

		expect( player.play ).not.toHaveBeenCalled();
		expect( player.one ).toHaveBeenCalledWith( 'loadeddata', expect.any( Function ) );
	} );
} );
