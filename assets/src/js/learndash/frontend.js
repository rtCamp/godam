/**
 * Connects GoDAM videos to LearnDash Video Progression.
 *
 * LearnDash renders the video inside `.ld-video` with the provider `godam`
 * (see inc/classes/learndash/class-learndash.php). LearnDash's own video script
 * only drives the providers it knows, so this script does for GoDAM what that
 * script does for its `local` provider, with LearnDash's own helpers:
 * it keeps the lesson assets locked until the video ends, resumes from the
 * last position, starts the video, pauses it while the window is out of focus
 * and saves the progress to the cookie LearnDash checks on Mark Complete.
 *
 * Both GoDAM Video blocks (a `<video>` the GoDAM player wraps) and GoDAM embeds
 * (an iframe driven through the GoDAM Player SDK) are supported.
 *
 * @since n.e.x.t
 */

/**
 * Whether a LearnDash video data flag is on.
 *
 * LearnDash passes its flags through wp_localize_script(), which turns `true`
 * and `1` into "1" and `false` and `0` into "" and "0".
 *
 * @since n.e.x.t
 *
 * @param {*} value Flag value.
 * @return {boolean} Whether the flag is on.
 */
export const isOn = ( value ) => value === true || value === 1 || value === '1';

/**
 * Read the player settings of the step: autostart, controls, pause when
 * unfocused and resume.
 *
 * LearnDash fills its own copies only while it applies progression, so they
 * are empty for admins and on completed steps. GoDAM passes the step's
 * settings as `rtgodam_player` so the player follows them every time.
 *
 * @since n.e.x.t
 *
 * @param {Object} data `learndash_video_data`.
 * @return {{autoStart: boolean, showControls: boolean, focusPause: boolean, trackTime: boolean}} Settings.
 */
export function getPlayerSettings( data ) {
	const own = data?.rtgodam_player;

	if ( own && typeof own === 'object' ) {
		return {
			autoStart: isOn( own.auto_start ),
			showControls: isOn( own.show_controls ),
			focusPause: isOn( own.focus_pause ),
			trackTime: isOn( own.track_time ),
		};
	}

	return {
		autoStart: isOn( data?.videos_auto_start ),
		showControls: isOn( data?.videos_show_controls ),
		focusPause: isOn( data?.video_focus_pause ),
		trackTime: isOn( data?.video_track_time ),
	};
}

/**
 * Run a call that may return a promise, ignoring a rejected one.
 *
 * Browsers reject play() when autoplay is blocked, which is not an error here.
 *
 * @since n.e.x.t
 *
 * @param {Function} call Call to run.
 */
const quietly = ( call ) => {
	try {
		const result = call();
		if ( result && typeof result.catch === 'function' ) {
			result.catch( () => {} );
		}
	} catch ( error ) {
		// Same as above: nothing to report.
	}
};

/**
 * Player controls for a GoDAM Video block.
 *
 * Listens to the `<video>` element, which fires the media events whether or
 * not the GoDAM player has wrapped it yet, and goes through the video.js
 * player for commands when there is one.
 *
 * @since n.e.x.t
 *
 * @param {HTMLVideoElement} video The block's video element.
 * @param {Window}           win   Window.
 * @return {Object} Player controls.
 */
export function createBlockAdapter( video, win ) {
	const getPlayer = () => {
		try {
			return win.videojs?.getPlayer?.( video ) || null;
		} catch ( error ) {
			return null;
		}
	};

	return {
		on( event, callback ) {
			video.addEventListener( event, callback );
		},
		whenReady( callback ) {
			if ( video.readyState >= 1 ) {
				callback();
				return;
			}
			video.addEventListener( 'loadedmetadata', callback, { once: true } );
		},
		getCurrentTime: () => video.currentTime || 0,
		getDuration: () => ( Number.isFinite( video.duration ) ? video.duration : 0 ),
		isPaused: () => video.paused,
		seek( time ) {
			const player = getPlayer();
			if ( player ) {
				player.currentTime( time );
			} else {
				video.currentTime = time;
			}
		},
		play() {
			const player = getPlayer();
			quietly( () => ( player ? player.play() : video.play() ) );
		},
		pause() {
			const player = getPlayer();
			quietly( () => ( player ? player.pause() : video.pause() ) );
		},
		mute() {
			const player = getPlayer();
			if ( player ) {
				player.muted( true );
			}
			video.muted = true;
		},
	};
}

/**
 * Player controls for a GoDAM embed, through the GoDAM Player SDK.
 *
 * The SDK answers questions asynchronously, so the time, duration and paused
 * state come from the events the embed sends.
 *
 * Commands wait until the embed says it is ready: the page sends autostart
 * and resume before the iframe has loaded, and a command the embed is not yet
 * listening for is lost. If the ready message came before the SDK was
 * listening, they go out after `readyTimeout` anyway.
 *
 * @since n.e.x.t
 *
 * @param {HTMLIFrameElement} iframe         The embed iframe.
 * @param {Window}            win            Window.
 * @param {string}            apiOrigin      GoDAM origin the embed messages come from.
 * @param {number}            [readyTimeout] Milliseconds to wait for the ready message.
 * @return {Object|null} Player controls, or null when the SDK is missing.
 */
