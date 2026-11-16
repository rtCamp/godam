/**
 * Tests for the LearnDash Video Progression connector.
 */

/**
 * Internal dependencies
 */
import { connectPlayer, createBlockAdapter, createEmbedAdapter, getPlayerSettings, init, isOn } from './frontend';

/**
 * A player adapter the tests drive by hand.
 *
 * @param {Object} [state] Initial time, duration and paused state.
 * @return {Object} Adapter with `emit()` and `ready()` for the test.
 */
function fakeAdapter( state = {} ) {
	const listeners = {};
	let readyCallback = null;
	const adapter = {
		time: state.time ?? 0,
		duration: state.duration ?? 100,
		paused: state.paused ?? true,
		on: ( event, callback ) => {
			( listeners[ event ] = listeners[ event ] || [] ).push( callback );
		},
		whenReady: ( callback ) => {
			readyCallback = callback;
		},
		getCurrentTime: () => adapter.time,
		getDuration: () => adapter.duration,
		isPaused: () => adapter.paused,
		seek: jest.fn( ( time ) => {
			adapter.time = time;
		} ),
		play: jest.fn( () => {
			adapter.paused = false;
		} ),
		pause: jest.fn( () => {
			adapter.paused = true;
		} ),
		mute: jest.fn(),
		emit: ( event ) => ( listeners[ event ] || [] ).forEach( ( callback ) => callback() ),
		ready: () => readyCallback && readyCallback(),
	};
	return adapter;
}

/**
 * LearnDash's cookie helpers, backed by a plain object.
 *
 * @param {Object} [saved] Saved settings.
 * @return {Object} `setSetting`, `getSetting`, `complete` and the saved values.
 */
function fakeLearnDash( saved = {} ) {
	const values = { ...saved };
	return {
		values,
		// Like LearnDash_Video_Progress_setSetting(), which replaces a `complete` state too.
		setSetting: jest.fn( ( player, key, value ) => {
			values[ key ] = value;
		} ),
		getSetting: jest.fn( ( player, key ) => values[ key ] ),
		complete: jest.fn(),
	};
}

const connect = ( { adapter, ld, data = {}, now } ) =>
	connectPlayer( { adapter, ld, data, win: window, ldPlayer: { player_cookie_key: 'key' }, now } );

describe( 'getPlayerSettings', () => {
	it( 'prefers the settings GoDAM passes for the step', () => {
		expect(
			getPlayerSettings( {
				videos_auto_start: '',
				videos_show_controls: '',
				rtgodam_player: { auto_start: true, show_controls: false, focus_pause: true, track_time: true },
			} ),
		).toEqual( { autoStart: true, showControls: false, focusPause: true, trackTime: true } );
	} );

	it( 'falls back to LearnDash\'s values', () => {
		expect(
			getPlayerSettings( { videos_auto_start: '1', videos_show_controls: '0', video_focus_pause: '', video_track_time: '1' } ),
		).toEqual( { autoStart: true, showControls: false, focusPause: false, trackTime: true } );
	} );
} );

describe( 'isOn', () => {
	it( 'reads the flag values wp_localize_script() produces', () => {
		expect( isOn( '1' ) ).toBe( true );
		expect( isOn( 1 ) ).toBe( true );
		expect( isOn( true ) ).toBe( true );
		expect( isOn( '' ) ).toBe( false );
		expect( isOn( '0' ) ).toBe( false );
		expect( isOn( undefined ) ).toBe( false );
	} );
} );

