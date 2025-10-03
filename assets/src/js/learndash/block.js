/**
 * Video Completion Handler for LearnDash LMS
 * Manages video completion tracking and lesson progression controls
 *
 * @since 1.4.0
 */
/* global learndash_video_data, ld_video_players, LearnDash_disable_assets, LearnDash_watchPlayers, LearnDash_watchPlayersEnd, LearnDash_Video_Progress_initSettings, LearnDash_Video_Progress_setSetting, LearnDash_Video_Progress_getSetting */

/**
 * Video Completion Handler Object
 */
const GoDAMLearnDashBlockIntegration = {

	/**
	 * Configuration settings
	 *
	 * @since 1.4.0
	 */
	config: {},

	/**
	 * Initialize the video completion handler
	 *
	 * @since 1.4.0
	 */
	init() {
		this.loadConfiguration();
		this.setupInitialState();
		this.bindVideoEvents();
	},

	/**
	 * Load configuration from LearnDash tracking settings
	 *
	 * @since 1.4.0
	 */
	loadConfiguration() {
		/* eslint-disable camelcase */
		if ( typeof window.learndash_video_data === 'undefined' ||
			learndash_video_data?.videos_found_provider !== 'rtgodam' ) {
			return;
		}

		// Override LearnDash settings as needed.
		learndash_video_data.video_track_path = '/';
		learndash_video_data.videos_auto_complete = false;
		learndash_video_data.videos_auto_complete_delay = undefined;
		learndash_video_data.videos_auto_complete_delay_message = undefined;
		learndash_video_data.videos_hide_complete_button = false;

		this.config = learndash_video_data;
		/* eslint-enable camelcase */
	},

	/**
	 * Set up initial state (disable assets if required)
	 *
	 * @since 1.4.0
	 */
	setupInitialState() {
		const players = document.querySelectorAll(
			`div[data-video-progression="true"][data-video-provider="${ this.config.videos_found_provider }"]`,
		);

		if ( ! players.length ) {
			return;
		}

		// Disable default LD assets until video is complete.
		LearnDash_disable_assets( true );
		LearnDash_watchPlayers();

		this.players = players;
	},

	/**
	 * Bind video player events
	 *
	 * @since 1.4.0
	 */
	bindVideoEvents() {
		/* eslint-disable camelcase */
		if ( ! this.players ) {
			return;
		}

		this.players.forEach( ( player, index ) => {
			const playerKey = `godam-player-${ index }`;
			let playerId = player.getAttribute( 'id' );

			if ( ! playerId ) {
				playerId = `godam-video-${ index }`;
				player.setAttribute( 'id', playerId );
			}

			ld_video_players[ playerKey ] = {
				player_key: playerKey,
				player_type: this.config.videos_found_provider,
				player_id: playerId,
				player_wrapper: player.closest( 'div' ),
			};

			const wrapper = ld_video_players[ playerKey ].player_wrapper;
			ld_video_players[ playerKey ].player_cookie_key = wrapper?.getAttribute( 'data-video-cookie-key' ) || '';

			// Initialize LD video settings.
			ld_video_players[ playerKey ].player_cookie_values = LearnDash_Video_Progress_initSettings(
				ld_video_players[ playerKey ],
			);
			ld_video_players[ playerKey ].player = wrapper.querySelector( 'video' );

			// Restore video state.
			const videoState = LearnDash_Video_Progress_getSetting( ld_video_players[ playerKey ], 'video_state' );

			if ( videoState === 'complete' ) {
				// If video was already completed, re-enable assets
				LearnDash_disable_assets( false );
				LearnDash_watchPlayersEnd();
			} else {
				// Bind ended event
				this.bindEndedEvent( playerKey );
			}
		} );
		/* eslint-enable camelcase */
	},

	/**
	 * Bind "ended" event for a player
	 *
	 * @param {string} playerKey Player key
	 *
	 * @since 1.4.0
	 */
	bindEndedEvent( playerKey ) {
		/* eslint-disable camelcase */
		const video = ld_video_players[ playerKey ].player;
		if ( ! video ) {
			return;
		}

		video.addEventListener( 'timeupdate', () => {
			LearnDash_Video_Progress_setSetting( ld_video_players[ playerKey ], 'video_duration', video.duration );
			LearnDash_Video_Progress_setSetting( ld_video_players[ playerKey ], 'video_time', video.currentTime );

			// Check if video has reached the end
			if ( video.duration && video.duration === video.currentTime ) {
				LearnDash_Video_Progress_setSetting( ld_video_players[ playerKey ], 'video_state', 'complete' );

				LearnDash_disable_assets( false );
				LearnDash_watchPlayersEnd();
			}
		} );

		video.addEventListener( 'play', () => {
			LearnDash_Video_Progress_setSetting( ld_video_players[ playerKey ], 'video_duration', video.duration );
			LearnDash_Video_Progress_setSetting( ld_video_players[ playerKey ], 'video_time', video.currentTime );
			LearnDash_Video_Progress_setSetting( ld_video_players[ playerKey ], 'video_state', 'play' );
		} );

		video.addEventListener( 'pause', () => {
			LearnDash_Video_Progress_setSetting( ld_video_players[ playerKey ], 'video_time', video.currentTime );
			LearnDash_Video_Progress_setSetting( ld_video_players[ playerKey ], 'video_state', 'pause' );
		} );

		video.addEventListener( 'ended', () => {
			LearnDash_Video_Progress_setSetting( ld_video_players[ playerKey ], 'video_state', 'complete' );
			LearnDash_Video_Progress_setSetting( ld_video_players[ playerKey ], 'video_time', video.currentTime );

			// Re-enable LD progression.
			LearnDash_disable_assets( false );
			LearnDash_watchPlayersEnd();
		} );
		/* eslint-enable camelcase */
	},
};

/**
 * Initialize when document is ready.
 */
document.addEventListener( 'DOMContentLoaded', function() {
	GoDAMLearnDashBlockIntegration.init();
} );

// Make available globally
window.GoDAMLearnDashBlockIntegration = GoDAMLearnDashBlockIntegration;
