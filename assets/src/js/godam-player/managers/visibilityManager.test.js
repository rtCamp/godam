/**
 * Internal dependencies
 */
import {
	VisibilityManager,
	OUT_OF_VIEW_MODE,
	isAutoPause,
	isRecordVisible,
	resolveOutOfViewMode,
} from './visibilityManager';

/**
 * IntersectionObserver stub: tests call `fire( el, visible )` to simulate a
 * record for an observed element.
 */
class FakeObserver {
	constructor( callback ) {
		this.callback = callback;
		this.targets = new Set();
		FakeObserver.instance = this;
	}
	observe( el ) {
		this.targets.add( el );
	}
	unobserve( el ) {
		this.targets.delete( el );
	}
	fire( el, visible ) {
		this.callback( [ {
			target: el,
			isIntersecting: visible,
			intersectionRatio: visible ? 1 : 0,
			rootBounds: null,
			intersectionRect: null,
		} ] );
	}
}

/**
 * Minimal Video.js player stub with synchronous events. `pause()`/`play()`
 * emit their events like the real player (pause asynchronously).
 *
 * @param {Object}  [opts]        - Options.
 * @param {boolean} [opts.paused] - Initial paused state.
 * @param {boolean} [opts.muted]  - Initial muted state.
 * @return {Object} Player stub.
 */
const createPlayer = ( { paused = false, muted = false } = {} ) => {
	const handlers = {};
	const root = document.createElement( 'div' );
	root.appendChild( document.createElement( 'video' ) );
	document.body.appendChild( root );

	const state = { paused, muted, time: 0 };
	const player = {
		state,
		el: () => root,
		on: ( event, cb ) => {
			( handlers[ event ] = handlers[ event ] || [] ).push( cb );
		},
		off: ( event, cb ) => {
			handlers[ event ] = ( handlers[ event ] || [] ).filter( ( fn ) => fn !== cb );
		},
		one: ( event, cb ) => {
			const once = () => {
				player.off( event, once );
				cb();
			};
			player.on( event, once );
		},
		emit: ( event ) => ( handlers[ event ] || [] ).slice().forEach( ( cb ) => cb() ),
		paused: () => state.paused,
		muted: jest.fn( ( value ) => {
			if ( value === undefined ) {
				return state.muted;
			}
			state.muted = value;
			player.emit( 'volumechange' );
		} ),
		volume: () => 1,
		currentTime: () => state.time,
		isFullscreen: () => false,
		isInPictureInPicture: () => false,
		play: jest.fn( () => {
			state.paused = false;
			player.emit( 'play' );
			return Promise.resolve();
		} ),
		pause: jest.fn( () => {
			state.paused = true;
			setTimeout( () => player.emit( 'pause' ), 0 );
		} ),
	};
	return player;
};

const createManager = ( clock = { now: 1000 } ) =>
	new VisibilityManager( {
		win: { IntersectionObserver: FakeObserver, setTimeout, clearTimeout, setInterval, clearInterval },
		doc: document,
		now: () => clock.now,
		getPlayers: () => [],
	} );

const pointerDown = ( player ) =>
	player.el().dispatchEvent( new Event( 'pointerdown', { bubbles: true } ) );

describe( 'resolveOutOfViewMode', () => {
	it( 'reads data-out-of-view and defaults to pause', () => {
		const video = document.createElement( 'video' );
		expect( resolveOutOfViewMode( video ) ).toBe( 'pause' );
		video.dataset.outOfView = 'mute';
		expect( resolveOutOfViewMode( video ) ).toBe( 'mute' );
		video.dataset.outOfView = 'nonsense';
		expect( resolveOutOfViewMode( video ) ).toBe( 'pause' );
	} );
} );

