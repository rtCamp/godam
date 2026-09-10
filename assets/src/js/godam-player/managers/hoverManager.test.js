/**
 * Internal dependencies
 */
import HoverManager, { resetPreviewSessionMuted } from './hoverManager';

// The mute preference is shared, page-session module state; reset it after
// every spec so a failure mid-test cannot leak `false` into later specs.
afterEach( () => resetPreviewSessionMuted() );

/**
 * Minimal Video.js player stub.
 *
 * Records the handlers registered via `player.on()` so tests can dispatch the
 * asynchronous `play`/`pause` events by hand, and no-ops the rest of the API
 * HoverManager touches.
 *
 * @param {Object}  [opts]          - Overrides.
 * @param {boolean} [opts.autoplay] - Value returned by `player.autoplay()`.
 * @return {Object} The stub player, plus an `emit( event )` test helper.
 */
const createPlayer = ( { autoplay = false } = {} ) => {
	const handlers = {};
	const root = document.createElement( 'div' );
	return {
		autoplay: () => autoplay,
		on: ( event, cb ) => {
			( handlers[ event ] = handlers[ event ] || [] ).push( cb );
		},
		emit: ( event ) => ( handlers[ event ] || [] ).forEach( ( cb ) => cb() ),
		el: () => root,
		addClass: jest.fn(),
		removeClass: jest.fn(),
		play: jest.fn(),
		pause: jest.fn(),
		muted: jest.fn(),
		volume: jest.fn(),
		duration: jest.fn( () => 10 ),
		currentTime: jest.fn( () => 0 ),
		controlBar: { el: () => document.createElement( 'div' ) },
	};
};

/**
 * Builds a HoverManager wired to a `start-preview` <video>.
 *
 * @param {Object} player    - Player stub from `createPlayer`.
 * @param {Object} [options] - HoverManager options (e.g. `previewDelay`).
 * @return {HoverManager} The manager under test.
 */
const createManager = ( player, options = {} ) => {
	const video = document.createElement( 'video' );
	video.dataset.hoverSelect = 'start-preview';
	return new HoverManager( player, video, options );
};

describe( 'HoverManager preview suppression flag', () => {
	beforeEach( () => jest.useFakeTimers() );
	afterEach( () => jest.useRealTimers() );

	it( 'is inactive before any preview starts', () => {
		const manager = createManager( createPlayer() );
		expect( manager.isPreviewActive() ).toBe( false );
	} );

	it( 'becomes active when a preview starts', () => {
		const manager = createManager( createPlayer() );
		manager.startPreview();
		expect( manager.isPreviewActive() ).toBe( true );
	} );

	it( 'reports strictly boolean state', () => {
		const manager = createManager( createPlayer() );
		expect( manager.isPreviewActive() ).toStrictEqual( false );
		manager.startPreview();
		expect( manager.isPreviewActive() ).toStrictEqual( true );
	} );

	it( "ignores the preview's own play event so a fast flick keeps suppression", () => {
		const player = createPlayer();
		const manager = createManager( player );

		// Hover lingers past the delay, so the preview starts and queues its `play`.
		manager.handleMouseEnter();
		jest.runOnlyPendingTimers();
		expect( manager.isPreviewActive() ).toBe( true );

		// Pointer leaves before the queued `play` fires; the flag must survive so
		// the trailing `pause` cannot reveal an on_pause CTA.
		manager.handleMouseLeave();
		player.emit( 'play' );

		expect( manager.isPreviewActive() ).toBe( true );
	} );

	it( 'is not cleared by stopPreview()', () => {
		const manager = createManager( createPlayer() );
		manager.startPreview();
		manager.stopPreview();
		expect( manager.isPreviewActive() ).toBe( true );
	} );

	it( 'clears on a real play event even while still hovering', () => {
		const player = createPlayer();
		const manager = createManager( player );

		manager.handleMouseEnter();
		jest.runOnlyPendingTimers();
		player.emit( 'play' ); // consumes the preview-initiated play
		expect( manager.isPreviewActive() ).toBe( true );

		// A second, un-marked play (spacebar / programmatic) is real playback.
		player.emit( 'play' );
		expect( manager.isPreviewActive() ).toBe( false );
	} );

	it( 'marks real playback committed so a later hover cannot restart a preview', () => {
		const player = createPlayer();
		const manager = createManager( player );

		// Real playback from the big play button (no click on the <video>).
		player.emit( 'play' );
		expect( manager.isVideoClicked ).toBe( true );

		// A subsequent hover must not schedule or start another preview.
		manager.handleMouseEnter();
		jest.runOnlyPendingTimers();
		expect( manager.isPreviewActive() ).toBe( false );
		expect( player.play ).not.toHaveBeenCalled();
	} );

	it( 'clears when the video is clicked to commit playback', () => {
		const manager = createManager( createPlayer() );
		manager.handleMouseEnter();
		manager.handleVideoClick();
		expect( manager.isPreviewActive() ).toBe( false );
	} );
} );

