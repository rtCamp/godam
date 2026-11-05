/**
 * Tests for the visitor-consent gate (utils/consent.js) and how the analytics
 * bundles use it (rtCamp/godam-plugin-wp#47, Phase 1).
 *
 * The WP Consent API is simulated the way its own script behaves: a global
 * `wp_has_consent( category )`, and a `wp_listen_for_consent_change` event whose
 * detail maps the changed category to 'allow' or 'deny'.
 */

// The video player bundle needs the browser build of the analytics core.
jest.mock( '@analytics/core', () => jest.requireActual( '@analytics/core/client' ) );

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let consentState;

/**
 * Install a fake WP Consent API with the given statistics answer.
 *
 * @param {boolean} allowed Whether statistics is allowed.
 */
function installConsentApi( allowed ) {
	consentState = allowed;
	window.wp_has_consent = jest.fn( ( category ) => category === 'statistics' && consentState );
	window.videoAnalyticsParams = { consent: { trackingEnabled: true, consentApi: true } };
}

/**
 * Change statistics consent the way wp_set_consent() does.
 *
 * @param {boolean} allowed New answer.
 */
function setStatisticsConsent( allowed ) {
	consentState = allowed;
	document.cookie = `wp_consent_statistics=${ allowed ? 'allow' : 'deny' }; path=/`;
	const detail = [];
	detail.statistics = allowed ? 'allow' : 'deny';
	document.dispatchEvent( new CustomEvent( 'wp_listen_for_consent_change', { detail } ) );
}

/**
 * Load a module from a fresh registry, like a new page load.
 *
 * @param {string} path Module path.
 * @return {Object} The module.
 */
function loadFresh( path ) {
	let mod;
	jest.isolateModules( () => {
		mod = require( path );
	} );
	return mod;
}

// Each test loads fresh module copies, and each copy adds document listeners.
// Remove them after every test so an earlier test's copy cannot react to a later
// test's consent events.
const addedListeners = [];
const realAddEventListener = document.addEventListener.bind( document );
document.addEventListener = ( type, listener, options ) => {
	addedListeners.push( [ type, listener, options ] );
	realAddEventListener( type, listener, options );
};

afterEach( () => {
	addedListeners.splice( 0 ).forEach( ( [ type, listener, options ] ) => {
		document.removeEventListener( type, listener, options );
	} );
} );

beforeEach( () => {
	delete window.godamAnalyticsConsent;
	document.cookie = 'wp_consent_statistics=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
	localStorage.clear();
	sessionStorage.clear();
	delete window.wp_has_consent;
	delete window.videoAnalyticsParams;
	delete window.analytics;
	delete window.GoDAM;
	delete window.godamLayerFlushBound;
	delete window.pageLoadEventTracked;
	global.fetch = jest.fn( () => Promise.resolve( { ok: true } ) );
} );

describe( 'hasStatisticsConsent', () => {
	it( 'allows tracking when the site has no consent plugin (today\'s behaviour)', () => {
		const { hasStatisticsConsent } = loadFresh( './consent' );
		expect( hasStatisticsConsent() ).toBe( true );
	} );

	it( 'blocks tracking when the site turned it off with the PHP filter', () => {
		window.videoAnalyticsParams = { consent: { trackingEnabled: false, consentApi: false } };
		const { hasStatisticsConsent } = loadFresh( './consent' );
		expect( hasStatisticsConsent() ).toBe( false );
	} );

	it( 'blocks tracking when the filter is off even if the visitor allowed statistics', () => {
		installConsentApi( true );
		window.videoAnalyticsParams.consent.trackingEnabled = false;
		const { hasStatisticsConsent } = loadFresh( './consent' );
		expect( hasStatisticsConsent() ).toBe( false );
	} );

	it( 'waits while the WP Consent API is active but its script has not run yet', () => {
		window.videoAnalyticsParams = { consent: { trackingEnabled: true, consentApi: true } };
		const { hasStatisticsConsent } = loadFresh( './consent' );
		expect( hasStatisticsConsent() ).toBe( false );
	} );

	it( 'follows wp_has_consent( "statistics" )', () => {
		installConsentApi( false );
		const { hasStatisticsConsent } = loadFresh( './consent' );
		expect( hasStatisticsConsent() ).toBe( false );

		consentState = true;
		expect( hasStatisticsConsent() ).toBe( true );
		expect( window.wp_has_consent ).toHaveBeenCalledWith( 'statistics' );
	} );

	it( 'honours a recorded refusal when the banner has not set a consent type on this page', () => {
		// The real wp_has_consent() returns true when no consent type is set.
		window.wp_has_consent = jest.fn( () => true );
		window.videoAnalyticsParams = { consent: { trackingEnabled: true, consentApi: true } };
		document.cookie = 'wp_consent_statistics=deny; path=/';
		const { hasStatisticsConsent } = loadFresh( './consent' );

		expect( hasStatisticsConsent() ).toBe( false );

		document.cookie = 'wp_consent_statistics=allow; path=/';
		expect( hasStatisticsConsent() ).toBe( true );
		document.cookie = 'wp_consent_statistics=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
	} );

	it( 'uses the WP Consent API when its script is loaded even without the PHP flag', () => {
		window.wp_has_consent = jest.fn( () => false );
		const { hasStatisticsConsent } = loadFresh( './consent' );
		expect( hasStatisticsConsent() ).toBe( false );
	} );
} );

