<?php
/**
 * Migration: WPBakery [godam_video_gallery] shortcode V1 → V2.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Migrates all saved WPBakery `[godam_video_gallery]` shortcode instances in
 * post_content to match the godam/gallery-v2 block's attribute set. Same
 * pattern as Gallery_V1_To_V2 (block-comment rewriter) and
 * Elementor_Gallery_Widget_V1_To_V2 (JSON walker) — this one walks
 * shortcodes inside post_content.
 *
 * Runs once per site; completion is recorded in
 * `rtgodam_wpbakery_gallery_v1_v2_migration_done`. Re-run by deleting
 * that option.
 *
 * ## Attribute mapping (V1 → V2)
 *
 * | V1 attr   | V2 attr     | Notes                                       |
 * |-----------|-------------|---------------------------------------------|
 * | columns   | item_width  | See Gallery_V1_To_V2::COLUMNS_TO_ITEM_SIZE_MAP |
 * | layout    | layout      | 'list' → 'grid'; 'grid' kept; else default  |
 * | category  | (dropped)   | V2 query does not support category filter   |
 * | tag       | (dropped)   | V2 query does not support tag filter        |
 * | search    | (dropped)   | V2 query does not support search filter     |
 * | include   | (dropped)   | V2 does not support include                 |
 * | align     | (dropped)   | V2 has no per-element align                 |
 * | css       | (dropped)   | WPBakery Design Options class hash          |
 * | (absent)  | mode='query' | new default                                |
 * | (absent)  | item_width='S' | new default                              |
 * | (absent)  | view_ratio='16:9' | new default                           |
 * | (absent)  | performance_mode='balanced' | new default                 |
 *
 * @since n.e.x.t
 */
class WPBakery_Gallery_Shortcode_V1_To_V2 {

	/**
	 * WordPress option key that records migration completion.
	 *
	 * @var string
	 */
	const OPTION_KEY = 'rtgodam_wpbakery_gallery_v1_v2_migration_done';

	/**
	 * WordPress option key used as a short-lived concurrency lock.
	 *
	 * @var string
	 */
	const LOCK_KEY = 'rtgodam_wpbakery_gallery_v1_v2_migration_lock';

	/**
	 * How long (seconds) the concurrency lock is held before it is considered
	 * stale and overridden by another request.
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
	 * Attribute keys dropped by the V2 attribute set.
	 *
	 * @var string[]
	 */
	const DROPPED_KEYS = array( 'columns', 'category', 'tag', 'search', 'include', 'align', 'css' );

	/**
	 * Run the migration if it has not yet completed.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool True if migration is complete or was just run; false if it bailed.
	 */
	public static function maybe_run(): bool {
		if ( get_option( self::OPTION_KEY ) ) {
			return true;
		}

		self::run();

		return (bool) get_option( self::OPTION_KEY );
	}

