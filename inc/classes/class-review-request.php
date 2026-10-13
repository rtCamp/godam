<?php
/**
 * Asks administrators for a wordpress.org review once GoDAM has worked for them.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Review_Request.
 *
 * A one-time, dismissible admin notice. It is shown only to administrators, only on the
 * WordPress Dashboard, Media Library and Plugins screens, and never in network admin. It
 * stays hidden until GoDAM has been on the site for a week and has finished transcoding a
 * few of the site's own videos, so the ask comes after a success and not on day one.
 *
 * The choices are stored per user: "Leave a review", "I already did" and the notice's close
 * button hide the notice for good, "Maybe later" hides it for 30 days. Clicks are not tracked
 * or reported anywhere.
 *
 * @since n.e.x.t
 */
class Review_Request {

	use Singleton;

	/**
	 * Where the "Leave a review" button goes: the plugin's reviews page, at the new-review form.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const REVIEW_URL = 'https://wordpress.org/support/plugin/godam/reviews/?filter=5#new-post';

	/**
	 * Site option holding the Unix time the notice's week-long wait started.
	 *
	 * Written the first time an admin screen loads with this code in place. A site that was
	 * already running GoDAM when this shipped therefore counts as day 0 from the update.
	 * Unlike `rtgodam_plugin_activation_time` it survives deactivation, so toggling the
	 * plugin does not restart the clock.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const STARTED_OPTION = 'rtgodam_review_request_started';

	/**
	 * User meta set once the user chose "Leave a review" or "I already did".
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const NEVER_META = 'rtgodam_review_request_never';

	/**
	 * User meta holding the Unix time until which "Maybe later" hides the notice.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const SNOOZED_UNTIL_META = 'rtgodam_review_request_snoozed_until';

	/**
	 * Admin-ajax action that stores a dismissal. It doubles as the nonce action.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const AJAX_ACTION = 'rtgodam_review_request_dismiss';

	/**
	 * Finished video transcodes needed before the notice may appear.
	 *
	 * @since n.e.x.t
	 *
	 * @var int
	 */
	const MIN_VIDEOS = 3;

	/**
	 * Days GoDAM must have been on the site before the notice may appear.
	 *
	 * @since n.e.x.t
	 *
	 * @var int
	 */
	const MIN_DAYS = 7;

	/**
	 * Days "Maybe later" hides the notice for.
	 *
	 * @since n.e.x.t
	 *
	 * @var int
	 */
	const SNOOZE_DAYS = 30;

	/**
	 * Admin screens the notice may appear on (WordPress Dashboard, Media Library, Plugins).
	 *
	 * GoDAM's own screens are left out on purpose: Pages::handle_admin_head() strips every
	 * admin notice from them.
	 *
	 * @since n.e.x.t
	 *
	 * @var string[]
	 */
	const SCREEN_IDS = array( 'dashboard', 'upload', 'plugins' );

	/**
	 * Construct method.
	 *
	 * @since n.e.x.t
	 */
	protected function __construct() {
		add_action( 'admin_init', array( $this, 'record_start' ) );
		add_action( 'admin_notices', array( $this, 'render_notice' ) );
		add_action( 'wp_ajax_' . self::AJAX_ACTION, array( $this, 'handle_dismiss' ) );
	}

	/**
	 * Remember when the week-long wait started, once.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function record_start() {
		if ( false === get_option( self::STARTED_OPTION ) ) {
			add_option( self::STARTED_OPTION, time() );
		}
	}

	/**
	 * Whether the notice should be shown to the current user on the current screen.
	 *
	 * The checks run cheapest first; the video lookup is last.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public function should_show() {
		if ( is_network_admin() || ! current_user_can( 'manage_options' ) ) {
			return false;
		}

		$screen = get_current_screen();

		if ( empty( $screen->id ) || ! in_array( $screen->id, self::SCREEN_IDS, true ) ) {
			return false;
		}

		$user_id = get_current_user_id();

		if ( self::is_hidden_for_user( get_user_meta( $user_id, self::NEVER_META, true ), get_user_meta( $user_id, self::SNOOZED_UNTIL_META, true ), time() ) ) {
			return false;
		}

		if ( ! self::has_waited_long_enough( get_option( self::STARTED_OPTION ), time() ) ) {
			return false;
		}

		return $this->has_enough_finished_videos();
	}

	/**
	 * Whether the user's own choice currently hides the notice.
	 *
	 * @since n.e.x.t
	 *
	 * @param mixed $dismissed     The "never again" user meta value.
	 * @param mixed $snoozed_until The "maybe later" user meta value (Unix time).
	 * @param int   $now           Current Unix time.
	 * @return bool
	 */
	public static function is_hidden_for_user( $dismissed, $snoozed_until, $now ) {
		return ! empty( $dismissed ) || (int) $snoozed_until > $now;
	}

	/**
	 * Whether the week-long wait is over.
	 *
	 * @since n.e.x.t
	 *
	 * @param mixed $started Value of the start option (Unix time), or false when unset.
	 * @param int   $now     Current Unix time.
	 * @return bool
	 */
	public static function has_waited_long_enough( $started, $now ) {
		$started = (int) $started;

		return $started > 0 && ( $now - $started ) >= self::MIN_DAYS * DAY_IN_SECONDS;
	}

