<?php
/**
 * Vimeo migration source: Advanced Custom Fields.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Vimeo_Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Class Acf_Source
 *
 * Replaces Vimeo links in ACF oEmbed and URL fields stored on posts with the
 * GoDAM share URL of the same video. GoDAM is an oEmbed provider for those
 * URLs, so oEmbed fields render the GoDAM player.
 *
 * Subfields of Group, Repeater and Flexible Content fields are stored as
 * their own post meta rows with their own field reference, so they are
 * covered too. Options pages, term meta, user meta and ACF blocks are not.
 *
 * @since n.e.x.t
 */
class Acf_Source {

	/**
	 * Source slug used in the migration status.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const SLUG = 'acf';

	/**
	 * ACF field types whose Vimeo links are replaced.
	 *
	 * @since n.e.x.t
	 *
	 * @var string[]
	 */
	const FIELD_TYPES = array( 'oembed', 'url' );

	/**
	 * Callable that resolves a Vimeo URL to its GoDAM video, see Vimeo_Resolver::resolve().
	 *
	 * @since n.e.x.t
	 *
	 * @var callable
	 */
	private $resolve;

	/**
	 * Callable that returns an ACF field array for a field key.
	 *
	 * @since n.e.x.t
	 *
	 * @var callable
	 */
	private $get_field;

	/**
	 * Constructor.
	 *
	 * @since n.e.x.t
	 *
	 * @param callable      $resolve   Takes a Vimeo URL, returns the GoDAM video array or null.
	 * @param callable|null $get_field Takes an ACF field key, returns the field array or false. Defaults to acf_get_field().
	 */
	public function __construct( callable $resolve, ?callable $get_field = null ) {
		$this->resolve   = $resolve;
		$this->get_field = null !== $get_field ? $get_field : 'acf_get_field';
	}

	/**
	 * Whether ACF is active on this site.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public static function is_active(): bool {
		return function_exists( 'acf_get_field' );
	}

	/**
	 * Find the posts with a field value that mentions vimeo.com.
	 *
	 * The LIKE is a coarse prefilter; migrate_post() checks the field type.
	 *
	 * @since n.e.x.t
	 *
	 * @return int[] Post IDs, ascending.
	 */
	public static function find_post_ids(): array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$ids = $wpdb->get_col( // godam-coverage-ignore -- find_post_ids(): discovery query over host posts' own field values; attachments and revisions are excluded by post_type.
			$wpdb->prepare(
				"SELECT DISTINCT p.ID
				 FROM {$wpdb->posts} p
				 INNER JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID
				 WHERE pm.meta_key NOT LIKE %s
				   AND pm.meta_value LIKE %s
				   AND p.post_type NOT IN ('revision', 'attachment')
				   AND p.post_status NOT IN ('auto-draft', 'trash', 'inherit')
				 ORDER BY p.ID ASC",
				$wpdb->esc_like( '_' ) . '%',
				'%' . $wpdb->esc_like( 'vimeo.com' ) . '%'
			)
		);

		return array_map( 'intval', is_array( $ids ) ? $ids : array() );
	}

	/**
	 * Migrate the Vimeo links in one post's ACF oEmbed and URL fields.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $post_id Post ID.
	 *
	 * @return array{changed: bool, found: int, migrated: int}
	 */
	public function migrate_post( int $post_id ): array {
		$meta = get_post_meta( $post_id ); // godam-coverage-ignore -- migrate_post(): reads the host post's own field values, never attachment data.

		$counts  = array(
			'found'    => 0,
			'migrated' => 0,
		);
		$updates = $this->migrate_meta( is_array( $meta ) ? $meta : array(), $counts );

		foreach ( $updates as $meta_key => $value ) {
			update_post_meta( $post_id, $meta_key, $value ); // godam-coverage-ignore -- migrate_post(): writes the host post's own field value, never attachment data.
		}

		return array(
			'changed'  => ! empty( $updates ),
			'found'    => $counts['found'],
			'migrated' => $counts['migrated'],
		);
	}

	/**
	 * Work out the new values of a post's ACF fields that hold a Vimeo link.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $meta   All post meta, as get_post_meta( $post_id ) returns it: key => list of values.
	 * @param array $counts Running `found` / `migrated` counts (by reference).
	 *
	 * @return array<string, string> Meta key => new value, for the fields to update.
	 */
	public function migrate_meta( array $meta, array &$counts ): array {
		$updates = array();

		/**
		 * Filters the ACF field types whose Vimeo links the Vimeo migration replaces.
		 *
		 * The new value is the video's GoDAM share URL, so only add field
		 * types that render or store a URL.
		 *
		 * @since n.e.x.t
		 *
		 * @param string[] $field_types ACF field types. Default 'oembed' and 'url'.
		 */
		$field_types = (array) apply_filters( 'rtgodam_vimeo_migration_acf_field_types', self::FIELD_TYPES );

		foreach ( $meta as $meta_key => $values ) {
			$meta_key = (string) $meta_key;

			if ( '' === $meta_key || '_' === $meta_key[0] ) {
				continue;
			}

			$value = is_array( $values ) ? ( $values[0] ?? null ) : $values;

			if ( ! is_string( $value ) || ! Vimeo_Url::is_vimeo_url( $value ) ) {
				continue;
			}

			$reference = $meta[ '_' . $meta_key ] ?? null;
			$reference = is_array( $reference ) ? ( $reference[0] ?? '' ) : $reference;

			if ( ! is_string( $reference ) || 0 !== strpos( $reference, 'field_' ) ) {
				continue;
			}

			$field = call_user_func( $this->get_field, $reference );

			if ( ! is_array( $field ) || ! in_array( $field['type'] ?? '', $field_types, true ) ) {
				continue;
			}

			++$counts['found'];

			$video = call_user_func( $this->resolve, trim( $value ) );

			if ( ! is_array( $video ) || empty( $video['share_url'] ) ) {
				continue;
			}

			$updates[ $meta_key ] = (string) $video['share_url'];
			++$counts['migrated'];
		}

		return $updates;
	}
}
