<?php
/**
 * GoDAM widget on the WordPress Dashboard.
 *
 * Shows the value GoDAM adds as big-number tiles in three sections: Watching
 * (from GoDAM analytics), Your library (from WordPress, so it works without an
 * API key) and Ready to stream and preview. A tile appears once its number is
 * worth showing and then stays, so the widget only ever grows. Local numbers
 * render here; the Watching numbers load after the page renders, from
 * `godam/v1/dashboard-widget/summary`, so a slow analytics service never holds
 * up the Dashboard.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\Enums\Api_Key_Status;
use RTGODAM\Inc\Taxonomies\Media_Folders;

/**
 * Class Dashboard_Widget.
 */
class Dashboard_Widget {

	use Singleton;

	/**
	 * Dashboard widget ID.
	 *
	 * Never rename it: WordPress stores each user's Dashboard layout and hidden
	 * widgets by this ID, so a new ID would reset them.
	 *
	 * @var string
	 */
	const WIDGET_ID = 'rtgodam_dashboard_widget';

	/**
	 * Option that records the site's answer to the review ask.
	 *
	 * @var string
	 */
	const REVIEW_OPTION = 'rtgodam_dashboard_widget_review_ask';

	/**
	 * How long "Not now" holds the review ask back.
	 *
	 * @var int
	 */
	const REVIEW_SNOOZE = 30 * DAY_IN_SECONDS;

	/**
	 * Where "Leave a review" goes: the review form on GoDAM's wordpress.org page.
	 *
	 * @var string
	 */
	const REVIEW_URL = 'https://wordpress.org/support/plugin/godam/reviews/#new-post';

	/**
	 * Option that lists the tiles this site has shown, so they never disappear.
	 *
	 * @var string
	 */
	const SEEN_OPTION = 'rtgodam_dashboard_widget_seen';

	/**
	 * Script and style handle.
	 *
	 * @var string
	 */
	const HANDLE = 'rtgodam-dashboard-widget';

	/**
	 * The arrow that marks a link or a clickable tile. Screen readers skip it,
	 * and the stylesheet mirrors it in right-to-left languages.
	 *
	 * @var string
	 */
	const ARROW = '<span class="rtgodam-dw__arrow" aria-hidden="true">&rarr;</span>';

	/**
	 * Transient that holds the processing status counts.
	 *
	 * @var string
	 */
	const COUNTS_TRANSIENT = 'rtgodam_dashboard_widget_counts';

	/**
	 * Transient that holds the Media Library counts.
	 *
	 * @var string
	 */
	const LIBRARY_TRANSIENT = 'rtgodam_dashboard_widget_library';

	/**
	 * Transient that holds the combined length of the library's videos.
	 *
	 * @var string
	 */
	const VIDEO_LENGTH_TRANSIENT = 'rtgodam_dashboard_widget_video_seconds';

	/**
	 * Share of a storage or bandwidth quota at which usage is worth flagging.
	 *
	 * @var float
	 */
	const USAGE_WARNING_RATIO = 0.8;

	/**
	 * Every tile and chart, in display order, with the value at which it first
	 * appears. Once shown, a tile stays (see visible_tiles()).
	 *
	 * @var array
	 */
	const FLOORS = array(
		// Watching, from GoDAM analytics.
		'watch_seconds'   => 3600,
		'plays'           => 25,
		'viewers'         => 25,
		'countries'       => 3,
		'times_shown'     => 100,
		'chart_plays'     => 7,
		'top_videos'      => 1,
		// Your library, from WordPress. Works without an API key.
		'library_files'   => 10,
		'folder_files'    => 10,
		'folders'         => 3,
		'files_in_use'    => 10,
		'video_seconds'   => 3600,
		'chart_library'   => 2,
		// Ready to stream and preview.
		'videos_ready'    => 1,
		'audio_ready'     => 1,
		'documents_ready' => 1,
		'captions'        => 1,
	);

	/**
	 * Tiles in the Watching section, which the script fills in from the summary endpoint.
	 *
	 * @var string[]
	 */
	const WATCHING_TILES = array( 'watch_seconds', 'plays', 'viewers', 'countries', 'times_shown' );

	/**
	 * Everything the script fills in from the summary endpoint: the Watching
	 * tiles, the plays chart and the top videos list.
	 *
	 * @var string[]
	 */
	const REMOTE_TILES = array( 'watch_seconds', 'plays', 'viewers', 'countries', 'times_shown', 'chart_plays', 'top_videos' );

	/**
	 * Tiles in the Your library section.
	 *
	 * @var string[]
	 */
	const LIBRARY_TILES = array( 'library_files', 'folder_files', 'folders', 'files_in_use', 'video_seconds' );

	/**
	 * Tiles in the Ready to stream and preview section.
	 *
	 * @var string[]
	 */
	const READY_TILES = array( 'videos_ready', 'audio_ready', 'documents_ready', 'captions' );

	/**
	 * Where each clickable tile goes: the GoDAM Dashboard (plays, viewers, the
	 * country map, watch time), the Media Library, or the Media Library filtered
	 * to one type. Files in use and videos with captions have no screen that
	 * lists them, so they are not links.
	 *
	 * @var array
	 */
	const TILE_LINKS = array(
		'watch_seconds'   => 'godam',
		'plays'           => 'godam',
		'viewers'         => 'godam',
		'countries'       => 'godam',
		'times_shown'     => 'godam',
		'library_files'   => 'library',
		'folder_files'    => 'library',
		'folders'         => 'library',
		'video_seconds'   => 'video',
		'videos_ready'    => 'video',
		'audio_ready'     => 'audio',
		'documents_ready' => 'document',
	);

	/**
	 * The model built for this request, so registering and rendering share it.
	 *
	 * @var array|null
	 */
	private $model = null;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( 'wp_dashboard_setup', array( $this, 'register_widget' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );

		// Recount when any attachment's processing status, or a video's length, changes.
		add_action( 'added_post_meta', array( $this, 'flush_counts_on_status_change' ), 10, 3 );
		add_action( 'updated_post_meta', array( $this, 'flush_counts_on_status_change' ), 10, 3 );
		add_action( 'deleted_post_meta', array( $this, 'flush_counts_on_status_change' ), 10, 3 );

		// Recount the library when files come, go or move between folders.
		add_action( 'add_attachment', array( $this, 'flush_library_counts' ) );
		add_action( 'delete_attachment', array( $this, 'flush_library_counts' ) );
		add_action( 'set_object_terms', array( $this, 'flush_library_counts_on_folder_change' ), 10, 4 );
	}