describe( 'isRecordVisible', () => {
	it( 'needs 25% of the player visible', () => {
		expect( isRecordVisible( { isIntersecting: true, intersectionRatio: 0.3 } ) ).toBe( true );
		expect( isRecordVisible( { isIntersecting: true, intersectionRatio: 0.1 } ) ).toBe( false );
		expect( isRecordVisible( { isIntersecting: false, intersectionRatio: 0 } ) ).toBe( false );
	} );

	it( 'treats a tall player covering 25% of the viewport as visible', () => {
		expect( isRecordVisible( {
			isIntersecting: true,
			intersectionRatio: 0.1,
			rootBounds: { width: 1000, height: 800 },
			intersectionRect: { width: 1000, height: 400 },
		} ) ).toBe( true );
	} );
} );

describe( 'VisibilityManager', () => {
	beforeEach( () => jest.useFakeTimers() );
	afterEach( () => {
		jest.useRealTimers();
		document.body.innerHTML = '';
	} );

	it( 'does not register players set to off', () => {
		const manager = createManager();
		expect( manager.register( createPlayer(), { mode: OUT_OF_VIEW_MODE.OFF } ) ).toBeNull();
	} );

	it( 'pauses an autoplaying video when hidden and resumes it when visible', () => {
		const manager = createManager();
		const player = createPlayer();
		manager.register( player );

		FakeObserver.instance.fire( player.el(), false );
		expect( player.pause ).toHaveBeenCalledTimes( 1 );

		jest.runOnlyPendingTimers();
		FakeObserver.instance.fire( player.el(), true );
		expect( player.play ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'flags the automatic pause while its event is dispatched', () => {
		const manager = createManager();
		const player = createPlayer();
		manager.register( player );

		let flagDuringPause = null;
		player.on( 'pause', () => {
			flagDuringPause = isAutoPause( player );
		} );

		FakeObserver.instance.fire( player.el(), false );
		jest.advanceTimersByTime( 0 );
		expect( flagDuringPause ).toBe( true );
		jest.runOnlyPendingTimers();
		expect( isAutoPause( player ) ).toBe( false );
	} );

	it( 'pauses a visitor-started video and does not resume it', () => {
		const clock = { now: 1000 };
		const manager = createManager( clock );
		const player = createPlayer( { paused: true } );
		manager.register( player );

		pointerDown( player );
		player.play();
		expect( manager.isUserStarted( player ) ).toBe( true );

		FakeObserver.instance.fire( player.el(), false );
		expect( player.pause ).toHaveBeenCalledTimes( 1 );

		jest.runOnlyPendingTimers();
		player.play.mockClear();
		FakeObserver.instance.fire( player.el(), true );
		expect( player.play ).not.toHaveBeenCalled();
	} );

	it( 'mutes a visitor-started video in mute mode and keeps it muted when visible', () => {
		const manager = createManager();
		const player = createPlayer( { paused: true } );
		manager.register( player, { mode: OUT_OF_VIEW_MODE.MUTE } );

		pointerDown( player );
		player.play();

		FakeObserver.instance.fire( player.el(), false );
		expect( player.pause ).not.toHaveBeenCalled();
		expect( player.state.muted ).toBe( true );

		FakeObserver.instance.fire( player.el(), true );
		expect( player.state.muted ).toBe( true );
	} );

	it( 'still pauses autoplaying videos in mute mode', () => {
		const manager = createManager();
		const player = createPlayer();
		manager.register( player, { mode: OUT_OF_VIEW_MODE.MUTE } );

		FakeObserver.instance.fire( player.el(), false );
		expect( player.pause ).toHaveBeenCalledTimes( 1 );
		expect( player.state.muted ).toBe( false );
	} );

	it( 'treats a manual pause of an autoplay video as interaction (no resume)', () => {
		const clock = { now: 1000 };
		const manager = createManager( clock );
		const player = createPlayer();
		manager.register( player );

		pointerDown( player );
		player.pause();
		jest.runOnlyPendingTimers();
		expect( manager.isUserStarted( player ) ).toBe( true );

		FakeObserver.instance.fire( player.el(), false );
		FakeObserver.instance.fire( player.el(), true );
		expect( player.play ).not.toHaveBeenCalled();
	} );

	it( 'ignores clicks on interactive layers', () => {
		const manager = createManager();
		const player = createPlayer( { paused: true } );
		manager.register( player );

		const layer = document.createElement( 'div' );
		layer.className = 'easydam-layer';
		player.el().appendChild( layer );
		layer.dispatchEvent( new Event( 'pointerdown', { bubbles: true } ) );
		player.play();

		expect( manager.isUserStarted( player ) ).toBe( false );
	} );

	it( 'does not resume a hover preview', () => {
		const manager = createManager();
		const player = createPlayer();
		manager.register( player, { isPreview: () => true } );

		FakeObserver.instance.fire( player.el(), false );
		expect( player.pause ).toHaveBeenCalledTimes( 1 );
		jest.runOnlyPendingTimers();

		FakeObserver.instance.fire( player.el(), true );
		expect( player.play ).not.toHaveBeenCalled();
	} );

	it( 'never pauses in fullscreen', () => {
		const manager = createManager();
		const player = createPlayer();
		player.isFullscreen = () => true;
		manager.register( player );

		FakeObserver.instance.fire( player.el(), false );
		expect( player.pause ).not.toHaveBeenCalled();
	} );

	it( 'never pauses during custom (iOS) fullscreen', () => {
		const manager = createManager();
		const player = createPlayer();
		player.el().classList.add( 'vjs-fullscreen' );
		manager.register( player );

		FakeObserver.instance.fire( player.el(), false );
		expect( player.pause ).not.toHaveBeenCalled();
	} );

	it( 're-pauses a hidden video that a script starts again', () => {
		const manager = createManager();
		const player = createPlayer();
		manager.register( player );

		FakeObserver.instance.fire( player.el(), false );
		jest.runOnlyPendingTimers();
		player.pause.mockClear();

		player.play(); // e.g. a hover handler or slider calling play()
		jest.runOnlyPendingTimers();
		expect( player.pause ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'counts a lightbox / keyboard interaction via markInteraction', () => {
		const manager = createManager();
		const player = createPlayer();
		manager.register( player );
		manager.markInteraction( player );

		FakeObserver.instance.fire( player.el(), false );
		jest.runOnlyPendingTimers();
		FakeObserver.instance.fire( player.el(), true );
		expect( player.play ).not.toHaveBeenCalled();
	} );

	it( 'records off-screen muted playback separately for analytics', () => {
		const manager = createManager();
		const player = createPlayer( { paused: true } );
		manager.register( player, { mode: OUT_OF_VIEW_MODE.MUTE } );

		pointerDown( player );
		player.play();

		[ 0, 1, 2 ].forEach( ( t ) => {
			player.state.time = t;
			player.emit( 'timeupdate' );
		} );
		FakeObserver.instance.fire( player.el(), false );
		[ 3, 4 ].forEach( ( t ) => {
			player.state.time = t;
			player.emit( 'timeupdate' );
		} );

		expect( player.godamVisibleRanges ).toEqual( [ [ 0, 2 ] ] );
		expect( player.godamHiddenRanges ).toEqual( [ [ 2, 4 ] ] );
	} );

	it( 'pauseAll pauses playing players except the given ones', () => {
		const a = createPlayer();
		const b = createPlayer();
		const manager = new VisibilityManager( {
			win: { IntersectionObserver: FakeObserver, setTimeout, clearTimeout, setInterval, clearInterval },
			doc: document,
			getPlayers: () => [ a, b ],
		} );

		expect( manager.pauseAll( { except: b.el() } ) ).toBe( 1 );
		expect( a.pause ).toHaveBeenCalled();
		expect( b.pause ).not.toHaveBeenCalled();
	} );

	it( 'pauseAll keeps autoplaying videos resumable and visitor-started ones paused', () => {
		const auto = createPlayer();
		const visitor = createPlayer( { paused: true } );
		const manager = new VisibilityManager( {
			win: { IntersectionObserver: FakeObserver, setTimeout, clearTimeout, setInterval, clearInterval },
			doc: document,
			now: () => 1000,
			getPlayers: () => [ auto, visitor ],
		} );
		const autoEntry = manager.register( auto );
		const visitorEntry = manager.register( visitor );
		pointerDown( visitor );
		visitor.play();

		expect( manager.pauseAll() ).toBe( 2 );
		expect( autoEntry.resumeWhenVisible ).toBe( true );
		expect( visitorEntry.resumeWhenVisible ).toBe( false );
	} );

	it( 'pauseAll on an in-view autoplay video does not resume it on a tab switch', () => {
		const player = createPlayer();
		const manager = new VisibilityManager( {
			win: { IntersectionObserver: FakeObserver, setTimeout, clearTimeout, setInterval, clearInterval },
			doc: document,
			getPlayers: () => [ player ],
		} );
		manager.register( player );

		manager.pauseAll();
		jest.runOnlyPendingTimers();
		player.play.mockClear();

		// Tab hidden then shown again: the player itself never left the view.
		manager.handleDocumentVisibility();
		expect( player.play ).not.toHaveBeenCalled();

		// Scrolled (or swiped) out and back: now it resumes.
		FakeObserver.instance.fire( player.el(), false );
		FakeObserver.instance.fire( player.el(), true );
		expect( player.play ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'resumes after a tab switch when a script restarted a pauseAll()-paused video', () => {
		let hidden = false;
		Object.defineProperty( document, 'hidden', { configurable: true, get: () => hidden } );
		const player = createPlayer();
		const manager = new VisibilityManager( {
			win: { IntersectionObserver: FakeObserver, setTimeout, clearTimeout, setInterval, clearInterval },
			doc: document,
			getPlayers: () => [ player ],
		} );
		manager.register( player );

		manager.pauseAll();
		jest.runOnlyPendingTimers();
		player.play(); // script play while in view
		jest.runOnlyPendingTimers();
		player.play.mockClear();

		hidden = true;
		manager.handleDocumentVisibility();
		jest.runOnlyPendingTimers();
		hidden = false;
		manager.handleDocumentVisibility();

		expect( player.play ).toHaveBeenCalledTimes( 1 );
		delete document.hidden;
	} );

	it( 'resumes a pauseAll()-paused autoplay video on a fade carousel', () => {
		const clock = { now: 0 };
		const player = createPlayer();
		let cssVisible = true;
		player.el().checkVisibility = () => cssVisible;
		const manager = new VisibilityManager( {
			win: { IntersectionObserver: FakeObserver, setTimeout, clearTimeout, setInterval, clearInterval },
			doc: document,
			now: () => clock.now,
			getPlayers: () => [ player ],
		} );
		manager.register( player );
		const advance = ( ms ) => {
			for ( let t = 0; t < ms; t += 100 ) {
				clock.now += 100;
				jest.advanceTimersByTime( 100 );
			}
		};

		manager.pauseAll(); // slideChange
		jest.runOnlyPendingTimers();
		player.play.mockClear();

		cssVisible = false; // old slide fades out
		advance( 5000 );
		expect( player.play ).not.toHaveBeenCalled();

		cssVisible = true; // visitor goes back
		advance( 2000 );
		expect( player.paused() ).toBe( false );
		expect( player.play ).toHaveBeenCalledTimes( 1 );

		// Nothing is waiting any more, so the poll stops.
		advance( 1000 );
		expect( manager.stylePollTimer ).toBeNull();
	} );

	it( 'pauseAll does not undo a visibility pause that ran first', () => {
		const player = createPlayer();
		const manager = new VisibilityManager( {
			win: { IntersectionObserver: FakeObserver, setTimeout, clearTimeout, setInterval, clearInterval },
			doc: document,
			getPlayers: () => [ player ],
		} );
		const entry = manager.register( player );

		FakeObserver.instance.fire( player.el(), false );
		expect( entry.resumeWhenVisible ).toBe( true );
		expect( manager.pauseAll() ).toBe( 0 );
		expect( entry.resumeWhenVisible ).toBe( true );
	} );

	it( 'pauseAll treats an element wrapping the player as an exception', () => {
		const player = createPlayer();
		const slide = document.createElement( 'div' );
		slide.appendChild( player.el() );
		document.body.appendChild( slide );
		const manager = new VisibilityManager( {
			win: { IntersectionObserver: FakeObserver, setTimeout, clearTimeout, setInterval, clearInterval },
			doc: document,
			getPlayers: () => [ player ],
		} );

		expect( manager.pauseAll( { except: slide } ) ).toBe( 0 );
		expect( player.pause ).not.toHaveBeenCalled();
	} );

	it( 'records off-screen playback even when the visitor had already muted it', () => {
		const manager = createManager();
		const player = createPlayer( { paused: true, muted: true } );
		manager.register( player, { mode: OUT_OF_VIEW_MODE.MUTE } );

		pointerDown( player );
		player.play();
		FakeObserver.instance.fire( player.el(), false );
		[ 0, 1, 2 ].forEach( ( t ) => {
			player.state.time = t;
			player.emit( 'timeupdate' );
		} );

		expect( player.godamHiddenRanges ).toEqual( [ [ 0, 2 ] ] );
		expect( player.godamVisibleRanges ).toEqual( [] );
	} );

	it( 'keeps counting off-screen playback across throttled timeupdate gaps', () => {
		const manager = createManager();
		const player = createPlayer( { paused: true } );
		manager.register( player, { mode: OUT_OF_VIEW_MODE.MUTE } );

		pointerDown( player );
		player.play();
		FakeObserver.instance.fire( player.el(), false );
		[ 0, 5, 12 ].forEach( ( t ) => {
			player.state.time = t;
			player.emit( 'timeupdate' );
		} );

		expect( player.godamHiddenRanges ).toEqual( [ [ 0, 12 ] ] );
	} );

	it( 'restores ad volume when a muted ad comes back into view', () => {
		const manager = createManager();
		const player = createPlayer( { paused: true } );
		let volume = 0.8;
		const adsManager = { getVolume: () => volume, setVolume: jest.fn( ( v ) => ( volume = v ) ) };
		player.ads = { inAdBreak: () => true };
		player.ima = { getAdsManager: () => adsManager, pauseAd: jest.fn(), resumeAd: jest.fn() };
		manager.register( player, { mode: OUT_OF_VIEW_MODE.MUTE } );

		pointerDown( player );
		player.play();
		FakeObserver.instance.fire( player.el(), false );
		expect( volume ).toBe( 0 );

		FakeObserver.instance.fire( player.el(), true );
		expect( volume ).toBe( 0.8 );
		expect( player.ima.pauseAd ).not.toHaveBeenCalled();
	} );

	it( 'keeps polling CSS visibility for an ad it paused behind a hidden slide', () => {
		const manager = createManager();
		const player = createPlayer();
		const entry = manager.register( player );
		entry.styleVisible = false;
		entry.adPausedByUs = true;

		expect( manager.isWaitingBehindStyle( entry ) ).toBe( true );
		manager.syncStylePoll();
		expect( manager.stylePollTimer ).not.toBeNull();
	} );

	it( 'stops managing a player after unregister', () => {
		const manager = createManager();
		const player = createPlayer();
		manager.register( player );
		const observer = FakeObserver.instance;
		manager.unregister( player );

		observer.fire( player.el(), false );
		expect( player.pause ).not.toHaveBeenCalled();
	} );
} );
