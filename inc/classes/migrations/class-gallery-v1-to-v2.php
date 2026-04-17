<?php
/**
 * Migration: godam/gallery (V1) → godam/gallery-v2 (V2).
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Migrates all saved godam/gallery (V1) blocks to godam/gallery-v2 (V2).
 *
 * Runs once per site; completion is recorded in the WordPress option
 * `rtgodam_gallery_v1_v2_migration_done`. Re-run is possible by deleting
 * that option.
 *
 * ## Attribute mapping (V1 → V2)
 *
 * | V1 attribute    | V2 attribute       | Notes                                     |
 * |-----------------|--------------------|-------------------------------------------|
 * | columns (int)   | itemWidth (string) | See COLUMNS_TO_ITEM_SIZE_MAP              |
 * | count           | count              | direct pass-through                       |
 * | orderby         | orderby            | direct pass-through                       |
 * | order           | order              | normalised to lowercase                   |
 * | layout          | layout             | direct pass-through                       |
 * | infiniteScroll  | infiniteScroll     | direct pass-through                       |
 * | mediaFolder     | mediaFolder        | direct pass-through                       |
 * | author (int)    | author (string)    | 0 → "", positive int → "123"              |
 * | dateRange       | dateRange          | direct pass-through                       |
 * | customDateStart | customDateStart    | direct pass-through                       |
 * | customDateEnd   | customDateEnd      | direct pass-through                       |
 * | include         | (dropped)          | V2 does not support include               |
 * | showTitle       | showTitle          | direct pass-through                       |
 * | category        | (dropped)          | V2 query does not support category filter |
 * | tag             | (dropped)          | V2 query does not support tag filter      |
 * | search          | (dropped)          | V2 query does not support search filter   |
 * | engagements     | (dropped)          | V2 does not have engagement support       |
 * | openToNewPage   | (dropped)          | V2 does not have single-page linking      |
 */
class Gallery_V1_To_V2 {

	/**
	 * WordPress option key that records migration completion.
	 *
	 * @var string
	 */
	const OPTION_KEY = 'rtgodam_gallery_v1_v2_migration_done';

	/**
	 * WordPress option key used as a short-lived concurrency lock.
	 *
	 * @var string
	 */
	const LOCK_KEY = 'rtgodam_gallery_v1_v2_migration_lock';

	/**
	 * How long (seconds) the concurrency lock is held before it is
	 * considered stale and overridden by another request.
	 *
	 * @var int
	 */
	const LOCK_TIMEOUT = 300;

	/**
	 * Posts to process per DB batch.
	 *
	 * @var int
	 */
	const BATCH_SIZE = 50;

	/**
	 * Maps a V1 column count to a V2 itemWidth size token.
	 *
	 * V2 uses three size tokens rendered by the block:
	 *   S = 200 px  (~3–4 items per row, V2 default)
	 *   M = 260 px  (~2–3 items per row)
	 *   L = 320 px  (~1–2 items per row)
	 *
	 * V1 column 3 was the default and maps to S (which is also the V2 default),
	 * preserving layout density for the most common case.
	 *
	 * @var array<int,string>
	 */
	const COLUMNS_TO_ITEM_SIZE_MAP = array(
		1 => 'L',
		2 => 'M',
		3 => 'S',
		4 => 'S',
		5 => 'S',
		6 => 'S',
	);

	/**
	 * Schedule the migration to run on `init` if it has not yet run.
	 *
	 * Called by Runner::run() during plugin bootstrap.
	 *
	 * @return void
	 */
	public static function maybe_run() {
		if ( get_option( self::OPTION_KEY ) ) {
			return;
		}

		// Only run during admin requests, WP-CLI, or cron. Bulk content writes
		// must not be triggered by unauthenticated frontend page loads.
		if ( ! is_admin() && ! wp_doing_cron() && ! ( defined( 'WP_CLI' ) && WP_CLI ) ) {
			return;
		}

		add_action( 'init', array( static::class, 'run' ), 99 );
	}