describe( 'HoverManager hover-intent delay', () => {
	beforeEach( () => jest.useFakeTimers() );
	afterEach( () => jest.useRealTimers() );

	it( 'does not start the preview until the pointer lingers past the delay', () => {
		const player = createPlayer();
		const manager = createManager( player );

		manager.handleMouseEnter();
		expect( player.play ).not.toHaveBeenCalled();
		expect( manager.isPreviewActive() ).toBe( false );

		jest.advanceTimersByTime( 1000 );
		expect( player.play ).toHaveBeenCalled();
		expect( manager.isPreviewActive() ).toBe( true );
	} );

	it( 'never starts the preview when the pointer leaves before the delay', () => {
		const player = createPlayer();
		const manager = createManager( player );

		manager.handleMouseEnter();
		manager.handleMouseLeave();
		jest.advanceTimersByTime( 1000 );

		expect( player.play ).not.toHaveBeenCalled();
		expect( manager.isPreviewActive() ).toBe( false );
	} );

	it( 'commits straight to real playback when clicked during the delay', () => {
		const player = createPlayer();
		const manager = createManager( player );

		manager.handleMouseEnter();
		manager.handleVideoClick();
		jest.advanceTimersByTime( 1000 );

		// Committing unmutes; the pending muted preview must never run (it would
		// have called muted(true)).
		expect( player.muted ).toHaveBeenCalledWith( false );
		expect( player.muted ).not.toHaveBeenCalledWith( true );
		expect( manager.isPreviewActive() ).toBe( false );
	} );

	it( 'honours a custom delay from options', () => {
		const player = createPlayer();
		const manager = createManager( player, { previewDelay: 250 } );

		manager.handleMouseEnter();
		jest.advanceTimersByTime( 249 );
		expect( manager.isPreviewActive() ).toBe( false );

		jest.advanceTimersByTime( 1 );
		expect( manager.isPreviewActive() ).toBe( true );
	} );
} );

