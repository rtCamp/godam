/**
 * Regression tests for the public player API that customer sites build on:
 * the `godamPlayerReady` event and `window.GoDAMAPI.getPlayer()`.
 *
 * In GoDAM 1.4.8 a performance change left every player marked as
 * "initializing", so getPlayer() threw "Player for attachment ID … is
 * currently initializing" even for a video that was already playing
 * (rtCamp/godam-core#605). Nothing caught it before customers did.
 *
 * These tests run the real player start-up (GodamVideoPlayer + Video.js) on
 * markup shaped like the one `inc/templates/godam-player.php` prints. They
 * fail if `godamPlayerReady` stops firing or stops passing attachmentId,
 * videoElement and player, or if getPlayer() stops returning that same
 * player, whether called inside the event listener (the pattern in
 * assets/src/js/godam-player/api/README.md) or after `godamAllPlayersReady`.
 */

// The settings menu button loads its quality plugin with a top-level await,
// which Jest can't parse. It is a control-bar extra, not part of the API
// contract under test, so it is the only part of start-up that is stubbed.
jest.mock( '../masterSettings.js', () => {
	const Button = jest.requireActual( 'video.js' ).getComponent( 'Button' );
	return { __esModule: true, default: class extends Button {} };
} );

/**
 * Internal dependencies
 */
import GodamVideoPlayer from '../videoPlayer.js';
import PlayerManager from '../managers/playerManager.js';
import Player from './player.js';
import './godam-api.js';

const ATTACHMENT_ID = '1641';

/**
 * Print one player the way the PHP template does: a container holding a
 * `<video class="easydam-player video-js">` that carries the data attributes.
 *
 * @param {string} id - Attachment ID for data-id.
 * @return {HTMLVideoElement} The video element the player starts from.
 */
function renderPlayerMarkup( id = ATTACHMENT_ID ) {
	const wrapper = document.createElement( 'div' );
	wrapper.className = 'godam-video-wrapper';
	wrapper.innerHTML = `
		<div class="easydam-video-container loading">
			<video
				class="easydam-player video-js vjs-big-play-centered vjs-hidden"
				playsinline
				data-id="${ id }"
				data-instance-id="godam-test-${ id }"
				data-job_id="job-${ id }"
				data-controls="${ JSON.stringify( {
		controls: true,
		sources: [ { src: 'https://example.com/video.mp4', type: 'video/mp4' } ],
	} ).replace( /"/g, '&quot;' ) }"
				data-out-of-view="none"
				data-disable-transcript="true"
			></video>
		</div>`;
	document.body.appendChild( wrapper );
	return wrapper.querySelector( 'video' );
}

/**
 * Resolve with the detail of the next `godamPlayerReady` event, and run
 * `inside` from within the listener, as a site's own script would.
 *
 * @param {Function} inside - Called with the event detail inside the listener.
 * @return {Promise<Object>} Detail plus whatever `inside` returned or threw.
 */
function nextPlayerReady( inside ) {
	return new Promise( ( resolve ) => {
		document.addEventListener(
			'godamPlayerReady',
			( event ) => {
				let result, error;
				try {
					result = inside( event.detail );
				} catch ( e ) {
					error = e;
				}
				resolve( { detail: event.detail, result, error } );
			},
			{ once: true },
		);
	} );
}

/**
 * Fail with a clear message, before Jest's own 5 s timeout, when an event never fires.
 *
 * @param {Promise} promise - Promise to race.
 * @param {string}  what    - Name for the failure message.
 * @return {Promise} The promise, or a rejection after 3 s.
 */
function withinTimeout( promise, what ) {
	return Promise.race( [
		promise,
		new Promise( ( _, reject ) =>
			setTimeout( () => reject( new Error( `${ what } did not fire within 3 s` ) ), 3000 ),
		),
	] );
}

beforeAll( () => {
	// jsdom has no media playback or layout observers.
	window.HTMLMediaElement.prototype.load = jest.fn();
	window.HTMLMediaElement.prototype.pause = jest.fn();
	window.HTMLMediaElement.prototype.play = jest.fn( () => Promise.resolve() );
	// jsdom says it can play nothing, so Video.js would report "no compatible source".
	window.HTMLMediaElement.prototype.canPlayType = jest.fn( () => 'maybe' );
	if ( ! window.IntersectionObserver ) {
		window.IntersectionObserver = class {
			observe() {}
			unobserve() {}
			disconnect() {}
		};
	}
	if ( ! window.ResizeObserver ) {
		window.ResizeObserver = class {
			observe() {}
			unobserve() {}
			disconnect() {}
		};
	}
	if ( ! window.matchMedia ) {
		window.matchMedia = () => ( {
			matches: false,
			addListener() {},
			removeListener() {},
			addEventListener() {},
			removeEventListener() {},
		} );
	}
} );

afterEach( async () => {
	// Let the player's own deferred ready work finish before tearing it down.
	await new Promise( ( resolve ) => setTimeout( resolve, 50 ) );
	// Players are removed from the page but not disposed: a disposed player's
	// window resize handlers still run and throw (a separate start-up issue,
	// not what this file tests).
	document.body.innerHTML = '';
} );