	/**
	 * Register the widget for users who can see GoDAM (authors and above).
	 *
	 * @return void
	 */
	public function register_widget() {
		if ( ! current_user_can( 'upload_files' ) ) {
			return;
		}

		$model = $this->get_model();

		// Without a key and without library tiles, only an admin can act on the connect prompt.
		if ( 'not_connected' === $model['state'] && empty( $model['show'] ) && ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Top of the first column, like WooCommerce's status widget. A user's own arrangement still wins.
		wp_add_dashboard_widget( self::WIDGET_ID, esc_html__( 'GoDAM', 'godam' ), array( $this, 'render' ), null, null, 'normal', 'high' );
	}

	/**
	 * Enqueue the widget's script and styles on the Dashboard only.
	 *
	 * @param string $hook_suffix The current admin page.
	 * @return void
	 */
	public function enqueue_assets( $hook_suffix ) {
		if ( 'index.php' !== $hook_suffix || ! current_user_can( 'upload_files' ) ) {
			return;
		}

		// A widget the user hid in Screen Options loads nothing, and fetches nothing.
		if ( $this->is_hidden_by_user() ) {
			return;
		}

		$model      = $this->get_model();
		$asset_path = RTGODAM_PATH . 'assets/build/js/dashboard-widget.min.asset.php';
		$asset      = file_exists( $asset_path )
			// phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable -- file path is a plugin constant + hardcoded build filename.
			? include $asset_path
			: array(
				'dependencies' => array( 'wp-api-fetch', 'wp-i18n' ),
				'version'      => RTGODAM_VERSION,
			);

		wp_enqueue_script(
			self::HANDLE,
			RTGODAM_URL . 'assets/build/js/dashboard-widget.min.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);
		wp_set_script_translations( self::HANDLE, 'godam', RTGODAM_PATH . 'languages' );
		wp_localize_script(
			self::HANDLE,
			'godamDashboardWidget',
			array(
				'path'       => '/godam/v1/dashboard-widget/summary',
				'preview'    => Dashboard_Widget_Preview::get_requested(),
				'reviewAsk'  => ! empty( $model['review_ask'] ),
				'reviewPath' => '/godam/v1/dashboard-widget/review-ask',
			)
		);

		$style_path = RTGODAM_PATH . 'assets/build/css/dashboard-widget.css';
		if ( file_exists( $style_path ) ) {
			wp_enqueue_style( self::HANDLE, RTGODAM_URL . 'assets/build/css/dashboard-widget.css', array(), filemtime( $style_path ) );
		}
	}

	/**
	 * Clear cached numbers when the meta behind them changes: the processing
	 * counts on a status change, and the video length when a video's metadata
	 * (which holds its length) is written or removed.
	 *
	 * @param int|int[] $meta_id   Meta ID or IDs.
	 * @param int       $object_id Post ID.
	 * @param string    $meta_key  Meta key.
	 * @return void
	 */
	public function flush_counts_on_status_change( $meta_id, $object_id, $meta_key ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundBeforeLastUsed -- hook signature.
		if ( 'rtgodam_transcoding_status' === $meta_key ) {
			delete_transient( self::COUNTS_TRANSIENT );
		} elseif ( '_wp_attachment_metadata' === $meta_key && 'videos' === self::mime_family( get_post_mime_type( $object_id ) ) ) { // godam-coverage-ignore -- flush_counts_on_status_change(): a post-meta hook fires on the site that wrote the meta, so this type check reads the same site; it only decides whether to clear a cache.
			delete_transient( self::VIDEO_LENGTH_TRANSIENT );
		}
	}

	/**
	 * Clear the cached library counts.
	 *
	 * @return void
	 */
	public function flush_library_counts() {
		delete_transient( self::LIBRARY_TRANSIENT );
	}

	/**
	 * Clear the cached library counts when a file moves between folders.
	 *
	 * @param int    $object_id Object ID.
	 * @param array  $terms     Terms.
	 * @param array  $tt_ids    Term taxonomy IDs.
	 * @param string $taxonomy  Taxonomy.
	 * @return void
	 */
	public function flush_library_counts_on_folder_change( $object_id, $terms, $tt_ids, $taxonomy ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundBeforeLastUsed -- hook signature.
		if ( Media_Folders::SLUG === $taxonomy ) {
			$this->flush_library_counts();
		}
	}

	/**
	 * Whether the current user hid the widget in the Dashboard's Screen Options.
	 *
	 * @return bool
	 */
	private function is_hidden_by_user() {
		if ( ! function_exists( 'get_hidden_meta_boxes' ) ) {
			return false;
		}

		return in_array( self::WIDGET_ID, (array) get_hidden_meta_boxes( 'dashboard' ), true );
	}

	/**
	 * The widget model for this request: sample data in preview, real data otherwise.
	 *
	 * @return array
	 */
	public function get_model() {
		if ( null === $this->model ) {
			$preview     = Dashboard_Widget_Preview::get_requested();
			$this->model = $preview ? Dashboard_Widget_Preview::local_model( $preview ) : $this->build_model();
		}

		return $this->model;
	}

	/**
	 * Build the model from this site's own data.
	 *
	 * @return array
	 */
	private function build_model() {
		$api_key_status = rtgodam_get_api_key_status();
		$can_manage     = current_user_can( 'manage_options' );
		$counts         = $this->get_transcode_counts();
		$library        = $this->get_library_counts();
		$usage          = array();

		if ( Api_Key_Status::NO_API_KEY !== $api_key_status && $can_manage ) {
			$user_data = rtgodam_get_user_data();

			foreach ( array( 'storage_used', 'total_storage', 'bandwidth_used', 'total_bandwidth' ) as $key ) {
				if ( isset( $user_data[ $key ] ) ) {
					$usage[ $key ] = (float) $user_data[ $key ];
				}
			}

			// The cached user data can carry a temporary verification_failed status.
			if ( ! empty( $user_data['api_key_status'] ) ) {
				$api_key_status = $user_data['api_key_status'];
			}
		}

		$values = self::local_values( $library, $counts, $this->get_video_seconds() );
		$seen   = $this->get_seen();
		$tiles  = self::visible_tiles( $values, $seen );

		if ( $tiles['seen'] !== $seen ) {
			update_option( self::SEEN_OPTION, $tiles['seen'], false );
		}

		$attention = self::build_attention_items( $api_key_status, $counts, $usage, $can_manage );

		return array(
			'state'          => self::determine_state( $api_key_status, $counts['transcoded'] ),
			'api_key_status' => $api_key_status,
			'can_manage'     => $can_manage,
			'counts'         => $counts,
			'usage'          => $usage,
			'attention'      => $attention,
			'review_ask'     => self::review_ask_eligible( get_option( self::REVIEW_OPTION, array() ), time(), $can_manage, $attention ),
			'values'         => $values,
			'types'          => $library['types'],
			'show'           => $tiles['show'],
			'remote_seen'    => array_values( array_intersect( self::REMOTE_TILES, $tiles['seen'] ) ),
			'connect'        => self::pick_connect_prompt( $library['types'] ),
		);
	}

	/**
	 * The tiles this site has shown before.
	 *
	 * @return string[]
	 */
	private function get_seen() {
		$seen = get_option( self::SEEN_OPTION, array() );

		return is_array( $seen ) ? array_values( array_filter( $seen, 'is_string' ) ) : array();
	}

	/**
	 * Count attachments by processing status and file type, cached until a status changes.
	 *
	 * @return array From summarize_status_rows().
	 */
	private function get_transcode_counts() {
		$counts = get_transient( self::COUNTS_TRANSIENT );
		if ( is_array( $counts ) && isset( $counts['videos_ready'] ) ) {
			return $counts;
		}

		global $wpdb;

		/**
		 * Fires before counting attachments by processing status, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

		// One grouped count across all attachments. No WordPress API returns grouped meta counts.
		$rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- cached in a transient below, cleared on status changes.
			$wpdb->prepare(
				"SELECT p.post_mime_type AS mime, LOWER( pm.meta_value ) AS status, COUNT( * ) AS total
				FROM {$wpdb->postmeta} pm
				INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				WHERE pm.meta_key = %s AND p.post_type = 'attachment' AND p.post_status <> 'trash'
				GROUP BY p.post_mime_type, LOWER( pm.meta_value )",
				'rtgodam_transcoding_status'
			),
			ARRAY_A
		);

		do_action( 'rtgodam_after_attachment_lookup' );

		$counts = self::summarize_status_rows( is_array( $rows ) ? $rows : array() );
		set_transient( self::COUNTS_TRANSIENT, $counts, 15 * MINUTE_IN_SECONDS );

		return $counts;
	}

	/**
	 * Count the Media Library by type, folder and use. Needs no API key.
	 *
	 * @return array With 'types' (from group_mime_counts()), 'folder_files', 'folders',
	 *               'files_in_use' (null until the usage scan has finished) and 'captions'.
	 */
	private function get_library_counts() {
		$cached = get_transient( self::LIBRARY_TRANSIENT );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		global $wpdb;

		$by_mime = array();
		foreach ( (array) wp_count_attachments() as $mime => $count ) {
			if ( 'trash' !== $mime ) {
				$by_mime[ $mime ] = (int) $count;
			}
		}

		$counts = array(
			'types'        => self::group_mime_counts( $by_mime ),
			'folder_files' => 0,
			'folders'      => 0,
			'files_in_use' => null,
			'captions'     => 0,
		);

		/**
		 * Fires before counting the Media Library's folders, usage and
		 * captions, so integrations that centralize media on another site can
		 * switch context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

		if ( function_exists( 'rtgodam_is_media_library_ui_enabled' ) && rtgodam_is_media_library_ui_enabled() ) {
			$folders           = wp_count_terms(
				array(
					'taxonomy'   => Media_Folders::SLUG,
					'hide_empty' => false,
				)
			);
			$counts['folders'] = is_wp_error( $folders ) ? 0 : (int) $folders;

			$counts['folder_files'] = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- cached in a transient below.
				$wpdb->prepare(
					"SELECT COUNT( DISTINCT tr.object_id )
					FROM {$wpdb->term_relationships} tr
					INNER JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
					INNER JOIN {$wpdb->posts} p ON p.ID = tr.object_id
					WHERE tt.taxonomy = %s AND p.post_type = 'attachment' AND p.post_status <> 'trash'",
					Media_Folders::SLUG
				)
			);
		}

		// Usage is only complete once the one-off scan of existing posts has finished.
		if ( Media_Usage_Backfill::STATUS_COMPLETED === get_option( Media_Usage_Backfill::OPT_STATUS ) ) {
			$counts['files_in_use'] = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- cached in a transient below.
				$wpdb->prepare(
					"SELECT COUNT( DISTINCT pm.post_id )
					FROM {$wpdb->postmeta} pm
					INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
					WHERE pm.meta_key = %s AND pm.meta_value <> '' AND p.post_type = 'attachment' AND p.post_status <> 'trash'",
					'_godam_usage_post_ids'
				)
			);
		}

		$counts['captions'] = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- cached in a transient below.
			$wpdb->prepare(
				"SELECT COUNT( DISTINCT pm.post_id )
				FROM {$wpdb->postmeta} pm
				INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				LEFT JOIN {$wpdb->postmeta} gone ON gone.post_id = pm.post_id AND gone.meta_key = %s
				WHERE pm.meta_key = %s AND pm.meta_value <> '' AND p.post_type = 'attachment'
				AND p.post_status <> 'trash' AND p.post_mime_type LIKE %s
				AND ( gone.meta_value IS NULL OR gone.meta_value IN ( '', '0' ) )",
				'rtgodam_transcript_deleted',
				'rtgodam_transcript_path',
				'video/%'
			)
		);

		do_action( 'rtgodam_after_attachment_lookup' );

		set_transient( self::LIBRARY_TRANSIENT, $counts, 15 * MINUTE_IN_SECONDS );

		return $counts;
	}

	/**
	 * The combined length of the library's videos, in seconds, refreshed twice a day.
	 *
	 * WordPress stores each video's length in its attachment metadata when the
	 * file is uploaded, so this reads what is already there.
	 *
	 * @return float
	 */
	private function get_video_seconds() {
		$cached = get_transient( self::VIDEO_LENGTH_TRANSIENT );
		if ( false !== $cached ) {
			return (float) $cached;
		}

		global $wpdb;

		/**
		 * Fires before reading video lengths from attachment metadata, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

		$metadata = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- cached in a transient below for 12 hours.
			$wpdb->prepare(
				"SELECT pm.meta_value
				FROM {$wpdb->postmeta} pm
				INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				WHERE pm.meta_key = %s AND p.post_type = 'attachment' AND p.post_status <> 'trash' AND p.post_mime_type LIKE %s",
				'_wp_attachment_metadata',
				'video/%'
			)
		);

		do_action( 'rtgodam_after_attachment_lookup' );

		$seconds = 0.0;
		foreach ( (array) $metadata as $raw ) {
			$meta = maybe_unserialize( $raw );
			if ( is_array( $meta ) && ! empty( $meta['length'] ) ) {
				$seconds += max( 0, (float) $meta['length'] );
			}
		}

		set_transient( self::VIDEO_LENGTH_TRANSIENT, $seconds, 12 * HOUR_IN_SECONDS );

		return $seconds;
	}

	/**
	 * The numbers behind the local tiles and the library chart.
	 *
	 * @param array $library       From get_library_counts().
	 * @param array $counts        From summarize_status_rows().
	 * @param float $video_seconds Combined length of the library's videos.
	 * @return array Values keyed by tile ID. 'files_in_use' is left out until the usage scan finishes.
	 */
	public static function local_values( array $library, array $counts, $video_seconds ) {
		$types = $library['types'] ?? array();
		$kinds = array_intersect_key( $types, array_flip( array( 'images', 'videos', 'audio', 'documents', 'other' ) ) );

		$values = array(
			'library_files'   => (int) array_sum( $kinds ),
			'folder_files'    => (int) ( $library['folder_files'] ?? 0 ),
			'folders'         => (int) ( $library['folders'] ?? 0 ),
			'video_seconds'   => (float) $video_seconds,
			'chart_library'   => count( array_filter( $kinds ) ),
			'videos_ready'    => (int) ( $counts['videos_ready'] ?? 0 ),
			'audio_ready'     => (int) ( $counts['audio_ready'] ?? 0 ),
			'documents_ready' => (int) ( $counts['documents_ready'] ?? 0 ),
			'captions'        => (int) ( $library['captions'] ?? 0 ),
		);

		if ( isset( $library['files_in_use'] ) ) {
			$values['files_in_use'] = (int) $library['files_in_use'];
		}

		return $values;
	}

	/**
	 * The numbers behind the Watching tiles, the plays chart and the top videos list.
	 *
	 * @param array $summary From Dashboard_Widget_Summary::shape_summary().
	 * @return array Values keyed by tile ID. The chart's value is its days with plays.
	 */
	public static function remote_values( array $summary ) {
		$receipts    = $summary['receipts'] ?? array();
		$active_days = 0;
		foreach ( (array) ( $summary['history'] ?? array() ) as $day ) {
			if ( ! empty( $day['plays'] ) ) {
				++$active_days;
			}
		}

		return array(
			'watch_seconds' => (float) ( $receipts['watch_seconds'] ?? 0 ),
			'plays'         => (int) ( $receipts['plays'] ?? 0 ),
			'viewers'       => (int) ( $receipts['unique_viewers'] ?? 0 ),
			'countries'     => (int) ( $receipts['countries'] ?? 0 ),
			'times_shown'   => (int) ( $receipts['times_shown'] ?? 0 ),
			'chart_plays'   => $active_days,
			'top_videos'    => count( (array) ( $summary['top_videos'] ?? array() ) ),
		);
	}

	/**
	 * Which tiles to show: every tile that clears its floor now, plus every tile
	 * this site has shown before, so the widget only ever grows.
	 *
	 * Tiles missing from $values (for example the Watching tiles during the
	 * server render) are skipped but stay remembered.
	 *
	 * @param array    $values Values keyed by tile ID.
	 * @param string[] $seen   Tiles shown before.
	 * @return array With 'show' (tile IDs in display order) and 'seen' (the updated list).
	 */
	public static function visible_tiles( array $values, array $seen ) {
		$show = array();
		foreach ( self::FLOORS as $id => $floor ) {
			if ( ! array_key_exists( $id, $values ) ) {
				continue;
			}

			if ( in_array( $id, $seen, true ) || $values[ $id ] >= $floor ) {
				$show[] = $id;
			}
		}

		return array(
			'show' => $show,
			'seen' => array_values( array_unique( array_merge( $seen, $show ) ) ),
		);
	}

	/**
	 * The family a MIME type belongs to in the library chart.
	 *
	 * @param string $mime MIME type.
	 * @return string 'images', 'videos', 'audio', 'documents' or 'other'.
	 */
	public static function mime_family( $mime ) {
		$mime = strtolower( (string) $mime );

		if ( 0 === strpos( $mime, 'image/' ) ) {
			return 'images';
		}

		if ( 0 === strpos( $mime, 'video/' ) || 'application/ogg' === $mime ) {
			return 'videos';
		}

		if ( 0 === strpos( $mime, 'audio/' ) ) {
			return 'audio';
		}

		if ( 'application/pdf' === $mime || 'text/csv' === $mime || array_key_exists( $mime, rtgodam_get_supported_document_types() ) ) {
			return 'documents';
		}

		return 'other';
	}

	/**
	 * Whether a MIME type is a Word, Excel or PowerPoint file (or the OpenDocument
	 * equivalent), which GoDAM converts into a preview visitors can read on the page.
	 *
	 * @param string $mime MIME type.
	 * @return bool
	 */
	public static function is_office_mime( $mime ) {
		$mime = strtolower( (string) $mime );

		return 'documents' === self::mime_family( $mime )
			&& ! in_array( $mime, array( 'application/pdf', 'text/plain', 'text/csv', 'application/csv' ), true );
	}

	/**
	 * Fold Media Library counts by MIME type into the chart's families.
	 *
	 * @param array $by_mime Counts keyed by MIME type.
	 * @return array Counts for images, videos, audio, documents and other, plus
	 *               'office' (the part of documents GoDAM converts into previews).
	 */
	public static function group_mime_counts( array $by_mime ) {
		$types = array(
			'images'    => 0,
			'videos'    => 0,
			'audio'     => 0,
			'documents' => 0,
			'other'     => 0,
			'office'    => 0,
		);

		foreach ( $by_mime as $mime => $count ) {
			$count = max( 0, (int) $count );

			$types[ self::mime_family( $mime ) ] += $count;

			if ( self::is_office_mime( $mime ) ) {
				$types['office'] += $count;
			}
		}

		return $types;
	}

	/**
	 * Pick the one connect prompt, from the file type the library has most of.
	 *
	 * Videos, office documents and audio are the types GoDAM does most for;
	 * ties go to video. A library of only images or PDFs gets the library line.
	 *
	 * @param array $types From group_mime_counts().
	 * @return array With 'type' ('videos', 'office', 'audio' or 'library') and 'count'.
	 */
	public static function pick_connect_prompt( array $types ) {
		$pick = array(
			'type'  => 'library',
			'count' => 0,
		);

		foreach ( array( 'videos', 'office', 'audio' ) as $type ) {
			$count = (int) ( $types[ $type ] ?? 0 );
			if ( $count > $pick['count'] ) {
				$pick = array(
					'type'  => $type,
					'count' => $count,
				);
			}
		}

		return $pick;
	}

	/**
	 * Decide which state the widget is in.
	 *
	 * @param string $api_key_status One of the Api_Key_Status values.
	 * @param int    $processed      Attachments GoDAM finished processing.
	 * @return string 'not_connected', 'setting_up' or 'active'.
	 */
	public static function determine_state( $api_key_status, $processed ) {
		if ( Api_Key_Status::NO_API_KEY === $api_key_status ) {
			return 'not_connected';
		}

		return $processed > 0 ? 'active' : 'setting_up';
	}

	/**
	 * Fold raw status rows into the counts the widget shows.
	 *
	 * The plugin writes both `Transcoded` and `transcoded`, and Central writes its
	 * own progress values, so statuses are matched case-insensitively. Finished
	 * files are split by type, because GoDAM processes audio and documents too.
	 *
	 * @param array $rows Rows of array( 'mime' => string, 'status' => string, 'total' => int ).
	 * @return array Counts: videos_ready, audio_ready, documents_ready, transcoded (all three),
	 *               failed, processing and total (every status).
	 */
	public static function summarize_status_rows( array $rows ) {
		$counts = array(
			'videos_ready'    => 0,
			'audio_ready'     => 0,
			'documents_ready' => 0,
			'transcoded'      => 0,
			'failed'          => 0,
			'processing'      => 0,
			'total'           => 0,
		);
		$groups = array(
			'failed'      => 'failed',
			'blocked'     => 'failed',
			'queued'      => 'processing',
			'downloading' => 'processing',
			'downloaded'  => 'processing',
			'transcoding' => 'processing',
		);
		$ready  = array(
			'videos'    => 'videos_ready',
			'audio'     => 'audio_ready',
			'documents' => 'documents_ready',
		);

		foreach ( $rows as $row ) {
			$status = strtolower( trim( (string) ( $row['status'] ?? '' ) ) );
			$total  = (int) ( $row['total'] ?? 0 );

			$counts['total'] += $total;

			if ( 'transcoded' === $status ) {
				$family = self::mime_family( $row['mime'] ?? '' );
				if ( isset( $ready[ $family ] ) ) {
					$counts[ $ready[ $family ] ] += $total;
					$counts['transcoded']        += $total;
				}
			} elseif ( isset( $groups[ $status ] ) ) {
				$counts[ $groups[ $status ] ] += $total;
			}
		}

		return $counts;
	}

	/**
	 * Work out what needs the user's attention.
	 *
	 * Returns data, not copy, so the rules stay testable; get_attention_copy()
	 * turns each item into a sentence. Account items (key, storage, bandwidth)
	 * are for admins only. Errors come first.
	 *
	 * @param string $api_key_status One of the Api_Key_Status values.
	 * @param array  $counts         From summarize_status_rows().
	 * @param array  $usage          storage_used, total_storage, bandwidth_used and total_bandwidth, in GB.
	 * @param bool   $can_manage     Whether the user manages the site.
	 * @return array[] Items with 'id', 'tone' ('error' or 'warning') and, where relevant, 'percent' or 'count'.
	 */
	public static function build_attention_items( $api_key_status, array $counts, array $usage, $can_manage ) {
		$items = array();

		if ( $can_manage && Api_Key_Status::EXPIRED === $api_key_status ) {
			$items[] = array(
				'id'   => 'key_expired',
				'tone' => 'error',
			);
		} elseif ( $can_manage && Api_Key_Status::VERIFICATION_FAILED === $api_key_status ) {
			$items[] = array(
				'id'   => 'key_unverified',
				'tone' => 'warning',
			);
		}

		if ( $can_manage ) {
			foreach ( array( 'storage', 'bandwidth' ) as $meter ) {
				$used  = (float) ( $usage[ $meter . '_used' ] ?? 0 );
				$total = (float) ( $usage[ 'total_' . $meter ] ?? 0 );

				if ( $total <= 0 ) {
					continue;
				}

				// Matches the plugin's own rule: over the limit means used > total.
				$ratio = $used / $total;
				if ( $ratio > 1 ) {
					$items[] = array(
						'id'      => $meter . '_over',
						'tone'    => 'error',
						'percent' => round( $ratio * 100, 1 ),
					);
				} elseif ( $ratio >= self::USAGE_WARNING_RATIO ) {
					$items[] = array(
						'id'      => $meter . '_high',
						'tone'    => 'warning',
						'percent' => round( $ratio * 100, 1 ),
					);
				}
			}
		}

		if ( ! empty( $counts['failed'] ) ) {
			$items[] = array(
				'id'    => 'transcode_failed',
				'tone'  => 'error',
				'count' => (int) $counts['failed'],
			);
		}

		$errors   = array_values(
			array_filter(
				$items,
				function ( $item ) {
					return 'error' === $item['tone'];
				}
			)
		);
		$warnings = array_values(
			array_filter(
				$items,
				function ( $item ) {
					return 'error' !== $item['tone'];
				}
			)
		);

		return array_merge( $errors, $warnings );
	}

	/**
	 * Whether this user may be shown the review ask.
	 *
	 * Admins only, never while something needs fixing, never again after a
	 * review or "No thanks", and not until "Not now" has run its course. The
	 * script adds the last condition: the site has passed a plays milestone.
	 *
	 * @param mixed   $record     The stored REVIEW_OPTION value.
	 * @param int     $now        Current Unix time.
	 * @param bool    $can_manage Whether the user manages the site.
	 * @param array[] $attention  From build_attention_items().
	 * @return bool
	 */
	public static function review_ask_eligible( $record, $now, $can_manage, array $attention ) {
		if ( ! $can_manage ) {
			return false;
		}

		foreach ( $attention as $item ) {
			if ( 'error' === ( $item['tone'] ?? '' ) ) {
				return false;
			}
		}

		$record = is_array( $record ) ? $record : array();
		$status = $record['status'] ?? '';

		if ( in_array( $status, array( 'reviewed', 'never' ), true ) ) {
			return false;
		}

		return ! ( 'later' === $status && (int) ( $record['until'] ?? 0 ) > $now );
	}

	/**
	 * The record to store for an answer to the review ask.
	 *
	 * @param string $choice 'review', 'later' or 'never'. Anything else counts as 'later'.
	 * @param int    $now    Current Unix time.
	 * @return array
	 */
	public static function review_choice_record( $choice, $now ) {
		if ( 'review' === $choice ) {
			return array(
				'status' => 'reviewed',
				'at'     => (int) $now,
			);
		}

		if ( 'never' === $choice ) {
			return array(
				'status' => 'never',
				'at'     => (int) $now,
			);
		}

		return array(
			'status' => 'later',
			'at'     => (int) $now,
			'until'  => (int) $now + self::REVIEW_SNOOZE,
		);
	}

	/**
	 * Turn an attention item into a sentence and an optional action.
	 *
	 * @param array $item From build_attention_items().
	 * @return array With 'message' and, when there is one, 'action_label' and 'action_url'.
	 */
	private function get_attention_copy( array $item ) {
		$percent = isset( $item['percent'] ) ? number_format_i18n( $item['percent'], 0 ) : '';
		$godam   = admin_url( 'admin.php?page=rtgodam' );

		switch ( $item['id'] ) {
			case 'key_expired':
				return array(
					'message'      => __( 'Your GoDAM API key has expired.', 'godam' ),
					'action_label' => __( 'Update key', 'godam' ),
					'action_url'   => admin_url( 'admin.php?page=rtgodam_settings' ),
				);
			case 'key_unverified':
				return array(
					'message' => __( 'GoDAM could not verify your API key just now. It will try again automatically.', 'godam' ),
				);
			case 'storage_over':
				return array(
					/* translators: %s: storage used, as a percentage of the plan. */
					'message'      => sprintf( __( 'Storage is full (%s%%). New uploads are not being transcoded.', 'godam' ), $percent ),
					'action_label' => __( 'View plan', 'godam' ),
					'action_url'   => $godam,
				);
			case 'storage_high':
				return array(
					/* translators: %s: storage used, as a percentage of the plan. */
					'message'      => sprintf( __( 'Storage is %s%% full. At 100%%, new uploads stop transcoding.', 'godam' ), $percent ),
					'action_label' => __( 'View plan', 'godam' ),
					'action_url'   => $godam,
				);
			case 'bandwidth_over':
				return array(
					/* translators: %s: bandwidth used this billing period, as a percentage of the plan. */
					'message'      => sprintf( __( 'Bandwidth is over this period\'s limit (%s%%).', 'godam' ), $percent ),
					'action_label' => __( 'View plan', 'godam' ),
					'action_url'   => $godam,
				);
			case 'bandwidth_high':
				return array(
					/* translators: %s: bandwidth used this billing period, as a percentage of the plan. */
					'message'      => sprintf( __( 'Bandwidth is %s%% used this billing period.', 'godam' ), $percent ),
					'action_label' => __( 'View plan', 'godam' ),
					'action_url'   => $godam,
				);
			case 'transcode_failed':
				$count = (int) ( $item['count'] ?? 0 );
				return array(
					/* translators: %s: number of files. */
					'message'      => sprintf( _n( 'GoDAM could not process %s file.', 'GoDAM could not process %s files.', $count, 'godam' ), number_format_i18n( $count ) ),
					'action_label' => __( 'Retry', 'godam' ),
					'action_url'   => admin_url( 'admin.php?page=rtgodam_tools' ),
				);
		}

		return array( 'message' => '' );
	}

	/**
	 * Render the widget.
	 *
	 * @return void
	 */
	public function render() {
		$model = $this->get_model();

		printf( '<div id="rtgodam-dashboard-widget" class="rtgodam-dw" data-state="%s">', esc_attr( $model['state'] ) );

		$this->render_attention( $model['attention'] );

		if ( 'active' === $model['state'] ) {
			$this->render_watching( $model );
		}

		$library_shown = $this->render_local_section( 'library', __( 'Your library', 'godam' ), self::LIBRARY_TILES, $model );
		$this->render_local_section( 'ready', __( 'Ready to stream and preview', 'godam' ), self::READY_TILES, $model );

		if ( 'active' === $model['state'] ) {
			if ( ! empty( $model['review_ask'] ) ) {
				$this->render_review_ask();
			}
		} elseif ( 'setting_up' === $model['state'] ) {
			$this->render_checklist( $model['counts'] );
		} elseif ( $model['can_manage'] ) {
			// Not connected: one prompt, fitted to the library when there is one to show.
			if ( $library_shown ) {
				$this->render_connect_line( $model['connect'] );
			} else {
				$this->render_not_connected();
			}
		}

		if ( 'not_connected' !== $model['state'] ) {
			printf(
				'<p class="rtgodam-dw__footer"><a href="%1$s">%2$s%3$s</a><span class="rtgodam-dw__updated" data-rtgodam-dw="updated"></span></p>',
				esc_url( admin_url( 'admin.php?page=rtgodam' ) ),
				esc_html__( 'Open GoDAM', 'godam' ),
				self::ARROW // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- constant markup.
			);
		}

		echo '</div>';
	}

	/**
	 * Render the Watching section, which the script fills in from GoDAM analytics.
	 *
	 * Tiles this site has shown before get a placeholder, so the layout does
	 * not jump; the rest stay hidden until the numbers clear their floor. The
	 * section's status line carries the loading, empty and failed messages.
	 *
	 * @param array $model From get_model().
	 * @return void
	 */
	private function render_watching( array $model ) {
		// When the user has hidden the widget, its script is not loaded, so draw no placeholders.
		$loading = ! $this->is_hidden_by_user();
		$seen    = $loading ? $model['remote_seen'] : array();

		printf(
			'<section class="rtgodam-dw__section" data-rtgodam-dw="section-watching"%1$s><h3 class="rtgodam-dw__heading">%2$s</h3><ul class="rtgodam-dw__receipts" data-rtgodam-dw="tiles" data-count="%3$d">',
			$loading && empty( $seen ) ? ' hidden' : '',
			esc_html__( 'Watching', 'godam' ),
			count( array_intersect( self::WATCHING_TILES, $seen ) )
		);

		foreach ( self::WATCHING_TILES as $id ) {
			$placeholder = in_array( $id, $seen, true );
			echo $this->tile_markup( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in tile_markup().
				$id,
				array(
					'class' => $placeholder ? 'is-loading' : '',
					'attrs' => ' data-rtgodam-dw="tile-' . esc_attr( $id ) . '"' . ( $placeholder ? '' : ' hidden' ),
				)
			);
		}

		echo '</ul>';

		$chart_seen = in_array( 'chart_plays', $seen, true );
		printf(
			'<div class="rtgodam-dw__chart%1$s" data-rtgodam-dw="chart"%2$s><div class="rtgodam-dw__chart-head"><h4 class="rtgodam-dw__subheading">%3$s</h4><span class="rtgodam-dw__chart-total" data-rtgodam-dw="chart-total"></span></div><svg class="rtgodam-dw__chart-svg" data-rtgodam-dw="chart-svg" viewBox="0 0 300 64" preserveAspectRatio="none" role="img" focusable="false"></svg></div>',
			$chart_seen ? ' is-loading' : '',
			$chart_seen ? '' : ' hidden',
			esc_html__( 'Plays, last 30 days', 'godam' )
		);

		$top_seen = in_array( 'top_videos', $seen, true );
		printf(
			'<div class="rtgodam-dw__top%1$s" data-rtgodam-dw="top"%2$s><h4 class="rtgodam-dw__subheading">%3$s</h4><ol class="rtgodam-dw__top-list" data-rtgodam-dw="top-list">%4$s</ol></div>',
			$top_seen ? ' is-loading' : '',
			$top_seen ? '' : ' hidden',
			esc_html__( 'Top videos, last 30 days', 'godam' ),
			$top_seen ? str_repeat( '<li class="rtgodam-dw__top-skeleton" aria-hidden="true"></li>', 3 ) : '' // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- constant markup.
		);

		$this->render_status( $loading );

		echo '</section>';
	}

	/**
	 * Render a section of local tiles, if any of them are showing.
	 *
	 * @param string   $key   Section key.
	 * @param string   $title Section heading.
	 * @param string[] $ids   Tile IDs in this section, in display order.
	 * @param array    $model From get_model().
	 * @return bool Whether the section rendered.
	 */
	private function render_local_section( $key, $title, array $ids, array $model ) {
		$tiles = array_values( array_intersect( $model['show'], $ids ) );
		if ( empty( $tiles ) ) {
			return false;
		}

		printf(
			'<section class="rtgodam-dw__section" data-rtgodam-dw="section-%1$s"><h3 class="rtgodam-dw__heading">%2$s</h3><ul class="rtgodam-dw__receipts" data-count="%3$d">',
			esc_attr( $key ),
			esc_html( $title ),
			count( $tiles )
		);

		foreach ( $tiles as $id ) {
			echo $this->tile_markup( $id, $this->get_local_tile( $id, $model['values'][ $id ] ?? 0 ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in tile_markup().
		}

		echo '</ul>';

		if ( 'library' === $key && in_array( 'chart_library', $model['show'], true ) ) {
			$this->render_library_mix( $model['types'] );
		}

		echo '</section>';

		return true;
	}

	/**
	 * A tile's markup: a list item, with a link filling it when the tile has
	 * somewhere to go, marked by an arrow.
	 *
	 * @param string $id   Tile ID.
	 * @param array  $tile Optional 'value', 'label' and 'title' (empty for a tile the
	 *                     script fills in), 'class' for the list item, and 'attrs',
	 *                     extra list-item attributes that are already escaped.
	 * @return string
	 */
	private function tile_markup( $id, array $tile = array() ) {
		$url   = $this->get_tile_url( $id );
		$title = (string) ( $tile['title'] ?? '' );
		$class = trim( 'rtgodam-dw__receipt ' . ( $tile['class'] ?? '' ) . ( '' === $url ? '' : ' is-link' ) );
		$inner = sprintf(
			'<span class="rtgodam-dw__value">%1$s</span><span class="rtgodam-dw__label">%2$s</span>',
			esc_html( (string) ( $tile['value'] ?? '' ) ),
			esc_html( (string) ( $tile['label'] ?? '' ) )
		);
		$tip   = '' === $title ? '' : sprintf( ' title="%s"', esc_attr( $title ) );

		if ( '' !== $url ) {
			// The tooltip goes on the link, so it describes the link.
			$inner = sprintf( '<a class="rtgodam-dw__tile-link" href="%1$s"%2$s>%3$s%4$s</a>', esc_url( $url ), $tip, $inner, self::ARROW );
			$tip   = '';
		}

		return sprintf( '<li class="%1$s"%2$s%3$s>%4$s</li>', esc_attr( $class ), $tip, $tile['attrs'] ?? '', $inner );
	}

	/**
	 * The page a tile links to, or '' when it is not a link.
	 *
	 * Type filters use the Media Library's own filter, set from the URL so it
	 * works in grid and list view alike: `attachment-filter` drives list view,
	 * and `type` with `order` makes grid view select the same filter in its
	 * dropdown. Neither saves anything, unlike `mode`.
	 *
	 * @param string $id Tile ID.
	 * @return string
	 */
	private function get_tile_url( $id ) {
		$target = self::TILE_LINKS[ $id ] ?? '';

		switch ( $target ) {
			case '':
				return '';
			case 'godam':
				return admin_url( 'admin.php?page=rtgodam' );
			case 'library':
				return admin_url( 'upload.php' );
		}

		$type = self::media_filter_key( $target, array_keys( get_post_mime_types() ) );
		if ( '' === $type ) {
			return admin_url( 'upload.php' );
		}

		return add_query_arg(
			array(
				'attachment-filter' => rawurlencode( 'post_mime_type:' . $type ),
				'type'              => rawurlencode( $type ),
				'order'             => 'DESC',
			),
			admin_url( 'upload.php' )
		);
	}

	/**
	 * The Media Library filter key for a file type.
	 *
	 * Images, audio and video have keys of their own. Core names its Documents
	 * filter by the MIME types it covers, so the documents key is the one that
	 * includes PDF. That filter covers PDF and word-processor files; spreadsheets
	 * and presentations sit under other filters.
	 *
	 * @param string   $target 'image', 'audio', 'video' or 'document'.
	 * @param string[] $keys   Keys of get_post_mime_types().
	 * @return string The key, or '' when there is none.
	 */
	public static function media_filter_key( $target, array $keys ) {
		if ( in_array( $target, array( 'image', 'audio', 'video' ), true ) ) {
			return in_array( $target, $keys, true ) ? $target : '';
		}

		if ( 'document' === $target ) {
			foreach ( $keys as $key ) {
				if ( in_array( 'application/pdf', explode( ',', (string) $key ), true ) ) {
					return (string) $key;
				}
			}
		}

		return '';
	}

	/**
	 * The value, label and tooltip of a local tile.
	 *
	 * @param string    $id    Tile ID.
	 * @param int|float $value Tile value.
	 * @return array With 'value', 'label' and 'title'.
	 */
	private function get_local_tile( $id, $value ) {
		$count = (int) $value;

		switch ( $id ) {
			case 'library_files':
				return array(
					'value' => number_format_i18n( $count ),
					'label' => _n( 'file', 'files', $count, 'godam' ),
					'title' => __( 'Everything in your Media Library.', 'godam' ),
				);
			case 'folder_files':
				return array(
					'value' => number_format_i18n( $count ),
					'label' => _n( 'file in folders', 'files in folders', $count, 'godam' ),
					'title' => __( 'Files sorted into a GoDAM folder.', 'godam' ),
				);
			case 'folders':
				return array(
					'value' => number_format_i18n( $count ),
					'label' => _n( 'folder', 'folders', $count, 'godam' ),
					'title' => __( 'Folders in your Media Library.', 'godam' ),
				);
			case 'files_in_use':
				return array(
					'value' => number_format_i18n( $count ),
					'label' => _n( 'file in use on your site', 'files in use on your site', $count, 'godam' ),
					'title' => __( 'Files that appear in at least one post, page or widget. Drafts count too.', 'godam' ),
				);
			case 'video_seconds':
				$hours = (float) $value / HOUR_IN_SECONDS;
				$hours = $hours >= 10 ? round( $hours ) : round( $hours, 1 );
				return array(
					'value' => number_format_i18n( $hours, $hours >= 10 || floor( $hours ) === $hours ? 0 : 1 ),
					'label' => _n( 'hour of video', 'hours of video', (int) ceil( $hours ), 'godam' ),
					'title' => __( 'The combined length of the videos in your Media Library.', 'godam' ),
				);
			case 'videos_ready':
				return array(
					'value' => number_format_i18n( $count ),
					'label' => _n( 'video ready to stream', 'videos ready to stream', $count, 'godam' ),
					'title' => __( 'Videos GoDAM has transcoded into adaptive streams.', 'godam' ),
				);
			case 'audio_ready':
				return array(
					'value' => number_format_i18n( $count ),
					'label' => _n( 'audio file ready to stream', 'audio files ready to stream', $count, 'godam' ),
					'title' => __( 'Audio files GoDAM has prepared for streaming.', 'godam' ),
				);
			case 'documents_ready':
				return array(
					'value' => number_format_i18n( $count ),
					'label' => _n( 'document ready to preview', 'documents ready to preview', $count, 'godam' ),
					'title' => __( 'Documents GoDAM has prepared for the on-page viewer.', 'godam' ),
				);
			case 'captions':
				return array(
					'value' => number_format_i18n( $count ),
					'label' => _n( 'video with captions', 'videos with captions', $count, 'godam' ),
					'title' => __( 'Videos with a GoDAM transcript, which the player shows as captions.', 'godam' ),
				);
		}

		return array(
			'value' => number_format_i18n( $count ),
			'label' => '',
			'title' => '',
		);
	}

	/**
	 * Render the library's mix of file types as one bar with a legend.
	 *
	 * @param array $types From group_mime_counts().
	 * @return void
	 */
	private function render_library_mix( array $types ) {
		// Plain counts first: make-pot skips an _n() whose count reads "(int) ( $x ?? 0 )".
		$counts = array_map(
			'intval',
			array_merge(
				array(
					'images'    => 0,
					'videos'    => 0,
					'documents' => 0,
					'audio'     => 0,
					'other'     => 0,
				),
				array_intersect_key( $types, array_flip( array( 'images', 'videos', 'documents', 'audio', 'other' ) ) )
			)
		);

		$parts = array(
			/* translators: %s: number of images. */
			'images'    => _n( '%s image', '%s images', $counts['images'], 'godam' ),
			/* translators: %s: number of videos. */
			'videos'    => _n( '%s video', '%s videos', $counts['videos'], 'godam' ),
			/* translators: %s: number of documents. */
			'documents' => _n( '%s document', '%s documents', $counts['documents'], 'godam' ),
			/* translators: %s: number of audio files. */
			'audio'     => _n( '%s audio file', '%s audio files', $counts['audio'], 'godam' ),
			/* translators: %s: number of other files. */
			'other'     => _n( '%s other file', '%s other files', $counts['other'], 'godam' ),
		);

		$segments = '';
		$legend   = '';
		$labels   = array();
		foreach ( $parts as $type => $format ) {
			$count = $counts[ $type ];
			if ( $count <= 0 ) {
				continue;
			}

			$label     = sprintf( $format, number_format_i18n( $count ) );
			$labels[]  = $label;
			$segments .= sprintf( '<span class="rtgodam-dw__mix-part is-%1$s" style="flex-grow: %2$d"></span>', esc_attr( $type ), $count );
			$legend   .= sprintf( '<li><span class="rtgodam-dw__swatch is-%1$s" aria-hidden="true"></span>%2$s</li>', esc_attr( $type ), esc_html( $label ) );
		}

		printf(
			'<div class="rtgodam-dw__mix"><div class="rtgodam-dw__mix-bar" role="img" aria-label="%1$s">%2$s</div><ul class="rtgodam-dw__mix-legend">%3$s</ul></div>',
			/* translators: %s: the library's file counts by type, such as "1,980 images, 48 videos". */
			esc_attr( sprintf( __( 'Your Media Library: %s', 'godam' ), implode( ', ', $labels ) ) ),
			$segments, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built from escaped parts above.
			$legend // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built from escaped parts above.
		);
	}

	/**
	 * Render the one-line connect prompt shown under a library without a key.
	 *
	 * The count only picks the file type; the line itself says "all your", so
	 * it reads the same for 2 files as for 2,000.
	 *
	 * @param array $connect From pick_connect_prompt().
	 * @return void
	 */
	private function render_connect_line( array $connect ) {
		switch ( $connect['type'] ) {
			case 'videos':
				$text = __( 'Connect GoDAM to stream all your videos in the right quality for every screen.', 'godam' );
				break;
			case 'office':
				$text = __( 'Connect GoDAM to turn all your Word, Excel and PowerPoint files into previews visitors can read on the page.', 'godam' );
				break;
			case 'audio':
				$text = __( 'Connect GoDAM to stream all your audio files in a player that can show chapters and transcripts.', 'godam' );
				break;
			default:
				$text = __( 'Connect GoDAM to use this library on your other sites and share it with your team.', 'godam' );
				break;
		}

		printf(
			'<p class="rtgodam-dw__connect">%1$s <a href="%2$s">%3$s%4$s</a></p>',
			esc_html( $text ),
			esc_url( admin_url( 'admin.php?page=rtgodam' ) ),
			esc_html__( 'Connect', 'godam' ),
			self::ARROW // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- constant markup.
		);
	}

	/**
	 * Render the prompt shown before a key is connected, when there is no library to show yet.
	 *
	 * @return void
	 */
	private function render_not_connected() {
		printf(
			'<p class="rtgodam-dw__lead">%1$s</p><p><a class="button button-primary" href="%2$s">%3$s</a></p>',
			esc_html__( 'Connect GoDAM to stream your videos in the right quality for every screen.', 'godam' ),
			esc_url( admin_url( 'admin.php?page=rtgodam' ) ),
			esc_html__( 'Connect GoDAM', 'godam' )
		);
	}

	/**
	 * Render the status line the script uses while loading and for empty or failed loads.
	 *
	 * @param bool $loading Whether the script is loaded to fill the section in.
	 * @return void
	 */
	private function render_status( $loading ) {
		if ( ! $loading ) {
			printf( '<p class="rtgodam-dw__status" data-rtgodam-dw="status">%s</p>', esc_html__( 'Reload the page to load your GoDAM numbers.', 'godam' ) );
			return;
		}

		// Read out while the placeholders show; the script replaces or clears it.
		printf( '<p class="rtgodam-dw__status screen-reader-text" data-rtgodam-dw="status">%s</p>', esc_html__( 'Loading your numbers...', 'godam' ) );
	}

	/**
	 * Render the review ask, hidden until the script sees a plays milestone.
	 *
	 * One ask, no incentive, and every star rating goes to the same public form
	 * (wordpress.org guideline 9).
	 *
	 * @return void
	 */
	private function render_review_ask() {
		printf(
			'<div class="rtgodam-dw__review" data-rtgodam-dw="review" hidden><p class="rtgodam-dw__review-text" data-rtgodam-dw="review-text"></p><p class="rtgodam-dw__review-actions"><a class="button button-primary" href="%1$s" target="_blank" rel="noopener noreferrer" data-rtgodam-dw-review="review">%2$s<span class="screen-reader-text"> %3$s</span></a><button type="button" class="button-link" data-rtgodam-dw-review="later">%4$s</button><button type="button" class="button-link" data-rtgodam-dw-review="never">%5$s</button></p></div>',
			esc_url( self::REVIEW_URL ),
			esc_html__( 'Leave a review', 'godam' ),
			esc_html__( '(opens in a new tab)', 'godam' ),
			esc_html__( 'Not now', 'godam' ),
			esc_html__( 'No thanks', 'godam' )
		);
	}

	/**
	 * Render the Needs attention list, if anything needs attention.
	 *
	 * @param array[] $items From build_attention_items().
	 * @return void
	 */
	private function render_attention( array $items ) {
		if ( empty( $items ) ) {
			return;
		}

		printf( '<div class="rtgodam-dw__attention"><h3 class="rtgodam-dw__heading">%s</h3><ul class="rtgodam-dw__alerts">', esc_html__( 'Needs attention', 'godam' ) );

		foreach ( $items as $item ) {
			$copy = $this->get_attention_copy( $item );
			if ( '' === $copy['message'] ) {
				continue;
			}

			$action = '';
			if ( ! empty( $copy['action_url'] ) ) {
				$action = sprintf( ' <a href="%1$s">%2$s</a>', esc_url( $copy['action_url'] ), esc_html( $copy['action_label'] ) );
			}

			printf(
				'<li class="rtgodam-dw__alert is-%1$s">%2$s%3$s</li>',
				esc_attr( $item['tone'] ),
				esc_html( $copy['message'] ),
				$action // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built from escaped parts above.
			);
		}

		echo '</ul></div>';
	}

	/**
	 * Render the setup checklist shown until the first file is ready.
	 *
	 * @param array $counts From summarize_status_rows().
	 * @return void
	 */
	private function render_checklist( array $counts ) {
		$steps = array(
			array(
				'done'   => true,
				'title'  => __( 'Connect GoDAM', 'godam' ),
				'detail' => __( 'Your site is linked to your GoDAM account.', 'godam' ),
			),
			array(
				'done'   => $counts['total'] > 0,
				'title'  => __( 'Upload a video', 'godam' ),
				'detail' => __( 'Add it to the Media Library. GoDAM prepares it for streaming.', 'godam' ),
				'url'    => admin_url( 'media-new.php' ),
			),
			array(
				'done'   => false,
				'title'  => __( 'Get your first video ready to stream', 'godam' ),
				'detail' => $counts['processing'] > 0
					? __( 'GoDAM is preparing it now, so it plays smoothly on any screen and connection.', 'godam' )
					: __( 'GoDAM prepares it to play smoothly on any screen and connection.', 'godam' ),
			),
		);

		printf( '<section class="rtgodam-dw__section"><h3 class="rtgodam-dw__heading">%s</h3><ol class="rtgodam-dw__checklist">', esc_html__( 'Get set up', 'godam' ) );

		foreach ( $steps as $index => $step ) {
			$title = esc_html( $step['title'] );
			if ( ! $step['done'] && ! empty( $step['url'] ) ) {
				$title = sprintf( '<a href="%1$s">%2$s</a>', esc_url( $step['url'] ), $title );
			}

			printf(
				'<li class="rtgodam-dw__step%1$s"><span class="rtgodam-dw__step-marker" aria-hidden="true">%2$s</span><span><span class="rtgodam-dw__step-title">%3$s</span><span class="rtgodam-dw__step-detail">%4$s</span></span></li>',
				$step['done'] ? ' is-done' : '',
				$step['done'] ? '&#10003;' : esc_html( number_format_i18n( $index + 1 ) ),
				$title, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
				esc_html( $step['detail'] )
			);
		}

		echo '</ol></section>';
	}
}