describe( 'HoverManager preview reel chrome', () => {
	beforeEach( () => jest.useFakeTimers() );
	afterEach( () => jest.useRealTimers() );

	it( 'builds a hidden progress stripe and mute button on the player root', () => {
		const player = createPlayer();
		createManager( player );

		const progress = player.el().querySelector( '.godam-preview-progress' );
		const fill = player.el().querySelector( '.godam-preview-progress__fill' );
		const mute = player.el().querySelector( '.godam-preview-mute' );

		expect( progress ).not.toBeNull();
		expect( fill ).not.toBeNull();
		expect( mute ).not.toBeNull();
		expect( progress.classList.contains( 'is-visible' ) ).toBe( false );
		expect( mute.classList.contains( 'is-visible' ) ).toBe( false );
	} );

	it( 'shows the chrome during a preview and advances the fill on timeupdate', () => {
		const player = createPlayer();
		const manager = createManager( player );
		const progress = player.el().querySelector( '.godam-preview-progress' );
		const fill = player.el().querySelector( '.godam-preview-progress__fill' );

		manager.handleMouseEnter();
		jest.runOnlyPendingTimers();
		expect( progress.classList.contains( 'is-visible' ) ).toBe( true );

		player.currentTime = () => 5; // duration is 10 → 50%
		player.emit( 'timeupdate' );
		expect( fill.style.width ).toBe( '50%' );

		manager.handleMouseLeave();
		expect( progress.classList.contains( 'is-visible' ) ).toBe( false );
	} );

	it( 'flags the container to hide share/transcript buttons while previewing', () => {
		const player = createPlayer();
		const container = document.createElement( 'div' );
		container.className = 'easydam-video-container';
		container.appendChild( player.el() );
		const manager = createManager( player );

		expect( container.classList.contains( 'godam-hover-preview-active' ) ).toBe( false );

		manager.handleMouseEnter();
		jest.runOnlyPendingTimers();
		expect( container.classList.contains( 'godam-hover-preview-active' ) ).toBe( true );

		manager.handleMouseLeave();
		expect( container.classList.contains( 'godam-hover-preview-active' ) ).toBe( false );
	} );

	it( 'clears the container flag when playback is committed by a click', () => {
		const player = createPlayer();
		const container = document.createElement( 'div' );
		container.className = 'easydam-video-container';
		container.appendChild( player.el() );
		const manager = createManager( player );

		manager.handleMouseEnter();
		jest.runOnlyPendingTimers();
		expect( container.classList.contains( 'godam-hover-preview-active' ) ).toBe( true );

		manager.handleVideoClick();
		expect( container.classList.contains( 'godam-hover-preview-active' ) ).toBe( false );
	} );

	it( 'toggles preview sound without committing to real playback', () => {
		const player = createPlayer();
		const manager = createManager( player );
		const mute = player.el().querySelector( '.godam-preview-mute' );

		manager.handleMouseEnter();
		jest.runOnlyPendingTimers();

		const before = mute.getAttribute( 'aria-pressed' );
		const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
		manager.handleMuteToggle( event );

		// The click is kept off the <video>, so it never commits to playback.
		expect( event.stopPropagation ).toHaveBeenCalled();
		expect( manager.isVideoClicked ).toBe( false );
		expect( manager.isPreviewActive() ).toBe( true );
		// The button state flipped.
		expect( mute.getAttribute( 'aria-pressed' ) ).not.toBe( before );

		// Restore the shared page-session mute preference for other tests.
		manager.handleMuteToggle( { preventDefault() {}, stopPropagation() {} } );
	} );
} );

/**
 * Richer player stub that models the two things the minimal stub cannot: a
 * stable control-bar element (so the `hide` class is observable) and Video.js's
 * `hasStarted_` latch (so `vjs-has-started` cannot be re-added once set).
 *
 * @return {Object} `{ p, root, controlBarEl }`.
 */
const createStatefulPlayer = () => {
	const handlers = {};
	const root = document.createElement( 'div' );
	const controlBarEl = document.createElement( 'div' );
	let mutedState = false;
	let vol = 1;
	let paused = true;
	let hasStarted = false;
	const p = {
		autoplay: () => false,
		el: () => root,
		controlBar: { el: () => controlBarEl },
		on: ( e, cb ) => ( handlers[ e ] = handlers[ e ] || [] ).push( cb ),
		emit: ( e ) => ( handlers[ e ] || [] ).forEach( ( cb ) => cb() ),
		addClass: ( c ) => root.classList.add( c ),
		removeClass: ( c ) => root.classList.remove( c ),
		muted: ( v ) => ( v === undefined ? mutedState : ( mutedState = v ) ),
		volume: ( v ) => ( v === undefined ? vol : ( vol = v ) ),
		duration: () => 10,
		currentTime: () => 0,
		pause: () => {
			paused = true;
			( handlers.pause || [] ).forEach( ( cb ) => cb() );
		},
		// Video.js fires `play` only when transitioning from paused, and
		// hasStarted(true) is a no-op once already started.
		play: () => {
			if ( ! paused ) {
				return;
			}
			paused = false;
			if ( ! hasStarted ) {
				hasStarted = true;
				root.classList.add( 'vjs-has-started' );
			}
			( handlers.play || [] ).forEach( ( cb ) => cb() );
		},
	};
	return { p, root, controlBarEl };
};

