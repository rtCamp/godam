/**
 * Tests for the player loader (`frontend.js`): which players start at page load,
 * which wait until they near the viewport, and what an interaction starts.
 *
 * The runtime chunk is mocked, so these tests check what the loader asks for
 * and that it never loads the runtime for a video that is out of view.
 */

/**
 * Mocked runtime module, recreated for each isolated load of the loader.
 *
 * @type {Object}
 */
let runtime;

/**
 * IntersectionObserver instances created by the loader.
 *
 * @type {Array<Object>}
 */
let observers;

class MockIntersectionObserver {
	constructor( callback, options ) {
		this.callback = callback;
		this.options = options;
		this.targets = new Set();
		observers.push( this );
	}

	observe( target ) {
		this.targets.add( target );
	}

	unobserve( target ) {
		this.targets.delete( target );
	}

	disconnect() {
		this.targets.clear();
	}

	/**
	 * Report targets as intersecting, the way the browser would.
	 *
	 * @param {Array<Element>} targets - Elements now near the viewport.
	 */
	trigger( targets ) {
		this.callback( targets.map( ( target ) => ( { target, isIntersecting: true } ) ), this );
	}
}

/**
 * Markup for one GoDAM video, as the server renders it (trimmed).
 *
 * @param {Object} [options]                 - Options.
 * @param {string} [options.id]              - Attachment ID.
 * @param {string} [options.performanceMode] - `balanced` or `priority`.
 * @param {string} [options.title]           - Video title.
 * @return {string} The markup.
 */
const videoMarkup = ( { id = '1', performanceMode = 'balanced', title = 'Demo' } = {} ) => `
	<div class="wp-block-godam-video">
		<figure id="godam-player-container-${ id }">
			<div class="godam-video-wrapper">
				<div class="godam-video-placeholder godam-blurred-img">
					<div class="animate-play-btn"></div>
					<img class="godam-player-poster-image" alt="" />
				</div>
				<div class="easydam-video-container loading">
					<video class="easydam-player video-js" data-id="${ id }" data-instance-id="i${ id }"
						data-video-title="${ title }" data-performance-mode="${ performanceMode }"></video>
				</div>
			</div>
		</figure>
	</div>`;

/**
 * Load a fresh copy of the loader, as a page load would.
 *
 * @return {Object} The loader module.
 */
const loadLoader = () => {
	// The mock factory runs when the loader first imports the runtime, so
	// `runtime` stays null for as long as the runtime has not been loaded.
	jest.doMock( './runtime.js', () => {
		runtime = {
			initVideos: jest.fn( () => Promise.resolve() ),
			startVideo: jest.fn( () => Promise.resolve( {} ) ),
			openLightboxForId: jest.fn( () => true ),
			syncLightboxWithUrl: jest.fn(),
		};
		return runtime;
	} );
	return require( './frontend.js' );
};

/**
 * Let pending promise callbacks (the runtime import) run.
 *
 * @return {Promise<void>} Resolves after queued microtasks.
 */
const flush = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

/**
 * Collect every element the loader's observers are watching.
 *
 * @return {Array<Element>} Observed elements.
 */
const observedElements = () => observers.flatMap( ( observer ) => [ ...observer.targets ] );

/**
 * Listeners the loader added to `document` and `window` during a test.
 *
 * @type {Array<Array>}
 */
let addedListeners = [];

/**
 * Record listeners added to a target, so a test can remove them afterwards:
 * each test is a fresh page load, and the previous loader's delegated
 * listeners must not handle the next test's events.
 *
 * @param {EventTarget} target - `document` or `window`.
 */
const trackListeners = ( target ) => {
	const original = target.addEventListener.bind( target );
	jest.spyOn( target, 'addEventListener' ).mockImplementation( ( ...args ) => {
		addedListeners.push( [ target, ...args ] );
		return original( ...args );
	} );
};