export function createEmbedAdapter( iframe, win, apiOrigin, readyTimeout = 5000 ) {
	if ( typeof win.GoDAMPlayer !== 'function' ) {
		return null;
	}

	let player;
	try {
		player = new win.GoDAMPlayer( iframe, { allowedOrigins: apiOrigin ? [ apiOrigin ] : [ '*' ] } );
	} catch ( error ) {
		return null;
	}

	const state = { currentTime: 0, duration: 0, paused: true };
	const update = ( data ) => {
		if ( data && Number.isFinite( data.currentTime ) ) {
			state.currentTime = data.currentTime;
		}
		if ( data && Number.isFinite( data.duration ) && data.duration > 0 ) {
			state.duration = data.duration;
		}
	};

	player.on( 'play', () => {
		state.paused = false;
	} );
	player.on( 'timeupdate', ( data ) => {
		update( data );
		state.paused = false;
	} );
	player.on( 'pause', ( data ) => {
		update( data );
		state.paused = true;
	} );
	player.on( 'ended', ( data ) => {
		update( data );
		state.paused = true;
	} );

	const ready = Promise.race( [
		Promise.resolve().then( () => player.ready() ),
		new Promise( ( resolve ) => win.setTimeout( resolve, readyTimeout ) ),
	] ).catch( () => {} );

	// Commands run in the order they are given, once the embed is ready.
	const send = ( command ) => {
		ready.then( () => quietly( command ) );
	};

	return {
		on( event, callback ) {
			player.on( event, () => callback() );
		},
		whenReady( callback ) {
			ready.then( () => {
				quietly( () => player.getDuration().then( ( duration ) => {
					update( { duration } );
				} ).finally( callback ) );
			} );
		},
		getCurrentTime: () => state.currentTime,
		getDuration: () => state.duration,
		isPaused: () => state.paused,
		seek( time ) {
			send( () => player.seek( time ) );
		},
		play() {
			send( () => player.play() );
		},
		pause() {
			send( () => player.pause() );
		},
		mute() {
			send( () => player.setMuted( true ) );
		},
	};
}

/**
 * Connect one player to LearnDash's progress for it.
 *
 * Follows LearnDash's handling of its `local` provider (assets/js/learndash_video_script.js).
 *
 * @since n.e.x.t
 *
 * @param {Object}   args
 * @param {Object}   args.adapter  Player controls, from createBlockAdapter() or createEmbedAdapter().
 * @param {Object}   args.ldPlayer LearnDash player entry, as in `ld_video_players`.
 * @param {Object}   args.data     `learndash_video_data`.
 * @param {Object}   args.ld       LearnDash helpers: `setSetting`, `getSetting`, `complete`.
 * @param {Window}   args.win      Window.
 * @param {Function} [args.now]    Clock, for tests.
 */
export function connectPlayer( { adapter, ldPlayer, data, ld, win, now = Date.now } ) {
	const settings = getPlayerSettings( data );
	let completed = false;
	let pausedByFocus = false;
	let lastSaved = 0;

	const save = ( key, value ) => ld.setSetting( ldPlayer, key, value );

	const complete = () => {
		if ( completed ) {
			return;
		}
		completed = true;
		save( 'video_time', adapter.getCurrentTime() );
		save( 'video_state', 'complete' );
		ld.complete();
	};

	adapter.whenReady( () => {
		if ( ! settings.trackTime ) {
			return;
		}

		const time = Number( ld.getSetting( ldPlayer, 'video_time' ) ) || 0;
		const duration = adapter.getDuration();

		if ( time > 0 && ( ! duration || time < duration - 1 ) ) {
			adapter.seek( time );
		}
	} );

	if ( settings.autoStart ) {
		adapter.mute();
		adapter.play();
		save( 'video_state', 'play' );
	}

	/*
	 * Once the video is complete the progress stays as it is, like LearnDash
	 * stops tracking its own players. LearnDash_Video_Progress_setSetting()
	 * replaces a `complete` state, and its Mark Complete check needs to find
	 * it, so watching the video again must not save `play`.
	 */
	adapter.on( 'play', () => {
		if ( ! completed ) {
			save( 'video_state', 'play' );
		}
	} );

	adapter.on( 'pause', () => {
		if ( completed ) {
			return;
		}
		save( 'video_time', adapter.getCurrentTime() );
		save( 'video_state', 'pause' );
	} );

	adapter.on( 'timeupdate', () => {
		if ( completed ) {
			return;
		}

		const time = adapter.getCurrentTime();
		const duration = adapter.getDuration();

		if ( now() - lastSaved >= 1000 ) {
			lastSaved = now();
			save( 'video_time', time );
			if ( duration ) {
				save( 'video_duration', duration );
			}
		}

		// A looping video never fires `ended`; reaching the last moment counts.
		if ( duration && time >= duration - 0.3 ) {
			complete();
		}
	} );

	adapter.on( 'ended', complete );

	if ( ! settings.focusPause ) {
		return;
	}

	const doc = win.document;

	const pauseIfUnfocused = () => {
		// Focus inside the embed iframe still counts as focus on this page.
		const unfocused = doc.hidden || ( typeof doc.hasFocus === 'function' && ! doc.hasFocus() );
		if ( completed || ! unfocused || adapter.isPaused() ) {
			return;
		}
		pausedByFocus = true;
		adapter.pause();
	};

	const resumeIfFocused = () => {
		if ( ! pausedByFocus || doc.hidden ) {
			return;
		}
		pausedByFocus = false;

		// Like LearnDash: with controls shown the learner resumes it themselves.
		if ( ! completed && ! settings.showControls ) {
			adapter.play();
		}
	};

	// `blur` fires before focus moves into an iframe, so check once it has settled.
	win.addEventListener( 'blur', () => win.setTimeout( pauseIfUnfocused, 0 ) );
	win.addEventListener( 'focus', resumeIfFocused );
	doc.addEventListener( 'visibilitychange', () => ( doc.hidden ? pauseIfUnfocused() : resumeIfFocused() ) );
}