describe( 'HoverManager exit-to-playback restore', () => {
	beforeEach( () => jest.useFakeTimers() );
	afterEach( () => jest.useRealTimers() );

	it( 'restores sound, controls and started state when the big play button commits after a preview', () => {
		const { p, root, controlBarEl } = createStatefulPlayer();
		const manager = createManager( p );

		manager.handleMouseEnter();
		jest.runOnlyPendingTimers(); // preview runs (muted, control bar hidden)
		manager.handleMouseLeave(); // pointer leaves; poster returns
		manager.handleMouseEnter(); // re-enter, timer pending
		p.play(); // big play button, before the timer fires

		expect( p.muted() ).toBe( false );
		expect( controlBarEl.classList.contains( 'hide' ) ).toBe( false );
		expect( root.classList.contains( 'vjs-has-started' ) ).toBe( true );
		expect( root.classList.contains( 'godam-hover-started' ) ).toBe( false );
	} );

	it( 'keeps the viewer mute and volume across a pause/resume after commit', () => {
		const { p } = createStatefulPlayer();
		createManager( p );

		p.play(); // commit real playback
		p.muted( true ); // viewer mutes
		p.volume( 0.2 ); // viewer lowers volume
		p.pause();
		p.play(); // resume

		expect( p.muted() ).toBe( true );
		expect( p.volume() ).toBe( 0.2 );
	} );

	it( 'leaves the configured volume level untouched when committing', () => {
		const { p } = createStatefulPlayer();
		p.volume( 0.5 ); // site-configured volume
		createManager( p );

		p.play(); // commit real playback (unmutes, must not slam volume to 1)

		expect( p.muted() ).toBe( false );
		expect( p.volume() ).toBe( 0.5 );
	} );
} );

describe( 'HoverManager robustness fixes', () => {
	beforeEach( () => jest.useFakeTimers() );
	afterEach( () => jest.useRealTimers() );

	it( 'rolls the preview-initiated flag back when play() is rejected', async () => {
		const player = createPlayer();
		player.play = jest.fn( () => Promise.reject( new Error( 'NotAllowedError' ) ) );
		const manager = createManager( player );

		manager.handleMouseEnter();
		jest.runOnlyPendingTimers();
		await Promise.resolve(); // let the rejected play() settle
		await Promise.resolve();

		// A later real play must not be swallowed as the preview's own.
		player.emit( 'play' );
		expect( manager.isPreviewActive() ).toBe( false );
	} );

	it( 'restores the poster and control bar when autoplay is refused', async () => {
		const { p, root, controlBarEl } = createStatefulPlayer();
		p.play = () => Promise.reject( new Error( 'NotAllowedError' ) );
		const manager = createManager( p );

		manager.handleMouseEnter();
		jest.runOnlyPendingTimers(); // startPreview → play() rejects
		await Promise.resolve();
		await Promise.resolve();

		expect( controlBarEl.classList.contains( 'hide' ) ).toBe( false );
		expect( root.classList.contains( 'vjs-has-started' ) ).toBe( false );
		expect( root.classList.contains( 'godam-hover-started' ) ).toBe( true );
		expect( manager.isPreviewActive() ).toBe( false );
	} );

	it( 'cancels a pending preview timer on player dispose', () => {
		const player = createPlayer();
		const manager = createManager( player );

		manager.handleMouseEnter(); // schedules the delayed preview
		player.emit( 'dispose' );
		jest.runOnlyPendingTimers();

		expect( manager.isPreviewActive() ).toBe( false );
		expect( player.play ).not.toHaveBeenCalled();
	} );

	it( 'does not carry a cross-preview unmute onto an un-gestured player', () => {
		const gestured = createPlayer();
		const gesturedManager = createManager( gestured );

		// Viewer unmutes this preview (a user gesture on this player).
		gesturedManager.handleMouseEnter();
		jest.runOnlyPendingTimers();
		gesturedManager.handleMuteToggle( { preventDefault() {}, stopPropagation() {} } );
		expect( gestured.muted ).toHaveBeenLastCalledWith( false );

		// A different video's preview, with no gesture, must still start muted.
		const other = createPlayer();
		const otherManager = createManager( other );
		otherManager.applyPreviewMute();
		expect( other.muted ).toHaveBeenLastCalledWith( true );
	} );
} );