describe( 'connectPlayer', () => {
	it( 'marks the video complete and unlocks the lesson once when it ends', () => {
		const adapter = fakeAdapter( { time: 100 } );
		const ld = fakeLearnDash();

		connect( { adapter, ld } );
		adapter.emit( 'ended' );
		adapter.emit( 'ended' );

		expect( ld.values.video_state ).toBe( 'complete' );
		expect( ld.complete ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'counts reaching the last moment as the end, for looping videos', () => {
		const adapter = fakeAdapter( { duration: 60 } );
		const ld = fakeLearnDash();

		connect( { adapter, ld } );
		adapter.time = 30;
		adapter.emit( 'timeupdate' );
		expect( ld.complete ).not.toHaveBeenCalled();

		adapter.time = 59.9;
		adapter.emit( 'timeupdate' );
		expect( ld.complete ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'keeps the state complete when the learner watches the video again', () => {
		const adapter = fakeAdapter( { duration: 10, time: 10 } );
		const ld = fakeLearnDash();

		connect( { adapter, ld, now: () => 999999 } );
		adapter.emit( 'ended' );

		adapter.time = 2;
		adapter.emit( 'play' );
		adapter.emit( 'timeupdate' );
		adapter.emit( 'pause' );

		expect( ld.values.video_state ).toBe( 'complete' );
		expect( ld.values.video_time ).toBe( 10 );
	} );

	it( 'keeps the state complete when the player pauses at the end', () => {
		const adapter = fakeAdapter();
		const ld = fakeLearnDash();

		connect( { adapter, ld } );
		adapter.emit( 'ended' );
		adapter.emit( 'pause' );

		expect( ld.values.video_state ).toBe( 'complete' );
	} );

	it( 'saves the time and duration at most once a second', () => {
		let clock = 10000;
		const adapter = fakeAdapter( { duration: 120 } );
		const ld = fakeLearnDash();

		connect( { adapter, ld, now: () => clock } );

		adapter.time = 5;
		adapter.emit( 'timeupdate' );
		adapter.time = 5.4;
		clock += 400;
		adapter.emit( 'timeupdate' );
		expect( ld.values.video_time ).toBe( 5 );

		adapter.time = 6.2;
		clock += 700;
		adapter.emit( 'timeupdate' );
		expect( ld.values.video_time ).toBe( 6.2 );
		expect( ld.values.video_duration ).toBe( 120 );
	} );

	it( 'resumes from the saved time when tracking is on', () => {
		const adapter = fakeAdapter( { duration: 100 } );
		const ld = fakeLearnDash( { video_time: 42 } );

		connect( { adapter, ld, data: { video_track_time: '1' } } );
		adapter.ready();

		expect( adapter.seek ).toHaveBeenCalledWith( 42 );
	} );

	it( 'does not resume when tracking is off or the saved time is at the end', () => {
		const untracked = fakeAdapter();
		connect( { adapter: untracked, ld: fakeLearnDash( { video_time: 42 } ), data: { video_track_time: '' } } );
		untracked.ready();

		const atEnd = fakeAdapter( { duration: 100 } );
		connect( { adapter: atEnd, ld: fakeLearnDash( { video_time: 100 } ), data: { video_track_time: '1' } } );
		atEnd.ready();

		expect( untracked.seek ).not.toHaveBeenCalled();
		expect( atEnd.seek ).not.toHaveBeenCalled();
	} );

	it( 'starts the video muted when auto start is on', () => {
		const adapter = fakeAdapter();
		const ld = fakeLearnDash();

		connect( { adapter, ld, data: { videos_auto_start: '1' } } );

		expect( adapter.mute ).toHaveBeenCalled();
		expect( adapter.play ).toHaveBeenCalled();
		expect( ld.values.video_state ).toBe( 'play' );
	} );

	it( 'does not start the video when auto start is off', () => {
		const adapter = fakeAdapter();

		connect( { adapter, ld: fakeLearnDash(), data: { videos_auto_start: '0' } } );

		expect( adapter.play ).not.toHaveBeenCalled();
	} );

	describe( 'pause when the window loses focus', () => {
		let hasFocus;

		beforeEach( () => {
			jest.useFakeTimers();
			hasFocus = jest.spyOn( document, 'hasFocus' );
		} );

		afterEach( () => {
			hasFocus.mockRestore();
			jest.useRealTimers();
		} );

		it( 'pauses on blur and resumes on focus when the controls are hidden', () => {
			const adapter = fakeAdapter( { paused: false } );
			connect( { adapter, ld: fakeLearnDash(), data: { video_focus_pause: '1', videos_show_controls: '0' } } );

			hasFocus.mockReturnValue( false );
			window.dispatchEvent( new Event( 'blur' ) );
			jest.runAllTimers();
			expect( adapter.pause ).toHaveBeenCalledTimes( 1 );

			hasFocus.mockReturnValue( true );
			window.dispatchEvent( new Event( 'focus' ) );
			expect( adapter.play ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'leaves resuming to the learner when the controls are shown', () => {
			const adapter = fakeAdapter( { paused: false } );
			connect( { adapter, ld: fakeLearnDash(), data: { video_focus_pause: '1', videos_show_controls: '1' } } );

			hasFocus.mockReturnValue( false );
			window.dispatchEvent( new Event( 'blur' ) );
			jest.runAllTimers();
			hasFocus.mockReturnValue( true );
			window.dispatchEvent( new Event( 'focus' ) );

			expect( adapter.pause ).toHaveBeenCalledTimes( 1 );
			expect( adapter.play ).not.toHaveBeenCalled();
		} );

		it( 'keeps playing when focus moved into an iframe on the page', () => {
			const adapter = fakeAdapter( { paused: false } );
			connect( { adapter, ld: fakeLearnDash(), data: { video_focus_pause: '1' } } );

			hasFocus.mockReturnValue( true );
			window.dispatchEvent( new Event( 'blur' ) );
			jest.runAllTimers();

			expect( adapter.pause ).not.toHaveBeenCalled();
		} );

		it( 'does not resume a video the learner paused', () => {
			const adapter = fakeAdapter( { paused: true } );
			connect( { adapter, ld: fakeLearnDash(), data: { video_focus_pause: '1', videos_show_controls: '0' } } );

			hasFocus.mockReturnValue( false );
			window.dispatchEvent( new Event( 'blur' ) );
			jest.runAllTimers();
			hasFocus.mockReturnValue( true );
			window.dispatchEvent( new Event( 'focus' ) );

			expect( adapter.pause ).not.toHaveBeenCalled();
			expect( adapter.play ).not.toHaveBeenCalled();
		} );
	} );
} );

describe( 'createBlockAdapter', () => {
	it( 'seeks through the video.js player when there is one', () => {
		const video = document.createElement( 'video' );
		const player = { currentTime: jest.fn(), play: jest.fn(), pause: jest.fn(), muted: jest.fn() };
		const adapter = createBlockAdapter( video, { videojs: { getPlayer: () => player } } );

		adapter.seek( 12 );
		adapter.mute();

		expect( player.currentTime ).toHaveBeenCalledWith( 12 );
		expect( player.muted ).toHaveBeenCalledWith( true );
		expect( video.muted ).toBe( true );
	} );

	it( 'waits for the metadata before it reports ready', () => {
		const video = document.createElement( 'video' );
		const callback = jest.fn();

		createBlockAdapter( video, {} ).whenReady( callback );
		expect( callback ).not.toHaveBeenCalled();

		video.dispatchEvent( new Event( 'loadedmetadata' ) );
		expect( callback ).toHaveBeenCalledTimes( 1 );
	} );
} );

describe( 'createEmbedAdapter', () => {
	it( 'is null without the GoDAM Player SDK', () => {
		expect( createEmbedAdapter( document.createElement( 'iframe' ), {}, 'https://app.godam.io' ) ).toBeNull();
	} );

	/**
	 * A GoDAM Player SDK double whose ready() the test resolves.
	 *
	 * @return {Object} `GoDAMPlayer`, the commands it received and `resolveReady()`.
	 */
	const sdkDouble = () => {
		const calls = [];
		let resolveReady;
		const ready = new Promise( ( resolve ) => {
			resolveReady = resolve;
		} );
		const GoDAMPlayer = jest.fn( function() {
			this.on = () => {};
			this.ready = () => ready;
			this.setMuted = () => calls.push( 'mute' ) && Promise.resolve();
			this.play = () => calls.push( 'play' ) && Promise.resolve();
			this.seek = ( time ) => calls.push( `seek ${ time }` ) && Promise.resolve();
			this.getDuration = () => Promise.resolve( 8 );
		} );
		return { GoDAMPlayer, calls, resolveReady: () => resolveReady() };
	};

	const flush = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

	it( 'holds autostart until the embed says it is ready', async () => {
		const sdk = sdkDouble();
		const adapter = createEmbedAdapter( document.createElement( 'iframe' ), { GoDAMPlayer: sdk.GoDAMPlayer, setTimeout: ( ...a ) => setTimeout( ...a ) }, 'https://app.godam.io', 60000 );

		adapter.mute();
		adapter.play();
		await flush();
		expect( sdk.calls ).toEqual( [] );

		sdk.resolveReady();
		await flush();
		expect( sdk.calls ).toEqual( [ 'mute', 'play' ] );
	} );

	it( 'sends commands after the timeout when it missed the ready message', async () => {
		const sdk = sdkDouble();
		const adapter = createEmbedAdapter( document.createElement( 'iframe' ), { GoDAMPlayer: sdk.GoDAMPlayer, setTimeout: ( ...a ) => setTimeout( ...a ) }, 'https://app.godam.io', 10 );

		adapter.seek( 3 );
		await new Promise( ( resolve ) => setTimeout( resolve, 30 ) );

		expect( sdk.calls ).toEqual( [ 'seek 3' ] );
	} );

	it( 'only accepts messages from the GoDAM origin and tracks the time from events', () => {
		const listeners = {};
		const GoDAMPlayer = jest.fn( function() {
			this.on = ( event, callback ) => {
				( listeners[ event ] = listeners[ event ] || [] ).push( callback );
			};
			this.seek = jest.fn();
		} );

		const adapter = createEmbedAdapter( document.createElement( 'iframe' ), { GoDAMPlayer }, 'https://app.godam.io' );
		listeners.timeupdate.forEach( ( callback ) => callback( { currentTime: 7, duration: 30 } ) );

		expect( GoDAMPlayer ).toHaveBeenCalledWith( expect.anything(), { allowedOrigins: [ 'https://app.godam.io' ] } );
		expect( adapter.getCurrentTime() ).toBe( 7 );
		expect( adapter.getDuration() ).toBe( 30 );
		expect( adapter.isPaused() ).toBe( false );
	} );
} );

describe( 'init', () => {
	const setUpPage = ( html, data = {} ) => {
		document.body.innerHTML = html;
		window.learndash_video_data = { videos_found_provider: 'godam', ...data };
		window.rtgodamLearnDash = { provider: 'godam', apiOrigin: 'https://app.godam.io' };
		window.ld_video_players = {};
		window.LearnDash_disable_assets = jest.fn();
		window.LearnDash_Video_Progress_initSettings = jest.fn( () => ( { video_time: 0 } ) );
		window.LearnDash_Video_Progress_setSetting = jest.fn();
		window.LearnDash_Video_Progress_getSetting = jest.fn();
	};

	afterEach( () => {
		document.body.innerHTML = '';
		[
			'learndash_video_data',
			'rtgodamLearnDash',
			'ld_video_players',
			'LearnDash_disable_assets',
			'LearnDash_Video_Progress_initSettings',
			'LearnDash_Video_Progress_setSetting',
			'LearnDash_Video_Progress_getSetting',
			'GoDAMPlayer',
		].forEach( ( name ) => delete window[ name ] );
	} );

	const blockWrapper = ( progression = 'true' ) =>
		`<div class="ld-video" data-video-progression="${ progression }" data-video-cookie-key="learndash-video-progress-abc" data-video-provider="godam"><figure><video id="v1"></video></figure></div>`;

	it( 'locks the lesson and registers the GoDAM player with LearnDash', () => {
		setUpPage( blockWrapper(), { videos_show_controls: '0' } );

		const players = init( window );

		expect( window.LearnDash_disable_assets ).toHaveBeenCalledWith( true );
		expect( players ).toHaveLength( 1 );
		expect( players[ 0 ].player_cookie_key ).toBe( 'learndash-video-progress-abc' );
		expect( players[ 0 ].player_type ).toBe( 'godam' );
		expect( window.ld_video_players[ 'rtgodam-ld-video-0' ] ).toBe( players[ 0 ] );
		expect( document.querySelector( '.ld-video' ).classList.contains( 'rtgodam-ld-no-controls' ) ).toBe( true );
	} );

	it( 'keeps the controls when LearnDash shows them', () => {
		setUpPage( blockWrapper(), { videos_show_controls: '1' } );

		init( window );

		expect( document.querySelector( '.ld-video' ).classList.contains( 'rtgodam-ld-no-controls' ) ).toBe( false );
	} );

	it( 'applies the player settings without locking the step when progression is off', () => {
		setUpPage( blockWrapper( 'false' ), {
			videos_show_controls: '',
			videos_auto_complete: '1',
			rtgodam_player: { auto_start: false, show_controls: false, focus_pause: false, track_time: true },
		} );

		const players = init( window );
		document.querySelector( '.ld-video video' ).dispatchEvent( new Event( 'ended' ) );

		expect( players ).toHaveLength( 1 );
		expect( document.querySelector( '.ld-video' ).classList.contains( 'rtgodam-ld-no-controls' ) ).toBe( true );
		expect( window.LearnDash_disable_assets ).not.toHaveBeenCalled();
	} );

	it( 'locks only for the videos LearnDash applies progression to', () => {
		setUpPage( blockWrapper( 'false' ) + blockWrapper( 'true' ), { rtgodam_player: { show_controls: true } } );

		init( window );
		document.querySelectorAll( '.ld-video video' )[ 0 ].dispatchEvent( new Event( 'ended' ) );
		expect( window.LearnDash_disable_assets ).toHaveBeenCalledTimes( 1 );
		expect( window.LearnDash_disable_assets ).toHaveBeenCalledWith( true );

		document.querySelectorAll( '.ld-video video' )[ 1 ].dispatchEvent( new Event( 'ended' ) );
		expect( window.LearnDash_disable_assets ).toHaveBeenLastCalledWith( false );
	} );

	it( 'leaves other providers to LearnDash', () => {
		setUpPage( blockWrapper(), { videos_found_provider: 'youtube' } );

		expect( init( window ) ).toEqual( [] );
		expect( window.LearnDash_disable_assets ).not.toHaveBeenCalled();
	} );

	it( 'does not lock the lesson for an embed it cannot control', () => {
		setUpPage(
			'<div class="ld-video" data-video-progression="true" data-video-cookie-key="k" data-video-provider="godam"><iframe src="https://app.godam.io/web/embed/abc"></iframe></div>',
		);

		expect( init( window ) ).toEqual( [] );
		expect( window.LearnDash_disable_assets ).not.toHaveBeenCalled();
	} );

	it( 'does nothing without LearnDash\'s video helpers', () => {
		setUpPage( blockWrapper() );
		delete window.LearnDash_Video_Progress_setSetting;

		expect( init( window ) ).toEqual( [] );
	} );
} );
