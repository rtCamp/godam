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
 * Runs once per site; progress is tracked in the WordPress option
 * `rtgodam_gallery_v1_v2_migration_done`. Re-run is possible by deleting
 * that option.
 *
 * ## Attribute mapping (V1 → V2)
 *
 * | V1 attribute    | V2 attribute       | Notes                                     |
 * |-----------------|--------------------|-------------------------------------------|
 * | columns (int)   | itemWidth (int)    | See COLUMNS_TO_ITEM_WIDTH_MAP             |
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
 * | include         | include            | direct pass-through                       |
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
	 * Posts to process per DB batch.
	 *
	 * @var int
	 */
	const BATCH_SIZE = 50;

	/**
	 * Maps a V1 column count to a V2 itemWidth value (pixels).
	 *
	 * V2 layout: `repeat(auto-fill, minmax(--godam-gallery-item-width, 1fr))`
	 * render.php enforces a minimum of 180 px, so columns 5 and 6 both
	 * resolve to the 180 px minimum (~4 columns in a standard 720 px container).
	 *
	 * Approximation assumes a ~720 px content column width:
	 *   itemWidth = floor( 720 / columns )
	 *
	 * @var array<int,int>
	 */
	const COLUMNS_TO_ITEM_WIDTH_MAP = array(
		1 => 720,
		2 => 360,
		3 => 240,
		4 => 180,
		5 => 180, // below render.php's min(180) – best available approximation.
		6 => 180, // below render.php's min(180) – best available approximation.
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
		global $wpdb;

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
					'%<!-- wp:godam/gallery %',
					$last_id,
					self::BATCH_SIZE
				)
			);

			if ( empty( $rows ) ) {
				break;
			}

			foreach ( $rows as $row ) {

				// The LIKE pattern may return rows whose only match is a
				// godam/gallery-v2 block (the LIKE has no way to exclude the
				// "-v2" suffix). Skip those cleanly.
				if ( ! self::contains_v1_block( $row->post_content ) ) {
					++$skipped;
					continue;
				}

				$new_content = self::migrate_content( $row->post_content );

				if ( $new_content === $row->post_content ) {
					++$skipped;
					continue;
				}

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
				$result = $wpdb->update(
					$wpdb->posts,
					array( 'post_content' => $new_content ),
					array( 'ID' => (int) $row->ID ),
					array( '%s' ),
					array( '%d' )
				);

				if ( false === $result ) {
					++$failed;
					continue;
				}

				clean_post_cache( (int) $row->ID );
				++$updated;
			}

			$last_id = (int) end( $rows )->ID;

			$row_count = count( $rows );
		} while ( self::BATCH_SIZE === $row_count );

		// Only mark migration as complete when every write succeeded.
		// If any update failed the option is left unset so the migration
		// retries on the next request; already-converted posts are skipped
		// by contains_v1_block() so they are never processed twice.
		if ( 0 === $failed ) {
			update_option( self::OPTION_KEY, '1', false );
		}

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
			'itemWidth'         => 180,
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
			'include'           => '',
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

		// columns (int) → itemWidth (int).
		// V2 uses CSS auto-fill grid with minmax( itemWidth, 1fr ).
		// render.php enforces min 180 px, so columns > 4 map to 180.
		if ( isset( $v1['columns'] ) ) {
			$cols            = (int) $v1['columns'];
			$v2['itemWidth'] = isset( self::COLUMNS_TO_ITEM_WIDTH_MAP[ $cols ] )
				? self::COLUMNS_TO_ITEM_WIDTH_MAP[ $cols ]
				: 180; // Default for any out-of-range value.
		}

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
			'include',
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
		 * category, tag, search, engagements, openToNewPage.
		 */

		return $v2;
	}
}