describe( 'GoDAM player loader', () => {
	beforeEach( () => {
		addedListeners = [];
		trackListeners( document );
		trackListeners( window );
		// A fresh module registry per test: each test is a new page load.
		jest.resetModules();
		observers = [];
		runtime = null;
		window.IntersectionObserver = MockIntersectionObserver;
		delete window.godamPlayerLoader;
		delete window.godamPlayerLoaderConfig;
		delete window.GODAMPlayer;
		delete document.documentElement.dataset.godamLightboxTriggers;
		window.history.replaceState( null, '', '/' );
	} );

	afterEach( () => {
		addedListeners.forEach( ( [ target, type, listener, options ] ) =>
			target.removeEventListener( type, listener, options ),
		);
		jest.restoreAllMocks();
		document.body.innerHTML = '';
	} );

	it( 'does not load the runtime for a Balanced video until it nears the viewport', async () => {
		document.body.innerHTML = videoMarkup();
		loadLoader();
		await flush();

		expect( runtime ).toBeNull();

		const wrapper = document.querySelector( '.godam-video-wrapper' );
		expect( observedElements() ).toEqual( [ wrapper ] );
		expect( observers[ 0 ].options.rootMargin ).toBe( '300px 0px' );

		observers[ 0 ].trigger( [ wrapper ] );
		await flush();

		const video = document.querySelector( 'video' );
		expect( runtime.initVideos ).toHaveBeenCalledWith( [ video ] );
		// A started video is no longer watched.
		expect( observedElements() ).toEqual( [] );
	} );

	it( 'starts Priority videos at page load and watches the rest', async () => {
		document.body.innerHTML =
			videoMarkup( { id: '1', performanceMode: 'priority' } ) + videoMarkup( { id: '2' } );
		loadLoader();
		await flush();

		const [ hero, below ] = document.querySelectorAll( 'video' );
		expect( runtime.initVideos ).toHaveBeenCalledTimes( 1 );
		expect( runtime.initVideos ).toHaveBeenCalledWith( [ hero ] );
		expect( observedElements() ).toEqual( [ below.closest( '.godam-video-wrapper' ) ] );
	} );

	it( 'starts every video at once when the page opts in to eager loading', async () => {
		window.godamPlayerLoaderConfig = { eager: true };
		document.body.innerHTML = videoMarkup( { id: '1' } ) + videoMarkup( { id: '2' } );
		loadLoader();
		await flush();

		expect( runtime.initVideos ).toHaveBeenCalledWith( [ ...document.querySelectorAll( 'video' ) ] );
		expect( observers ).toHaveLength( 0 );
	} );

	it( 'starts every video at once without IntersectionObserver support', async () => {
		delete window.IntersectionObserver;
		document.body.innerHTML = videoMarkup();
		loadLoader();
		await flush();

		expect( runtime.initVideos ).toHaveBeenCalledWith( [ document.querySelector( 'video' ) ] );
	} );

	it( 'loads the runtime at once for a deep link', async () => {
		window.history.replaceState( null, '', '/#godam-video-1' );
		document.body.innerHTML = videoMarkup();
		loadLoader();
		await flush();

		expect( runtime ).not.toBeNull();
	} );

	it( 'starts and plays a video when its poster is clicked before it is in range', async () => {
		document.body.innerHTML = videoMarkup();
		loadLoader();

		const placeholder = document.querySelector( '.godam-video-placeholder' );
		const click = new MouseEvent( 'click', { bubbles: true, cancelable: true } );
		placeholder.dispatchEvent( click );
		await flush();

		expect( click.defaultPrevented ).toBe( true );
		expect( runtime.startVideo ).toHaveBeenCalledWith( document.querySelector( 'video' ), { play: true } );
	} );

	it( 'makes the poster a keyboard-operable play button before the player exists', () => {
		document.body.innerHTML = videoMarkup( { title: 'Launch film' } );
		loadLoader();

		const placeholder = document.querySelector( '.godam-video-placeholder' );
		expect( placeholder.getAttribute( 'role' ) ).toBe( 'button' );
		expect( placeholder.getAttribute( 'tabindex' ) ).toBe( '0' );
		expect( placeholder.getAttribute( 'aria-label' ) ).toBe( 'Play video: Launch film' );
	} );

	it( 'reveals the blur-up poster without loading the runtime', async () => {
		document.body.innerHTML = videoMarkup();
		loadLoader();

		const img = document.querySelector( '.godam-player-poster-image' );
		img.dispatchEvent( new Event( 'load' ) );
		await flush();

		expect( document.querySelector( '.godam-blurred-img' ).classList.contains( 'loaded' ) ).toBe( true );
		expect( runtime ).toBeNull();
	} );

	it( 'opens the lightbox from a trigger by loading the runtime first', async () => {
		document.body.innerHTML = '<button data-godam-lightbox="42" data-godam-lightbox-t="5">Watch</button>';
		loadLoader();

		document.querySelector( 'button' ).dispatchEvent(
			new MouseEvent( 'click', { bubbles: true, cancelable: true } ),
		);
		await flush();

		expect( runtime.openLightboxForId ).toHaveBeenCalledWith(
			'42',
			expect.objectContaining( { startTime: 5 } ),
		);
	} );

	it( 'GODAMPlayer( element ) starts the players inside it straight away', async () => {
		document.body.innerHTML = videoMarkup( { id: '1' } ) + '<div id="late"></div>';
		loadLoader();

		const late = document.getElementById( 'late' );
		late.innerHTML = videoMarkup( { id: '2' } );
		window.GODAMPlayer( late );
		await flush();

		expect( runtime.initVideos ).toHaveBeenCalledWith( [ late.querySelector( 'video' ) ] );
	} );

	it( 'GODAMPlayer() without an element only registers new videos to start lazily', async () => {
		document.body.innerHTML = videoMarkup( { id: '1' } );
		loadLoader();

		document.body.insertAdjacentHTML( 'beforeend', videoMarkup( { id: '2' } ) );
		window.GODAMPlayer();
		await flush();

		expect( runtime ).toBeNull();
		expect( observedElements() ).toHaveLength( 2 );
	} );
} );