describe( 'consentAwareStorage', () => {
	it( 'keeps values in memory before consent and writes nothing to the device', () => {
		installConsentApi( false );
		const { consentAwareStorage } = loadFresh( './consent' );

		consentAwareStorage.setItem( '__anon_id', 'abc' );

		expect( consentAwareStorage.getItem( '__anon_id' ) ).toBe( 'abc' );
		expect( localStorage.getItem( '__anon_id' ) ).toBeNull();
	} );

	it( 'does not read an id already on the device before consent', () => {
		localStorage.setItem( '__anon_id', JSON.stringify( 'old-id' ) );
		installConsentApi( false );
		const { consentAwareStorage } = loadFresh( './consent' );

		expect( consentAwareStorage.getItem( '__anon_id' ) ).toBeUndefined();
	} );

	it( 'reads ids stored in the library\'s own format once consent is given', () => {
		localStorage.setItem( '__anon_id', JSON.stringify( 'old-id' ) );
		const { consentAwareStorage } = loadFresh( './consent' );

		expect( consentAwareStorage.getItem( '__anon_id' ) ).toBe( 'old-id' );
	} );

	it( 'writes the in-memory id to the device when the visitor allows statistics', () => {
		installConsentApi( false );
		const { consentAwareStorage, onStatisticsConsent } = loadFresh( './consent' );
		onStatisticsConsent( () => {} );

		consentAwareStorage.setItem( '__anon_id', 'abc' );
		setStatisticsConsent( true );

		expect( JSON.parse( localStorage.getItem( '__anon_id' ) ) ).toBe( 'abc' );
	} );
} );

