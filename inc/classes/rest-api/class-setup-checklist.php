<?php
/**
 * REST endpoint behind the "Get your first video live" checklist.
 *
 * The GoDAM Dashboard shows the checklist instead of zeroed metrics while the
 * analytics service has no data for the site (see Analytics::fetch_dashboard_metrics()
 * and its `no_data` flag). This route says which of the five steps are done,
 * from what is on this site: the API key, Media Library videos with and without
 * a GoDAM copy, the Vimeo migration status, and published GoDAM Video blocks.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use WP_REST_Server;
use WP_REST_Response;

/**
 * Class Setup_Checklist.
 *
 * @since n.e.x.t
 */
class Setup_Checklist extends Base {

	/**
	 * REST route base.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	protected $rest_base = 'dashboard';

	/**
	 * Transient that holds the site facts for a minute, so a reload does not
	 * repeat the post-content scan.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const CACHE_KEY = 'rtgodam_setup_checklist_facts';

	/**
	 * How long the facts are cached.
	 *
	 * @since n.e.x.t
	 *
	 * @var int
	 */
	const CACHE_TTL = MINUTE_IN_SECONDS;

	/**
	 * Register the checklist route.
	 *
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/setup-checklist',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_checklist' ),
					'permission_callback' => array( $this, 'check_permission' ),
				),
			),
		);
	}

	/**
	 * Anyone who can open the GoDAM Dashboard (editors and above) can read it.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public function check_permission() {
		return current_user_can( 'edit_pages' );
	}

	/**
	 * Return the checklist for this site.
	 *
	 * @since n.e.x.t
	 *
	 * @return WP_REST_Response
	 */
	public function get_checklist() {
		$facts = get_transient( self::CACHE_KEY );

		if ( ! is_array( $facts ) ) {
			$facts = $this->collect_facts();
			set_transient( self::CACHE_KEY, $facts, self::CACHE_TTL );
		}

		return new WP_REST_Response( self::build_checklist( $facts ), 200 );
	}

	/**
	 * Turn site facts into the five steps, in the order the checklist shows them.
	 *
	 * Moving existing videos is done when none are left to move, which includes a
	 * site that never had any.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $facts {
	 *     Site facts, from collect_facts().
	 *
	 *     @type bool $connected      The API key is verified.
	 *     @type int  $videos_to_move Media Library videos with no GoDAM copy.
	 *     @type bool $vimeo_migrated The Vimeo migration has completed.
	 *     @type bool $video_on_godam At least one video has a GoDAM copy.
	 *     @type bool $block_used     A published post contains the GoDAM Video block.
	 * }
	 * @return array With 'steps' (id, done, and count for 'move_videos'), 'done' and 'total'.
	 */
	public static function build_checklist( array $facts ) {
		$videos_to_move = max( 0, (int) ( $facts['videos_to_move'] ?? 0 ) );

		$steps = array(
			array(
				'id'   => 'connect_site',
				'done' => ! empty( $facts['connected'] ),
			),
			array(
				'id'    => 'move_videos',
				'done'  => 0 === $videos_to_move,
				'count' => $videos_to_move,
			),
			array(
				'id'   => 'vimeo',
				'done' => ! empty( $facts['vimeo_migrated'] ),
			),
			array(
				'id'   => 'upload_video',
				'done' => ! empty( $facts['video_on_godam'] ),
			),
			array(
				'id'   => 'add_block',
				'done' => ! empty( $facts['block_used'] ),
			),
		);

		return array(
			'steps' => $steps,
			'done'  => count( array_filter( array_column( $steps, 'done' ) ) ),
			'total' => count( $steps ),
		);
	}

	/**
	 * Read the facts the steps depend on from this site.
	 *
	 * @since n.e.x.t
	 *
	 * @return array See build_checklist().
	 */
	private function collect_facts() {
		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$vimeo_status  = get_option( 'godam_vimeo_video_migration_status', array() );

		return array(
			'connected'      => ! empty( get_option( 'rtgodam-api-key', '' ) ) && ! empty( $account_token ) && 'unverified' !== $account_token,
			'videos_to_move' => $this->count_videos( 'NOT EXISTS' ),
			'vimeo_migrated' => is_array( $vimeo_status ) && 'completed' === ( $vimeo_status['status'] ?? '' ),
			'video_on_godam' => $this->count_videos( 'EXISTS' ) > 0,
			'block_used'     => $this->is_video_block_published(),
		);
	}

	/**
	 * Count Media Library videos with or without a GoDAM copy, using the same
	 * rule as Tools > Retranscode Media (`rtgodam_transcoded_url`).
	 *
	 * @since n.e.x.t
	 *
	 * @param string $compare 'EXISTS' for videos on GoDAM, 'NOT EXISTS' for the rest.
	 * @return int
	 */
	private function count_videos( $compare ) {
		/** This action is documented in inc/classes/rest-api/class-transcoding.php */
		do_action( 'rtgodam_before_attachment_lookup' );

		$query = new \WP_Query(
			array(
				'post_type'              => 'attachment',
				'post_mime_type'         => 'video',
				'post_status'            => 'any',
				'posts_per_page'         => 1,
				'fields'                 => 'ids',
				'update_post_meta_cache' => false,
				'update_post_term_cache' => false,
				'meta_query'             => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- Same lookup as the Retranscode Media tool; counted once a minute at most.
					array(
						'key'     => 'rtgodam_transcoded_url',
						'compare' => $compare,
					),
				),
			)
		);

		/** This action is documented in inc/classes/rest-api/class-transcoding.php */
		do_action( 'rtgodam_after_attachment_lookup' );

		return (int) $query->found_posts;
	}

	/**
	 * Whether any published post, page or lesson contains the GoDAM Video block.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	private function is_video_block_published() {
		global $wpdb;

		// One row is enough; a LIKE scan has no index, so it stops at the first match.
		$found = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, godam-coverage-ignore -- Post content, not attachment data; cached by get_checklist().
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts} WHERE post_status = 'publish' AND post_type NOT IN ( 'revision', 'attachment' ) AND post_content LIKE %s LIMIT 1",
				'%' . $wpdb->esc_like( '<!-- wp:godam/video ' ) . '%'
			)
		);

		return ! empty( $found );
	}
}