	/**
	 * Whether the site has enough finished video transcodes of its own.
	 *
	 * A finished transcode is a video attachment whose `rtgodam_transcoding_status` meta is
	 * `transcoded` (the same state the Media Library's "Transcoded" filter reads). The demo
	 * videos the onboarding tours add arrive already marked `transcoded`, so they are skipped.
	 * Only the first few rows are fetched, since the answer is "at least this many".
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	private function has_enough_finished_videos() {
		// Media may live on another site (see the rtgodam_before_attachment_lookup docs).
		do_action( 'rtgodam_before_attachment_lookup' );
		try {
			$query = new \WP_Query(
				array(
					'post_type'              => 'attachment',
					'post_status'            => 'inherit',
					'post_mime_type'         => 'video',
					'posts_per_page'         => self::MIN_VIDEOS,
					'fields'                 => 'ids',
					'no_found_rows'          => true,
					'update_post_meta_cache' => false,
					'update_post_term_cache' => false,
					'meta_query'             => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- Capped at a few rows, and only after every cheaper check has passed.
						'relation' => 'AND',
						array(
							'key'   => 'rtgodam_transcoding_status',
							'value' => 'transcoded',
						),
						array(
							'key'     => 'rtgodam_is_demo_attachment',
							'compare' => 'NOT EXISTS',
						),
					),
				)
			);

			return count( $query->posts ) >= self::MIN_VIDEOS;
		} finally {
			do_action( 'rtgodam_after_attachment_lookup' );
		}
	}

	/**
	 * Print the notice and the few lines of script that store a dismissal.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function render_notice() {
		if ( ! $this->should_show() ) {
			return;
		}

		?>
		<div class="notice notice-info is-dismissible rtgodam-review-request">
			<p>
				<strong><?php esc_html_e( 'Enjoying GoDAM?', 'godam' ); ?></strong>
				<?php esc_html_e( 'A short review on WordPress.org helps other site owners find it.', 'godam' ); ?>
			</p>
			<p>
				<a class="button button-primary" href="<?php echo esc_url( self::REVIEW_URL ); ?>" target="_blank" rel="noopener noreferrer" data-rtgodam-review-choice="review">
					<?php esc_html_e( 'Leave a review', 'godam' ); ?>
				</a>
				<button type="button" class="button" data-rtgodam-review-choice="later">
					<?php esc_html_e( 'Maybe later', 'godam' ); ?>
				</button>
				<button type="button" class="button button-link" data-rtgodam-review-choice="done">
					<?php esc_html_e( 'I already did', 'godam' ); ?>
				</button>
			</p>
		</div>
		<?php

		// The close button WordPress adds to the notice is a permanent dismissal, so there is an
		// exit that does not claim a review was written. "Maybe later" is the only repeating choice.
		$config = array(
			'url'    => admin_url( 'admin-ajax.php' ),
			'action' => self::AJAX_ACTION,
			'nonce'  => wp_create_nonce( self::AJAX_ACTION ),
		);

		wp_print_inline_script_tag(
			'( function ( config ) {
				var notice = document.querySelector( ".rtgodam-review-request" );
				if ( ! notice ) {
					return;
				}
				notice.addEventListener( "click", function ( event ) {
					var target = event.target.closest( "[data-rtgodam-review-choice], .notice-dismiss" );
					if ( ! target ) {
						return;
					}
					var choice = target.classList.contains( "notice-dismiss" ) ? "dismiss" : target.getAttribute( "data-rtgodam-review-choice" );
					var body = new FormData();
					body.append( "action", config.action );
					body.append( "nonce", config.nonce );
					body.append( "choice", choice );
					notice.style.display = "none";
					window.fetch( window.ajaxurl || config.url, { method: "POST", body: body, credentials: "same-origin", keepalive: true } );
				} );
			} )( ' . wp_json_encode( $config ) . ' );',
			array( 'id' => 'rtgodam-review-request-js' )
		);
	}

	/**
	 * Store the current user's choice.
	 *
	 * `review`, `done` and `dismiss` (the close button) are stored the same way on purpose:
	 * GoDAM does not track whether the review button was clicked.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function handle_dismiss() {
		check_ajax_referer( self::AJAX_ACTION, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( null, 403 );
		}

		$choice  = isset( $_POST['choice'] ) ? sanitize_key( wp_unslash( $_POST['choice'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified by check_ajax_referer() above.
		$user_id = get_current_user_id();

		if ( in_array( $choice, array( 'review', 'done', 'dismiss' ), true ) ) {
			update_user_meta( $user_id, self::NEVER_META, 1 );
		} elseif ( 'later' === $choice ) {
			update_user_meta( $user_id, self::SNOOZED_UNTIL_META, time() + self::SNOOZE_DAYS * DAY_IN_SECONDS );
		} else {
			wp_send_json_error( null, 400 );
		}

		wp_send_json_success();
	}
}
