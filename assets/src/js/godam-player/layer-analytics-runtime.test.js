/**
 * Tests for the standalone layer-analytics runtime that image pages boot
 * (no video player). Guards the behaviours the image feature relies on:
 * the findVideoElementById image fallback (so a still image resolves its
 * data-block-source at flush), initLayerAnalytics's idempotent registration
 * plus single flush-listener bind, and the visitor id (window.analytics) that
 * the flush and the Woo add-on's in-image add-to-cart send as user_token.
 */
/**
 * Internal dependencies
 */
import { initLayerAnalytics, findVideoElementById } from './layer-analytics-runtime';

// webpack follows @analytics/core's package.json `browser` field and bundles its
// client build; jest does not, and would load the server build. Point jest at the
// client build so these tests run the same library code the bundles ship.
jest.mock( '@analytics/core', () => jest.requireActual( '@analytics/core/client' ) );

describe( 'findVideoElementById', () => {
	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'resolves the video-js element by data-id', () => {
		document.body.innerHTML = '<div class="easydam-player video-js" data-id="7"></div>';
		expect( findVideoElementById( 7 )?.getAttribute( 'data-id' ) ).toBe( '7' );
	} );

	it( 'falls back to the image frame, so an image page can read its data-block-source', () => {
		document.body.innerHTML =
			'<div class="godam-image__frame" data-id="31" data-block-source="godam-image"></div>';
		const el = findVideoElementById( 31 );
		expect( el ).not.toBeNull();
		expect( el.dataset.blockSource ).toBe( 'godam-image' );
	} );

	it( 'prefers the video element over an image frame sharing the id', () => {
		document.body.innerHTML =
			'<div class="godam-image__frame" data-id="9"></div><div class="video-js" data-id="9"></div>';
		expect( findVideoElementById( 9 )?.classList.contains( 'video-js' ) ).toBe( true );
	} );

	it( 'returns null when neither is present', () => {
		expect( findVideoElementById( 404 ) ).toBeNull();
	} );
} );

describe( 'initLayerAnalytics', () => {
	beforeEach( () => {
		delete window.GoDAM;
		delete window.godamLayerFlushBound;
	} );

	it( 'registers the buffer API when the video bundle has not', () => {
		initLayerAnalytics();
		expect( typeof window.GoDAM.addLayerInteraction ).toBe( 'function' );
		expect( typeof window.GoDAM.flushLayerInteractions ).toBe( 'function' );
	} );

	it( 'does not overwrite an existing addLayerInteraction (video bundle wins)', () => {
		const existing = jest.fn();
		window.GoDAM = { addLayerInteraction: existing };
		initLayerAnalytics();
		expect( window.GoDAM.addLayerInteraction ).toBe( existing );
	} );

	it( 'binds the flush listeners only once across repeated calls', () => {
		const spy = jest.spyOn( window, 'addEventListener' );
		const count = () =>
			spy.mock.calls.filter( ( [ e ] ) => e === 'pagehide' || e === 'beforeunload' ).length;
		initLayerAnalytics();
		expect( count() ).toBe( 2 ); // beforeunload + pagehide
		initLayerAnalytics(); // godamLayerFlushBound already set -> no re-bind
		expect( count() ).toBe( 2 );
		spy.mockRestore();
	} );
} );