/**
 * Connect every GoDAM video LearnDash shows on the page.
 *
 * The player settings (autostart, controls, pause when unfocused, resume)
 * apply to every one of them. Locking the lesson until the video ends applies
 * only where LearnDash enforces progression (`data-video-progression="true"`):
 * not for admins who bypass it, and not on a step the learner completed.
 *
 * @since n.e.x.t
 *
 * @param {Window} win Window.
 * @return {Object[]} The LearnDash player entries it connected.
 */
export function init( win = window ) {
	const data = win.learndash_video_data;
	const config = win.rtgodamLearnDash || {};
	const provider = config.provider || 'godam';

	if ( ! data || data.videos_found_provider !== provider ) {
		return [];
	}

	const helpers = [
		'LearnDash_disable_assets',
		'LearnDash_Video_Progress_initSettings',
		'LearnDash_Video_Progress_setSetting',
		'LearnDash_Video_Progress_getSetting',
	];
	if ( helpers.some( ( name ) => typeof win[ name ] !== 'function' ) ) {
		return [];
	}

	const wrappers = win.document.querySelectorAll( `.ld-video[data-video-provider="${ provider }"]` );

	// Only players it can control: locking the lesson for one it cannot would lock it for good.
	const players = [];
	wrappers.forEach( ( wrapper ) => {
		const element = wrapper.querySelector( 'video' ) || wrapper.querySelector( 'iframe' );
		if ( ! element ) {
			return;
		}

		const adapter = 'IFRAME' === element.tagName
			? createEmbedAdapter( element, win, config.apiOrigin )
			: createBlockAdapter( element, win );

		if ( adapter ) {
			players.push( { wrapper, element, adapter, locks: 'true' === wrapper.getAttribute( 'data-video-progression' ) } );
		}
	} );

	if ( ! players.length ) {
		return [];
	}

	let assetsUnlocked = false;
	const ld = {
		setSetting: win.LearnDash_Video_Progress_setSetting,
		getSetting: win.LearnDash_Video_Progress_getSetting,
		complete() {
			// Unlock once: LearnDash starts the auto-complete countdown each time.
			if ( assetsUnlocked ) {
				return;
			}
			assetsUnlocked = true;
			win.LearnDash_disable_assets( false );
		},
	};

	// Without progression there is nothing to unlock, and unlocking could auto-complete the step.
	const ldWithoutLock = { ...ld, complete() {} };

	// `ld_video_players` is a global LearnDash's script declares; keep ours there too.
	const registry = win.ld_video_players && typeof win.ld_video_players === 'object' ? win.ld_video_players : {};

	if ( players.some( ( { locks } ) => locks ) ) {
		win.LearnDash_disable_assets( true );
	}

	const settings = getPlayerSettings( data );

	return players.map( ( { wrapper, element, adapter, locks }, index ) => {
		if ( ! settings.showControls ) {
			wrapper.classList.add( 'rtgodam-ld-no-controls' );
		}

		const key = `rtgodam-ld-video-${ index }`;
		const ldPlayer = {
			player_key: key,
			player_type: provider,
			player_id: element.getAttribute( 'id' ) || key,
			player_wrapper: wrapper,
			player_cookie_key: wrapper.getAttribute( 'data-video-cookie-key' ) || '',
			player: element,
		};
		ldPlayer.player_cookie_values = win.LearnDash_Video_Progress_initSettings( ldPlayer );
		registry[ key ] = ldPlayer;

		connectPlayer( { adapter, ldPlayer, data, ld: locks ? ld : ldWithoutLock, win } );

		return ldPlayer;
	} );
}

if ( typeof window !== 'undefined' && window.document ) {
	// The GoDAM player sets its players up on DOMContentLoaded too, and its listener is added first.
	if ( 'loading' === window.document.readyState ) {
		window.document.addEventListener( 'DOMContentLoaded', () => init( window ) );
	} else {
		init( window );
	}
}