	/**
	 * Execute the full migration.
	 *
	 * Iterates all posts whose content contains a V1 godam/gallery block
	 * comment, converts each block in place, persists the updated content,
	 * then marks the migration as complete.
	 *
	 * @return void
	 */
	public static function run() {
		// Non-cron, non-CLI requests must originate from an authenticated admin.
		$is_cli  = defined( 'WP_CLI' ) && WP_CLI;
		$is_cron = wp_doing_cron();

		if ( ! $is_cron && ! $is_cli && ( ! is_user_logged_in() || ! current_user_can( 'manage_options' ) ) ) {
			return;
		}

		global $wpdb;

		// Acquire a short-lived lock so concurrent requests on the same site
		// do not each kick off a full migration sweep simultaneously.
		if ( ! self::acquire_lock() ) {
			return;
		}

		$last_id = 0;
		$updated = 0;
		$skipped = 0;
		$failed  = 0;

		do {
			// Direct DB query is intentional here – WP_Query 's' param does
			// not support prefix-exact block-name matching across all post types
			// and statuses needed for a migration sweep.
			//
			// Keyset pagination (ID > $last_id) is used instead of OFFSET so
			// that rows already updated – and therefore no longer matching the
			// LIKE clause – do not shift the window and cause later posts to
			// be silently skipped.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT ID, post_content
					 FROM {$wpdb->posts}
					 WHERE post_content LIKE %s
					   AND ID > %d
					   AND post_status NOT IN ('auto-draft', 'trash', 'inherit')
					 ORDER BY ID ASC
					 LIMIT %d",
					'%<!-- wp:godam/gallery%',
					$last_id,
					self::BATCH_SIZE
				)
			);

			if ( empty( $rows ) ) {
				break;
			}

			foreach ( $rows as $row ) {

				// The LIKE clause is only a coarse prefilter. Confirm the post
				// content actually contains a V1 godam/gallery block before
				// attempting migration.
				if ( ! self::contains_v1_block( $row->post_content ) ) {
					++$skipped;
					continue;
				}

				$new_content = self::migrate_content( $row->post_content );

				if ( $new_content === $row->post_content ) {
					++$skipped;
					continue;
				}

				$result = wp_update_post(
					array(
						'ID'           => (int) $row->ID,
						'post_content' => $new_content,
					),
					true
				);

				if ( is_wp_error( $result ) || 0 === $result ) {
					++$failed;
					continue;
				}

				++$updated;
			}

			$last_id = (int) end( $rows )->ID;