describe( 'consent changes while the page is open', () => {
	it( 'runs the grant callback once, when the visitor allows statistics', () => {
		installConsentApi( false );
		const { onStatisticsConsent } = loadFresh( './consent' );
		const callback = jest.fn();

		onStatisticsConsent( callback );
		expect( callback ).not.toHaveBeenCalled();

		setStatisticsConsent( true );
		expect( callback ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'runs the callback at once when consent is already given', () => {
		installConsentApi( true );
		const { onStatisticsConsent } = loadFresh( './consent' );
		const callback = jest.fn();

		onStatisticsConsent( callback );
		expect( callback ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'ignores changes to other categories', () => {
		installConsentApi( false );
		const { onStatisticsConsent } = loadFresh( './consent' );
		const callback = jest.fn();
		onStatisticsConsent( callback );

		consentState = true; // Would be read if the event were not filtered.
		const detail = [];
		detail.marketing = 'allow';
		document.dispatchEvent( new CustomEvent( 'wp_listen_for_consent_change', { detail } ) );

		expect( callback ).not.toHaveBeenCalled();
	} );

	it( 'picks up consent when the WP Consent API script runs after GoDAM\'s', () => {
		window.videoAnalyticsParams = { consent: { trackingEnabled: true, consentApi: true } };
		const { onStatisticsConsent, syncConsent } = loadFresh( './consent' );
		const callback = jest.fn();
		onStatisticsConsent( callback );
		expect( callback ).not.toHaveBeenCalled();

		// The API's script loads (opt-out region, no choice yet: allowed).
		window.wp_has_consent = () => true;
		syncConsent(); // What the DOMContentLoaded listener runs.

		expect( callback ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'deletes GoDAM\'s items when the visitor withdraws statistics', () => {
		installConsentApi( true );
		const { onStatisticsConsent } = loadFresh( './consent' );
		onStatisticsConsent( () => {} );

		localStorage.setItem( '__anon_id', JSON.stringify( 'abc' ) );
		localStorage.setItem( '__user_traits', JSON.stringify( {} ) );
		localStorage.setItem( 'godamVideoSeen:42', '1' );
		localStorage.setItem( 'unrelated', 'keep' );
		sessionStorage.setItem( 'godamLayerInteractions', '{}' );

		setStatisticsConsent( false );

		expect( localStorage.getItem( '__anon_id' ) ).toBeNull();
		expect( localStorage.getItem( '__user_traits' ) ).toBeNull();
		expect( localStorage.getItem( 'godamVideoSeen:42' ) ).toBeNull();
		expect( localStorage.getItem( 'unrelated' ) ).toBe( 'keep' );
		expect( sessionStorage.getItem( 'godamLayerInteractions' ) ).toBeNull();
	} );

	it( 'does not delete anything when the first check finds no consent', () => {
		installConsentApi( false );
		localStorage.setItem( 'unrelated', 'keep' );
		const { onStatisticsConsent } = loadFresh( './consent' );
		onStatisticsConsent( () => {} );

		expect( localStorage.getItem( 'unrelated' ) ).toBe( 'keep' );
	} );
} );

describe( 'analytics bundles with the WP Consent API and no consent', () => {
	it( 'the video player bundle stores no visitor id and sends nothing until consent', async () => {
		installConsentApi( false );
		loadFresh( '../analytics' );

		// The instance exists (add-ons attach to it) but holds its id in memory.
		expect( typeof window.analytics.user ).toBe( 'function' );
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
		expect( localStorage.getItem( '__anon_id' ) ).toBeNull();

		window.analytics.track( 'video_heatmap', { type: 2, videoId: 1, ranges: [ [ 0, 1 ] ] } );
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
		expect( global.fetch ).not.toHaveBeenCalled();

		// The visitor allows statistics: the id they will be counted under is stored.
		setStatisticsConsent( true );
		const id = window.analytics.user().anonymousId;
		expect( id ).toMatch( UUID );
		expect( JSON.parse( localStorage.getItem( '__anon_id' ) ) ).toBe( id );
	} );

	it( 'a returning visitor keeps their stored id when the consent script loads after GoDAM', async () => {
		// The visitor consented on an earlier page.
		localStorage.setItem( '__anon_id', JSON.stringify( 'returning-visitor-id' ) );
		// This page: the API is active but its script has not run when GoDAM's does.
		window.videoAnalyticsParams = { consent: { trackingEnabled: true, consentApi: true } };
		loadFresh( '../analytics' );
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) ); // the library's start-up work, done before DOMContentLoaded on a page
		expect( window.analytics.user().anonymousId ).not.toBe( 'returning-visitor-id' );

		// The API's script runs and reports the earlier consent; GoDAM re-checks
		// (its DOMContentLoaded listener).
		window.wp_has_consent = () => true;
		document.dispatchEvent( new Event( 'wp_consent_type_defined' ) );
		await new Promise( ( resolve ) => setTimeout( resolve, 100 ) );

		expect( window.analytics.user().anonymousId ).toBe( 'returning-visitor-id' );
		expect( JSON.parse( localStorage.getItem( '__anon_id' ) ) ).toBe( 'returning-visitor-id' );
	} );

	it( 'does not buffer layer clicks or set the first-view flag before consent', () => {
		installConsentApi( false );
		const helpers = loadFresh( '../analytics-helpers' );
		const storage = loadFresh( './storage' );

		expect( helpers.shouldSkipAnalytics() ).toBe( true );
		expect( helpers.wasFirstViewForVideo( '42' ) ).toBe( false );
		expect( localStorage.getItem( 'godamVideoSeen:42' ) ).toBeNull();

		storage.addLayerInteraction( '42', {
			layer_id: 'l1',
			layer_type: 'hotspot',
			action_type: 'clicked',
			layer_timestamp: 0,
		} );
		expect( sessionStorage.getItem( 'godamLayerInteractions' ) ).toBeNull();
	} );

	it( 'counts a first view normally once consent is given on the same page', () => {
		installConsentApi( false );
		const helpers = loadFresh( '../analytics-helpers' );

		expect( helpers.wasFirstViewForVideo( '42' ) ).toBe( false );

		consentState = true;
		expect( helpers.wasFirstViewForVideo( '42' ) ).toBe( true );
		expect( localStorage.getItem( 'godamVideoSeen:42' ) ).toBe( '1' );
	} );

	it( 'the image-page runtime creates no visitor id until consent', () => {
		installConsentApi( false );
		const runtime = loadFresh( '../layer-analytics-runtime' );

		runtime.initLayerAnalytics();
		expect( window.analytics ).toBeUndefined();

		setStatisticsConsent( true );
		expect( window.analytics.user().anonymousId ).toMatch( UUID );
	} );
} );

describe( 'events before the visitor chooses wait in memory', () => {
	const settle = ( ms = 0 ) => new Promise( ( resolve ) => setTimeout( resolve, ms ) );
	const analyticsParams = ( consent ) => ( {
		endpoint: 'https://analytics.example',
		token: 'verified-token',
		consent: { trackingEnabled: true, ...consent },
	} );
	const trackPlay = () => window.analytics.track( 'video_heatmap', { type: 2, videoId: 7, ranges: [ [ 0, 3 ] ], videoLength: 10 } );
	const sentBodies = () => global.fetch.mock.calls.map( ( call ) => JSON.parse( call[ 1 ].body ) );

	it( 'a play tracked before consent is sent once the visitor accepts, with the stored id', async () => {
		installConsentApi( false );
		window.videoAnalyticsParams = analyticsParams( { consentApi: true } );
		loadFresh( '../analytics' );
		await settle();

		trackPlay();
		await settle( 20 );
		expect( global.fetch ).not.toHaveBeenCalled();

		setStatisticsConsent( true );
		await settle( 50 );

		const bodies = sentBodies();
		expect( bodies ).toHaveLength( 1 );
		expect( bodies[ 0 ].type ).toBe( 2 );
		expect( bodies[ 0 ].user_token ).toBe( JSON.parse( localStorage.getItem( '__anon_id' ) ) );
	} );

	it( 'a play tracked before consent is discarded when the visitor refuses', async () => {
		installConsentApi( false );
		window.videoAnalyticsParams = analyticsParams( { consentApi: true } );
		loadFresh( '../analytics' );
		await settle();

		trackPlay();
		await settle( 20 ); // the library hands the event to GoDAM's sender asynchronously
		setStatisticsConsent( false );
		// Accepting later on the same page does not bring the refused events back.
		setStatisticsConsent( true );
		await settle( 50 );

		expect( global.fetch ).not.toHaveBeenCalled();
	} );

	it( 'a layer click before consent reaches the buffer only after the visitor accepts', () => {
		installConsentApi( false );
		const storage = loadFresh( './storage' );
		const click = { layer_id: 'l1', layer_type: 'hotspot', action_type: 'clicked', layer_timestamp: 0 };

		storage.addLayerInteraction( '42', click );
		expect( sessionStorage.getItem( 'godamLayerInteractions' ) ).toBeNull();

		setStatisticsConsent( true );
		expect( storage.getLayerInteractions() ).toEqual( { 42: [ click ] } );
	} );
} );

describe( 'window.GoDAM.setAnalyticsConsent for a custom banner', () => {
	const settle = ( ms = 0 ) => new Promise( ( resolve ) => setTimeout( resolve, ms ) );

	beforeEach( () => {
		delete window.godamAnalyticsConsent;
	} );

	it( 'waits when the site asked GoDAM to, until the banner calls it', () => {
		window.videoAnalyticsParams = { consent: { trackingEnabled: true, consentApi: false, requireConsent: true } };
		const consent = loadFresh( './consent' );
		const callback = jest.fn();
		consent.onStatisticsConsent( callback );

		expect( consent.hasStatisticsConsent() ).toBe( false );
		expect( callback ).not.toHaveBeenCalled();

		window.GoDAM.setAnalyticsConsent( true );
		expect( consent.hasStatisticsConsent() ).toBe( true );
		expect( callback ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'reaches both bundles: one call starts the image runtime and the player', async () => {
		window.videoAnalyticsParams = { endpoint: 'https://analytics.example', token: 't', consent: { trackingEnabled: true, consentApi: false, requireConsent: true } };
		const runtime = loadFresh( '../layer-analytics-runtime' );
		const playerConsent = loadFresh( './consent' );
		runtime.initLayerAnalytics();
		expect( window.analytics ).toBeUndefined();

		// The banner calls the copy that loaded last.
		window.GoDAM.setAnalyticsConsent( true );
		await settle();

		expect( playerConsent.hasStatisticsConsent() ).toBe( true );
		expect( window.analytics.user().anonymousId ).toMatch( UUID );
	} );

	it( 'a value set before GoDAM loads is honoured', () => {
		window.godamAnalyticsConsent = false;
		const { hasStatisticsConsent } = loadFresh( './consent' );
		expect( hasStatisticsConsent() ).toBe( false );
	} );

	it( 'false withdraws: GoDAM deletes its items', () => {
		window.videoAnalyticsParams = { consent: { trackingEnabled: true, consentApi: false, requireConsent: true } };
		window.godamAnalyticsConsent = true;
		const consent = loadFresh( './consent' );
		consent.onStatisticsConsent( () => {} );
		localStorage.setItem( '__anon_id', JSON.stringify( 'abc' ) );

		window.GoDAM.setAnalyticsConsent( false );

		expect( localStorage.getItem( '__anon_id' ) ).toBeNull();
	} );

	it( 'still blocked when the site turned tracking off', () => {
		window.videoAnalyticsParams = { consent: { trackingEnabled: false } };
		window.godamAnalyticsConsent = true;
		const { hasStatisticsConsent } = loadFresh( './consent' );
		expect( hasStatisticsConsent() ).toBe( false );
	} );
} );
