<?php
/**
 * Migration: Elementor godam-gallery widget V1 → V2.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Migrates all saved Elementor `godam-gallery` widget instances to match the
 * godam/gallery-v2 block's attribute set.
 *
 * Runs once per site; completion is recorded in the WordPress option
 * `rtgodam_elementor_gallery_widget_v1_v2_migration_done`. Re-run is possible
 * by deleting that option.
 *
 * ## Attribute mapping (V1 → V2)
 *
 * | V1 setting              | V2 setting          | Notes                                              |
 * |-------------------------|---------------------|----------------------------------------------------|
 * | columns (Slider)        | item_width (Select) | See Gallery_V1_To_V2::COLUMNS_TO_ITEM_SIZE_MAP     |
 * | layout='list'           | layout='grid'       | V2 has no list layout                              |
 * | order (DESC/ASC)        | order (desc/asc)    | normalised to lowercase                            |
 * | category                | (dropped)           | V2 query does not support category filter          |
 * | tag                     | (dropped)           | V2 query does not support tag filter               |
 * | search                  | (dropped)           | V2 query does not support search filter            |
 * | include (Repeater)      | (dropped)           | V2 does not support include                        |
 * | (absent)                | item_width='S'      | new default                                        |
 * | (absent)                | view_ratio='16:9'   | new default                                        |
 * | (absent)                | performance_mode    | new default 'balanced'                             |
 * | (absent)                | enable_more_items   | new default '' (off)                               |
 * | (absent)                | more_items_behavior | new default 'button'                               |
 */
class Elementor_Gallery_Widget_V1_To_V2 {

	/**
	 * WordPress option key that records migration completion.
	 *
	 * @var string
	 */
	const OPTION_KEY = 'rtgodam_elementor_gallery_widget_v1_v2_migration_done';

	/**
	 * WordPress option key used as a short-lived concurrency lock.
	 *
	 * @var string
	 */
	const LOCK_KEY = 'rtgodam_elementor_gallery_widget_v1_v2_migration_lock';

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
	 * Run the migration if it has not yet completed.
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
			// Direct DB query: keyset-paginate over posts with an Elementor
			// godam-gallery widget. LIKE is a coarse prefilter; a precise
			// confirmation check runs inside the loop before any write.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT p.ID
					 FROM {$wpdb->posts} p
					 INNER JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID
					 WHERE pm.meta_key = '_elementor_data'
					   AND pm.meta_value LIKE %s
					   AND p.ID > %d
					   AND p.post_status NOT IN ('auto-draft', 'trash')
					 ORDER BY p.ID ASC
					 LIMIT %d",
					'%' . $wpdb->esc_like( '"widgetType":"godam-gallery"' ) . '%',
					$last_id,
					self::BATCH_SIZE
				)
			);

			if ( empty( $rows ) ) {
				break;
			}

			foreach ( $rows as $row ) {
				$post_id = (int) $row->ID;
				$raw     = get_post_meta( $post_id, '_elementor_data', true );

				if ( ! is_string( $raw ) || '' === $raw ) {
					++$skipped;
					continue;
				}

				$elements = json_decode( $raw, true );

				if ( ! is_array( $elements ) ) {
					++$failed;
					continue;
				}

				$changed      = false;
				$new_elements = self::migrate_elements( $elements, $changed );

				if ( ! $changed ) {
					++$skipped;
					continue;
				}

				$result = update_post_meta(
					$post_id,
					'_elementor_data',
					wp_slash( wp_json_encode( $new_elements, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) )
				);

				if ( false === $result ) {
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
				'[GoDAM] Elementor godam-gallery widget V1→V2 migration complete. Updated: %d post(s). Skipped: %d post(s). Failed: %d post(s).',
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
	 * @return void
	 */
	private static function release_lock(): void {
		delete_option( self::LOCK_KEY );
	}

	// -------------------------------------------------------------------------
	// Element tree helpers
	// -------------------------------------------------------------------------

	/**
	 * Recursively walk the Elementor element tree, migrating every
	 * godam-gallery widget's settings in place.
	 *
	 * @param array $elements Element tree (sections, columns, widgets).
	 * @param bool  $changed  Reference set to true when any settings were rewritten.
	 * @return array
	 */
	private static function migrate_elements( array $elements, bool &$changed ): array {
		foreach ( $elements as $index => $element ) {
			if ( isset( $element['widgetType'] ) && 'godam-gallery' === $element['widgetType'] ) {
				$old_settings = isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : array();
				$new_settings = self::migrate_settings( $old_settings );

				if ( $new_settings !== $old_settings ) {
					$elements[ $index ]['settings'] = $new_settings;
					$changed                        = true;
				}
			}

			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				$elements[ $index ]['elements'] = self::migrate_elements( $element['elements'], $changed );
			}
		}

		return $elements;
	}

	/**
	 * Migrate a single godam-gallery widget's settings array.
	 *
	 * @param array $settings V1 settings.
	 * @return array V2 settings.
	 */
	private static function migrate_settings( array $settings ): array {
		$migrated = $settings;

		// columns (Slider, ['size' => int]) → item_width (S/M/L).
		// V1 default was 3 cols; if `columns` was never explicitly saved we
		// still want the new item_width to land at S to preserve density.
		$columns = 3;
		if ( isset( $migrated['columns'] ) && is_array( $migrated['columns'] ) && isset( $migrated['columns']['size'] ) ) {
			$columns = (int) $migrated['columns']['size'];
		}

		if ( ! isset( $migrated['item_width'] ) || ! in_array( $migrated['item_width'], array( 'S', 'M', 'L' ), true ) ) {
			$migrated['item_width'] = Gallery_V1_To_V2::COLUMNS_TO_ITEM_SIZE_MAP[ $columns ] ?? 'S';
		}

		unset( $migrated['columns'] );

		// layout: V1 supported list; V2 supports grid|carousel only.
		if ( isset( $migrated['layout'] ) && 'list' === $migrated['layout'] ) {
			$migrated['layout'] = 'grid';
		}

		// order: V1 stored "DESC"/"ASC"; V2 stores lowercase to match block.
		if ( isset( $migrated['order'] ) && is_string( $migrated['order'] ) ) {
			$migrated['order'] = strtolower( $migrated['order'] );
		}

		// Drop unsupported V1 controls.
		unset( $migrated['category'], $migrated['tag'], $migrated['search'], $migrated['include'] );

		// Default new controls when absent so the rendered output matches the
		// widget panel's new defaults rather than empty strings.
		if ( ! isset( $migrated['view_ratio'] ) || ! in_array( $migrated['view_ratio'], array( '16:9', '4:3', '9:16', '3:4', '1:1' ), true ) ) {
			$migrated['view_ratio'] = '16:9';
		}

		if ( ! isset( $migrated['performance_mode'] ) || ! in_array( $migrated['performance_mode'], array( 'balanced', 'priority' ), true ) ) {
			$migrated['performance_mode'] = 'balanced';
		}

		if ( ! isset( $migrated['enable_more_items'] ) ) {
			$migrated['enable_more_items'] = '';
		}

		if ( ! isset( $migrated['more_items_behavior'] ) || ! in_array( $migrated['more_items_behavior'], array( 'button', 'infinite' ), true ) ) {
			$migrated['more_items_behavior'] = 'button';
		}

		if ( ! isset( $migrated['media_folder'] ) ) {
			$migrated['media_folder'] = array();
		}

		return $migrated;
	}
}