	/**
	 * Execute the full migration.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public static function run() {
		global $wpdb;

		if ( ! self::acquire_lock() ) {
			return;
		}

		$last_id = 0;
		$updated = 0;
		$skipped = 0;
		$failed  = 0;

		do {
			// Keyset-paginate over posts that contain a godam_video_gallery
			// shortcode anywhere in their content. The LIKE is a coarse
			// prefilter; precise confirmation runs inside the loop before
			// any write.
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
					'%' . $wpdb->esc_like( '[godam_video_gallery' ) . '%',
					$last_id,
					self::BATCH_SIZE
				)
			);

			if ( empty( $rows ) ) {
				break;
			}

			foreach ( $rows as $row ) {
				$new_content = self::migrate_content( (string) $row->post_content );

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

		update_option( self::OPTION_KEY, 'done', false );

		self::release_lock();

		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log(
			sprintf(
				'[GoDAM] WPBakery [godam_video_gallery] V1→V2 migration complete. Updated: %d post(s). Skipped: %d post(s). Failed: %d post(s).',
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
	 * Acquire a short-lived option-based lock.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool True when the lock was acquired, false otherwise.
	 */
	private static function acquire_lock(): bool {
		global $wpdb;

		$expires_at = time() + self::LOCK_TIMEOUT;

		if ( add_option( self::LOCK_KEY, $expires_at, '', 'no' ) ) {
			return true;
		}

		$current = (int) get_option( self::LOCK_KEY, 0 );
		if ( $current >= time() ) {
			return false;
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
	 * Release the concurrency lock.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	private static function release_lock(): void {
		delete_option( self::LOCK_KEY );
	}

	// -------------------------------------------------------------------------
	// Content rewriting
	// -------------------------------------------------------------------------

	/**
	 * Rewrite every [godam_video_gallery] shortcode in the given content with
	 * V2-aligned attributes. Content with no V1-shaped instances is returned
	 * unchanged so a no-op pass leaves post_content byte-identical.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $content Raw post content.
	 * @return string
	 */
	public static function migrate_content( $content ) {
		if ( false === strpos( $content, '[godam_video_gallery' ) ) {
			return $content;
		}

		// `get_shortcode_regex( [tag] )` returns a regex that matches a single
		// shortcode (with or without enclosed content, and tolerates [[escaped]]).
		$pattern = '/' . get_shortcode_regex( array( 'godam_video_gallery' ) ) . '/s';

		$result = preg_replace_callback(
			$pattern,
			array( static::class, 'rewrite_match' ),
			$content
		);

		return null !== $result ? $result : $content;
	}

	/**
	 * The preg_replace_callback handler — rewrite a single shortcode match.
	 *
	 * Capture group indices from get_shortcode_regex():
	 *   1 = second opening bracket for escaping shortcodes ("[[tag]]")
	 *   2 = tag name
	 *   3 = attribute string (with leading space)
	 *   4 = self-closing slash or empty
	 *   5 = enclosed content (we re-emit it as-is)
	 *   6 = second closing bracket for escaping shortcodes
	 *
	 * @since n.e.x.t
	 *
	 * @param array $identical Regex match array.
	 * @return string Replacement shortcode (or the original on failure).
	 */
	private static function rewrite_match( array $identical ) {
		$original = $identical[0];

		// Preserve WordPress's shortcode escaping: [[tag]] should remain escaped.
		if ( isset( $identical[1], $identical[6] ) && '[' === $identical[1] && ']' === $identical[6] ) {
			return $original;
		}
		$attrs = isset( $identical[3] ) ? shortcode_parse_atts( $identical[3] ) : array();
		if ( ! is_array( $attrs ) ) {
			$attrs = array();
		}

		$new_attrs = self::rewrite_attrs( $attrs );

		if ( $new_attrs === $attrs ) {
			return $original; // Already V2-shaped; leave it alone.
		}

		$attr_string = '';
		foreach ( $new_attrs as $key => $value ) {
			// Mirror WordPress's own shortcode serialisation (no nested-quote
			// escapes, since stored values rarely contain double quotes — and
			// when they do, dropping into single quotes is the safer fallback).
			$attr_string .= ' ' . $key . '="' . str_replace( '"', "'", (string) $value ) . '"';
		}

		$enclosed_content = isset( $identical[5] ) ? $identical[5] : '';
		$closing_tag      = isset( $identical[6] ) ? $identical[6] : '';

		// Detect self-closing form: [godam_video_gallery ... /] (rare for this
		// shortcode but possible). Falls back to the standard open/close shape.
		$is_self_closing = ( isset( $identical[4] ) && '/' === substr( trim( $identical[4] ), -1 ) );

		if ( $is_self_closing ) {
			return '[godam_video_gallery' . $attr_string . ' /]';
		}

		if ( '' === $closing_tag && '' === $enclosed_content ) {
			return '[godam_video_gallery' . $attr_string . ']';
		}

		return '[godam_video_gallery' . $attr_string . ']' . $enclosed_content . '[/godam_video_gallery]';
	}

	/**
	 * Apply the V1 → V2 attribute mapping to a single shortcode's attrs.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $attrs Attrs parsed from a single shortcode instance.
	 * @return array V2-shaped attrs.
	 */
	public static function rewrite_attrs( array $attrs ): array {
		$new_attrs = $attrs;

		// columns (1-6 int) → item_width (S/M/L).
		if ( ! isset( $new_attrs['item_width'] ) && isset( $new_attrs['columns'] ) ) {
			$columns                 = (int) $new_attrs['columns'];
			$new_attrs['item_width'] = Gallery_V1_To_V2::COLUMNS_TO_ITEM_SIZE_MAP[ $columns ] ?? 'S';
		}

		// layout=list → layout=grid (V2 has no list layout).
		if ( isset( $new_attrs['layout'] ) && 'list' === strtolower( (string) $new_attrs['layout'] ) ) {
			$new_attrs['layout'] = 'grid';
		}

		// Drop V1-only / WPBakery-only keys.
		foreach ( self::DROPPED_KEYS as $dropped ) {
			unset( $new_attrs[ $dropped ] );
		}

		// Default new V2 keys when absent so the saved shortcode reads
		// like a freshly-authored V2 instance.
		$defaults = array(
			'mode'             => 'query',
			'item_width'       => 'S',
			'view_ratio'       => '16:9',
			'performance_mode' => 'balanced',
		);

		foreach ( $defaults as $key => $value ) {
			if ( ! isset( $new_attrs[ $key ] ) ) {
				$new_attrs[ $key ] = $value;
			}
		}

		return $new_attrs;
	}
}