describe( 'visitor id (window.analytics) on pages without the video player', () => {
	const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

	// Let pending promise work finish, as a browser does between two <script>
	// tags. The library stores a new visitor id in that promise work.
	const settle = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

	// Run the real video-player analytics module (the godam-player-analytics
	// bundle) from a fresh module registry, like its own <script> on the page.
	const loadPlayerBundle = () => {
		jest.isolateModules( () => {
			require( './analytics' );
		} );
	};

	// Run this runtime (the godam-layer-analytics bundle) from a fresh module
	// registry, like its <script> on the next page load.
	const loadRuntimeBundle = () => {
		jest.isolateModules( () => {
			require( './layer-analytics-runtime' ).initLayerAnalytics();
		} );
	};

	// A new page load: the window globals are gone, browser storage survives.
	const reloadPage = () => {
		delete window.analytics;
		delete window.GoDAM;
		delete window.godamLayerFlushBound;
	};

	beforeEach( () => {
		reloadPage();
		localStorage.clear();
		sessionStorage.clear();
		document.body.innerHTML = '';
		delete window.videoAnalyticsParams;
		global.fetch = jest.fn( () => Promise.resolve( { ok: true } ) );
	} );

	it( 'gives an image-only page a non-empty anonymous id', () => {
		initLayerAnalytics();

		expect( typeof window.analytics?.user ).toBe( 'function' );
		expect( window.analytics.user().anonymousId ).toMatch( UUID );
	} );

	it( 'uses the player app name and no plugins', () => {
		initLayerAnalytics();

		expect( window.analytics.getState( 'context' ).app ).toBe( 'analytics-cdp-plugin' );
		expect( window.analytics.getState( 'plugins' ) ).toEqual( {} );
	} );

	it( '(a) sends no request and records no page or track event, even after several heartbeats', async () => {
		const sendBeacon = jest.fn();
		Object.defineProperty( window.navigator, 'sendBeacon', { value: sendBeacon, configurable: true } );
		const xhrOpen = jest.spyOn( XMLHttpRequest.prototype, 'open' );
		const nodesBefore = document.querySelectorAll( '*' ).length;

		jest.useFakeTimers();
		try {
			initLayerAnalytics();
			// The library re-checks its event queue every 3 seconds; run a few rounds.
			expect( jest.getTimerCount() ).toBeGreaterThan( 0 );
			await jest.advanceTimersByTimeAsync( 10000 );
		} finally {
			jest.useRealTimers();
		}

		expect( global.fetch ).not.toHaveBeenCalled();
		expect( sendBeacon ).not.toHaveBeenCalled();
		expect( xhrOpen ).not.toHaveBeenCalled();
		expect( document.querySelectorAll( '*' ).length ).toBe( nodesBefore );
		expect( window.analytics.getState( 'page' ).history ).toEqual( [] );
		expect( window.analytics.getState( 'track' ).history ).toEqual( [] );

		xhrOpen.mockRestore();
		delete window.navigator.sendBeacon;
	} );

	it( '(b) player bundle runs after the runtime: its instance takes over, with the same id', async () => {
		initLayerAnalytics();
		const fallback = window.analytics;
		const id = fallback.user().anonymousId;

		await settle();
		loadPlayerBundle();

		expect( window.analytics ).not.toBe( fallback );
		// Only the player module adds trackVideoEvent, so this is its instance.
		expect( typeof window.analytics.trackVideoEvent ).toBe( 'function' );
		expect( window.analytics.getState( 'context' ).app ).toBe( fallback.getState( 'context' ).app );
		expect( window.analytics.user().anonymousId ).toBe( id );
	} );

	it( '(b) both bundles in one script with no pause between them: the next page reads the id this page used', async () => {
		initLayerAnalytics();
		loadPlayerBundle();
		const player = window.analytics;
		await settle();

		expect( typeof player.trackVideoEvent ).toBe( 'function' );
		const id = player.user().anonymousId;

		reloadPage();
		loadRuntimeBundle();

		expect( window.analytics.user().anonymousId ).toBe( id );
	} );

	it( '(b) player bundle runs before the runtime: the player instance and its id stay', () => {
		loadPlayerBundle();
		const player = window.analytics;
		const id = player.user().anonymousId;

		initLayerAnalytics();

		expect( window.analytics ).toBe( player );
		expect( window.analytics.user().anonymousId ).toBe( id );
	} );

	it( '(b) never replaces an existing window.analytics', () => {
		const existing = { user: () => ( { anonymousId: 'set-by-another-script' } ) };
		window.analytics = existing;

		initLayerAnalytics();

		expect( window.analytics ).toBe( existing );
	} );

	it( '(c) the runtime flush sends the id as user_token', () => {
		window.videoAnalyticsParams = { endpoint: 'https://analytics.test', token: 'acct-token' };
		document.body.innerHTML =
			'<div class="godam-image__frame" data-id="31" data-block-source="godam-image"></div>';
		initLayerAnalytics();

		window.GoDAM.addLayerInteraction( '31', {
			layer_id: 'layer-1',
			layer_type: 'hotspot',
			action_type: 'clicked',
			layer_timestamp: 0,
		} );
		window.GoDAM.flushLayerInteractions();

		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
		const body = JSON.parse( global.fetch.mock.calls[ 0 ][ 1 ].body );
		expect( body.user_token ).toMatch( UUID );
		expect( body.user_token ).toBe( window.analytics.user().anonymousId );
		expect( body.block_source ).toBe( 'godam-image' );
	} );

	it( '(c) the add-on add-to-cart read gets the id as soon as the runtime has run', () => {
		initLayerAnalytics();

		// The exact read godam-for-woo's wooCommerceLayerManager makes for
		// extensions.godam.user_token when an in-image add-to-cart is clicked.
		const userToken = window.analytics?.user?.()?.anonymousId || '';

		expect( userToken ).toMatch( UUID );
	} );

	it( 'keeps the same id across a reload', async () => {
		initLayerAnalytics();
		const id = window.analytics.user().anonymousId;
		await settle();

		reloadPage();
		loadRuntimeBundle();

		expect( window.analytics.user().anonymousId ).toBe( id );
	} );

	it( 'image page, then a video page: the player reads the id the image page stored', async () => {
		initLayerAnalytics();
		const id = window.analytics.user().anonymousId;
		await settle();

		reloadPage();
		loadPlayerBundle();

		expect( window.analytics.user().anonymousId ).toBe( id );
	} );

	it( 'video page, then an image page: the runtime reads the id the player stored', async () => {
		loadPlayerBundle();
		const id = window.analytics.user().anonymousId;
		await settle();

		reloadPage();
		loadRuntimeBundle();

		expect( window.analytics.user().anonymousId ).toBe( id );
	} );
} );