describe( 'godamPlayerReady', () => {
	it( 'fires on document once the player is ready, with attachmentId, videoElement and player', async () => {
		const video = renderPlayerMarkup();
		const ready = nextPlayerReady( () => {} );

		await new GodamVideoPlayer( video, {} ).initialize();
		const { detail } = await withinTimeout( ready, 'godamPlayerReady' );

		expect( detail.attachmentId ).toBe( ATTACHMENT_ID );
		expect( detail.videoElement ).toBe( video );
		expect( detail.player ).toBe( window.videojs.getPlayer( video ) );
		expect( typeof detail.player.play ).toBe( 'function' );
	} );

	it( 'fires after the player has stopped being marked as initializing', async () => {
		const video = renderPlayerMarkup();
		const ready = nextPlayerReady( () => {
			const container = document.querySelector( `.easydam-player.video-js[data-id="${ ATTACHMENT_ID }"]` );
			return container.dataset.videojsInitializing;
		} );

		await new GodamVideoPlayer( video, {} ).initialize();
		const { result } = await withinTimeout( ready, 'godamPlayerReady' );

		expect( result ).toBeUndefined();
	} );
} );

describe( 'GoDAMAPI.getPlayer()', () => {
	it( 'is available on window', () => {
		expect( typeof window.GoDAMAPI?.getPlayer ).toBe( 'function' );
	} );

	it( 'returns the ready player when called inside godamPlayerReady (core#605)', async () => {
		const video = renderPlayerMarkup();
		const ready = nextPlayerReady( ( detail ) => window.GoDAMAPI.getPlayer( detail.attachmentId ) );

		await new GodamVideoPlayer( video, {} ).initialize();
		const { detail, result, error } = await withinTimeout( ready, 'godamPlayerReady' );

		expect( error ).toBeUndefined();
		expect( result ).toBeInstanceOf( Player );
		expect( result.videoJs ).toBe( detail.player );
	} );

	it( 'returns the player for the element passed in godamPlayerReady', async () => {
		const video = renderPlayerMarkup();
		const ready = nextPlayerReady( ( detail ) =>
			window.GoDAMAPI.getPlayer( detail.attachmentId, detail.videoElement ),
		);

		await new GodamVideoPlayer( video, {} ).initialize();
		const { detail, result, error } = await withinTimeout( ready, 'godamPlayerReady' );

		expect( error ).toBeUndefined();
		expect( result.videoJs ).toBe( detail.player );
	} );

	it( 'returns the right copy when the same video is on the page twice', async () => {
		renderPlayerMarkup( ATTACHMENT_ID );
		renderPlayerMarkup( ATTACHMENT_ID );
		const allReady = new Promise( ( resolve ) =>
			document.addEventListener( 'godamAllPlayersReady', resolve, { once: true } ),
		);

		new PlayerManager();
		await withinTimeout( allReady, 'godamAllPlayersReady' );

		const tags = document.querySelectorAll( `.easydam-player.video-js[data-id="${ ATTACHMENT_ID }"] video` );
		expect( tags ).toHaveLength( 2 );
		expect( window.GoDAMAPI.getPlayer( ATTACHMENT_ID, tags[ 1 ] ).videoJs ).toBe( window.videojs.getPlayer( tags[ 1 ] ) );
		expect( window.GoDAMAPI.getPlayer( ATTACHMENT_ID, tags[ 1 ] ).videoJs ).not.toBe( window.videojs.getPlayer( tags[ 0 ] ) );
	} );

	it( 'returns each player after godamAllPlayersReady, from a real page start-up', async () => {
		renderPlayerMarkup( '1641' );
		renderPlayerMarkup( '1642' );
		const allReady = new Promise( ( resolve ) =>
			document.addEventListener( 'godamAllPlayersReady', resolve, { once: true } ),
		);

		new PlayerManager();
		await withinTimeout( allReady, 'godamAllPlayersReady' );

		[ '1641', '1642' ].forEach( ( id ) => {
			const player = window.GoDAMAPI.getPlayer( id );
			expect( player ).toBeInstanceOf( Player );
			expect( player.videoJs ).toBe(
				window.videojs.getPlayer(
					document.querySelector( `.easydam-player.video-js[data-id="${ id }"] video` ),
				),
			);
		} );
	} );

	it( 'still refuses a player whose start-up has not finished', async () => {
		// The guard that went wrong in core#605: a player left marked as
		// "initializing" must be refused, and a finished one (above) must not.
		const video = renderPlayerMarkup();
		const ready = nextPlayerReady( () => {} );
		await new GodamVideoPlayer( video, {} ).initialize();
		await withinTimeout( ready, 'godamPlayerReady' );

		const container = document.querySelector( `.easydam-player.video-js[data-id="${ ATTACHMENT_ID }"]` );
		container.dataset.videojsInitializing = 'true';

		expect( () => window.GoDAMAPI.getPlayer( ATTACHMENT_ID ) ).toThrow( /currently initializing/ );
	} );

	it( 'throws a clear error for an attachment ID that is not on the page', () => {
		expect( () => window.GoDAMAPI.getPlayer( '999999' ) ).toThrow( /999999/ );
	} );
} );