			$row_count = count( $rows );
		} while ( self::BATCH_SIZE === $row_count );

		// Mark the migration as done regardless of individual post failures.
		// Any posts that could not be updated are logged below for manual review.
		update_option( self::OPTION_KEY, 'done', false );

		self::release_lock();

		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log(
			sprintf(
				'[GoDAM] Gallery V1→V2 migration complete. Updated: %d post(s). Skipped: %d post(s). Failed: %d post(s).',
				$updated,
				$skipped,
				$failed
			)
		);
	}

	// -------------------------------------------------------------------------
	// Concurrency helpers
	// -------------------------------------------------------------------------

	/**
	 * Acquire a short-lived option-based lock so only one request runs the
	 * migration at a time.
	 *
	 * `add_option()` is atomic (MySQL INSERT IGNORE) and prevents two
	 * simultaneous fresh requests from both proceeding. For the stale-lock
	 * case a compare-and-swap UPDATE is used so two concurrent requests racing
	 * on the same expired timestamp cannot both succeed.
	 *
	 * @return bool True when the lock was acquired, false otherwise.
	 */
	private static function acquire_lock(): bool {
		global $wpdb;

		$expires_at = time() + self::LOCK_TIMEOUT;

		// Attempt an atomic insert; succeeds only if the option is absent.
		if ( add_option( self::LOCK_KEY, $expires_at, '', 'no' ) ) {
			return true;
		}

		// CAS: only override a stale lock if the stored value still equals what
		// we read. Two concurrent requests cannot both win this UPDATE.
		$current = (int) get_option( self::LOCK_KEY, 0 );
		if ( $current >= time() ) {
			return false; // Lock is still held by another request.
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->update(
			$wpdb->options,
			array( 'option_value' => $expires_at ),
			array( 
				'option_name'  => self::LOCK_KEY,
				'option_value' => (string) $current,
			),
			array( '%s' ),
			array( '%s', '%s' )
		);

		return 1 === $wpdb->rows_affected;
	}

	/**
	 * Release the concurrency lock after the migration finishes.
	 *
	 * @return void
	 */
	private static function release_lock(): void {
		delete_option( self::LOCK_KEY );
	}

	// -------------------------------------------------------------------------
	// Internal helpers
	// -------------------------------------------------------------------------

	/**
	 * Return true when $content contains at least one V1 godam/gallery block.
	 *
	 * @param string $content Raw post content.
	 * @return bool
	 */
	private static function contains_v1_block( $content ) {
		return (bool) preg_match( self::block_pattern(), $content );
	}

	/**
	 * Replace every V1 godam/gallery block comment in $content with its V2
	 * equivalent. Content without any V1 blocks is returned unchanged.
	 *
	 * @param string $content Raw post content.
	 * @return string
	 */
	public static function migrate_content( $content ) {
		$result = preg_replace_callback(
			self::block_pattern(),
			array( static::class, 'convert_block_match' ),
			$content
		);

		return null !== $result ? $result : $content;
	}

	/**
	 * Regex pattern that matches a self-closing godam/gallery V1 block comment.
	 *
	 * Capture group 1: the raw JSON attribute string (including the leading
	 *                   space), or absent when the block uses all defaults.
	 *
	 * The negative lookahead `(?!-)` prevents matching godam/gallery-v2.
	 *
	 * @return string
	 */
	private static function block_pattern() {
		return '#<!-- wp:godam/gallery(?!-)(\s+\{[^}]*\})?\s*/-->#';
	}

	/**
	 * Preg_replace_callback handler – converts a single V1 block match to V2.
	 *
	 * @param array $block_match Regex match array.
	 * @return string Replacement V2 block comment.
	 */
	private static function convert_block_match( array $block_match ) {
		$raw_json = isset( $block_match[1] ) ? trim( $block_match[1] ) : '';
		$v1_attrs = array();

		if ( ! empty( $raw_json ) ) {
			$decoded = json_decode( $raw_json, true );
			if ( is_array( $decoded ) ) {
				$v1_attrs = $decoded;
			}
		}

		$v2_attrs = self::map_attributes( $v1_attrs );

		// Only write attributes that differ from V2 defaults to keep the
		// block comment lean (matching the editor's own serialisation behaviour).
		$v2_defaults = array(
			'mode'              => 'query',
			'itemWidth'         => 'S',
			'count'             => 6,
			'orderby'           => 'date',
			'order'             => 'desc',
			'layout'            => 'grid',
			'viewRatio'         => '16:9',
			'infiniteScroll'    => false,
			'enableMoreItems'   => false,
			'moreItemsBehavior' => 'button',
			'mediaFolder'       => '',
			'author'            => '',
			'dateRange'         => '',
			'customDateStart'   => '',
			'customDateEnd'     => '',
			'showTitle'         => true,
		);

		$diff = array();
		foreach ( $v2_attrs as $key => $value ) {
			if ( ! array_key_exists( $key, $v2_defaults ) || $v2_defaults[ $key ] !== $value ) {
				$diff[ $key ] = $value;
			}
		}

		$json_part = empty( $diff ) ? '' : ' ' . wp_json_encode( $diff, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

		return '<!-- wp:godam/gallery-v2' . $json_part . ' /-->';
	}

	/**
	 * Convert a V1 attribute array to the equivalent V2 attribute array.
	 *
	 * @param array $v1 V1 attributes as decoded from the block comment JSON.
	 * @return array V2 attributes.
	 */
	private static function map_attributes( array $v1 ) {
		$v2 = array();

		// V2 always starts in query mode; V1 had no handpicked mode.
		$v2['mode'] = 'query';

		// columns (int) → itemWidth (string: 'S' | 'M' | 'L').
		// V2 renders tile sizes as S=200 px, M=260 px, L=320 px.
		// V1 defaults columns to 3, and Gutenberg omits default-valued
		// attributes from the serialised block comment JSON. Apply that V1
		// default here so migrated blocks preserve the original layout density
		// (3 cols → S) rather than relying on the V2 default.
		$cols            = isset( $v1['columns'] ) ? (int) $v1['columns'] : 3;
		$v2['itemWidth'] = isset( self::COLUMNS_TO_ITEM_SIZE_MAP[ $cols ] )
			? self::COLUMNS_TO_ITEM_SIZE_MAP[ $cols ]
			: 'S'; // Default for any out-of-range value.

		// Direct pass-through attributes (same key, same type).
		$passthrough = array(
			'count',
			'orderby',
			'layout',
			'infiniteScroll',
			'mediaFolder',
			'dateRange',
			'customDateStart',
			'customDateEnd',
			'showTitle',
		);

		foreach ( $passthrough as $key ) {
			if ( array_key_exists( $key, $v1 ) ) {
				$v2[ $key ] = $v1[ $key ];
			}
		}

		// order: V1 stored "DESC"/"ASC", V2 default is lowercase "desc"/"asc".
		// render.php does strtoupper() internally so both work, but normalise
		// to match V2 block.json defaults and editor behaviour.
		if ( array_key_exists( 'order', $v1 ) ) {
			$v2['order'] = strtolower( (string) $v1['order'] );
		}

		// author: V1 stores a single int (0 = no filter), V2 stores a
		// comma-separated string of IDs ("" = no filter).
		if ( array_key_exists( 'author', $v1 ) ) {
			$author_int   = (int) $v1['author'];
			$v2['author'] = $author_int > 0 ? (string) $author_int : '';
		}

		/*
		 * Intentionally dropped (no equivalent in V2):
		 * category, tag, search, engagements, openToNewPage, include.
		 */

		return $v2;
	}
}
