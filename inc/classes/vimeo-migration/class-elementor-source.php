<?php
/**
 * Vimeo migration source: Elementor.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Vimeo_Migration;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Media_Usage_Tracker;
use RTGODAM\Inc\Seo;

/**
 * Class Elementor_Source
 *
 * Replaces Elementor's core Video widget, when its source is Vimeo, with the
 * GoDAM Video widget. Any other Elementor element that still holds a Vimeo
 * URL (a background video, a Pro widget, text) is counted as found but left
 * as it is.
 *
 * @since n.e.x.t
 */
class Elementor_Source {

	/**
	 * Source slug used in the migration status.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const SLUG = 'elementor';

	/**
	 * Post meta key holding an Elementor document's element tree.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const DATA_META_KEY = '_elementor_data';

	/**
	 * Widget type of Elementor's core Video widget.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const VIDEO_WIDGET = 'video';

	/**
	 * Widget type of the GoDAM Video widget.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const GODAM_VIDEO_WIDGET = 'godam-video';

	/**
	 * Elementor's default Vimeo URL for a Video widget whose URL was never changed.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const DEFAULT_VIMEO_URL = 'https://vimeo.com/235215203';

	/**
	 * Settings that sit outside the Advanced tab's `_` prefix but still belong
	 * to it, and so carry over to the GoDAM widget unchanged.
	 *
	 * @since n.e.x.t
	 *
	 * @var string[]
	 */
	const CARRIED_SETTINGS = array( 'hide_desktop', 'hide_laptop', 'hide_tablet', 'hide_tablet_extra', 'hide_mobile', 'hide_mobile_extra', 'hide_widescreen' );

	/**
	 * Callable that resolves a Vimeo URL to its GoDAM video, see Vimeo_Resolver::resolve().
	 *
	 * @since n.e.x.t
	 *
	 * @var callable
	 */
	private $resolve;

	/**
	 * Constructor.
	 *
	 * @since n.e.x.t
	 *
	 * @param callable $resolve Takes a Vimeo URL, returns the GoDAM video array or null.
	 */
	public function __construct( callable $resolve ) {
		$this->resolve = $resolve;
	}

	/**
	 * Whether Elementor is loaded on this site.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public static function is_active(): bool {
		return function_exists( 'did_action' ) && did_action( 'elementor/loaded' ) > 0;
	}

	/**
	 * Find the posts whose Elementor data mentions Vimeo.
	 *
	 * The LIKE is a coarse prefilter; migrate_post() decides what to change.
	 *
	 * @since n.e.x.t
	 *
	 * @return int[] Post IDs, ascending.
	 */
	public static function find_post_ids(): array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$ids = $wpdb->get_col( // godam-coverage-ignore -- find_post_ids(): discovery query over host posts' '_elementor_data'; attachments and revisions are excluded by post_type.
			$wpdb->prepare(
				"SELECT DISTINCT p.ID
				 FROM {$wpdb->posts} p
				 INNER JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID
				 WHERE pm.meta_key = %s
				   AND pm.meta_value LIKE %s
				   AND p.post_type NOT IN ('revision', 'attachment')
				   AND p.post_status NOT IN ('auto-draft', 'trash', 'inherit')
				 ORDER BY p.ID ASC",
				self::DATA_META_KEY,
				'%' . $wpdb->esc_like( 'vimeo' ) . '%'
			)
		);

		return array_map( 'intval', is_array( $ids ) ? $ids : array() );
	}

	/**
	 * Migrate the Vimeo videos in one post's Elementor data.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $post_id Post ID.
	 *
	 * @return array{changed: bool, found: int, migrated: int}
	 */
	public function migrate_post( int $post_id ): array {
		$result = array(
			'changed'  => false,
			'found'    => 0,
			'migrated' => 0,
		);

		$raw = get_post_meta( $post_id, self::DATA_META_KEY, true ); // godam-coverage-ignore -- migrate_post(): reads the host post's own '_elementor_data', never attachment data.

		if ( is_string( $raw ) && '' !== $raw ) {
			$elements = json_decode( $raw, true );
		} else {
			$elements = $raw;
		}

		if ( ! is_array( $elements ) || empty( $elements ) ) {
			return $result;
		}

		$counts  = array(
			'found'    => 0,
			'migrated' => 0,
		);
		$changed = false;

		$new_elements = $this->migrate_elements( $elements, $post_id, $counts, $changed );

		$result['found']    = $counts['found'];
		$result['migrated'] = $counts['migrated'];

		if ( ! $changed ) {
			return $result;
		}

		update_post_meta( // godam-coverage-ignore -- migrate_post(): writes the host post's own '_elementor_data' back, never attachment data.
			$post_id,
			self::DATA_META_KEY,
			wp_slash( wp_json_encode( $new_elements, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) )
		);

		$this->refresh_derived_data( $post_id );

		$result['changed'] = true;

		return $result;
	}

	/**
	 * Walk an Elementor element tree and migrate every Vimeo Video widget.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $elements Element tree (containers, sections, columns, widgets).
	 * @param int   $post_id  Post the tree belongs to, passed to the filter.
	 * @param array $counts   Running `found` / `migrated` counts (by reference).
	 * @param bool  $changed  Set to true when any element was replaced (by reference).
	 *
	 * @return array The migrated element tree.
	 */
	public function migrate_elements( array $elements, int $post_id, array &$counts, bool &$changed ): array {
		foreach ( $elements as $index => $element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}

			$elements[ $index ] = $this->migrate_element( $element, $post_id, $counts, $changed );

			if ( ! empty( $elements[ $index ]['elements'] ) && is_array( $elements[ $index ]['elements'] ) ) {
				$elements[ $index ]['elements'] = $this->migrate_elements( $elements[ $index ]['elements'], $post_id, $counts, $changed );
			}
		}

		return $elements;
	}

	/**
	 * Migrate a single element, without its children.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $element Element.
	 * @param int   $post_id Post the element belongs to.
	 * @param array $counts  Running `found` / `migrated` counts (by reference).
	 * @param bool  $changed Set to true when the element was replaced (by reference).
	 *
	 * @return array The element, replaced or unchanged.
	 */
	private function migrate_element( array $element, int $post_id, array &$counts, bool &$changed ): array {
		$widget_type = $element['widgetType'] ?? '';
		$settings    = isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : array();

		if ( self::GODAM_VIDEO_WIDGET === $widget_type ) {
			return $element;
		}

		if ( self::VIDEO_WIDGET === $widget_type && 'vimeo' === ( $settings['video_type'] ?? '' ) ) {
			++$counts['found'];

			$vimeo_url = self::get_literal_vimeo_url( $settings );

			if ( '' === $vimeo_url ) {
				return $element;
			}

			$video = call_user_func( $this->resolve, $vimeo_url );

			if ( ! is_array( $video ) || empty( $video['id'] ) || empty( $video['url'] ) ) {
				return $element;
			}

			++$counts['migrated'];
			$changed = true;

			return self::build_godam_video_element( $element, $video );
		}

		$args = array(
			'element'  => $element,
			'post_id'  => $post_id,
			'changed'  => false,
			'found'    => 0,
			'migrated' => 0,
		);

		/**
		 * Filters the migration of an Elementor element that isn't the core Video widget.
		 *
		 * Lets integrations replace Vimeo videos held by their own widgets.
		 * Set `element` to the replacement, `changed` to true, and add the
		 * number of Vimeo videos found and replaced in this element to
		 * `found` and `migrated`.
		 *
		 * @since n.e.x.t
		 *
		 * @param array            $args {
		 *     Migration arguments.
		 *
		 *     @type array $element  The Elementor element.
		 *     @type int   $post_id  ID of the post the element belongs to.
		 *     @type bool  $changed  Whether the element was replaced.
		 *     @type int   $found    Vimeo videos found in this element.
		 *     @type int   $migrated Vimeo videos replaced in this element.
		 * }
		 * @param Elementor_Source $source The Elementor source.
		 */
		$filtered = apply_filters( 'rtgodam_migrate_elementor_vimeo_element_result', $args, $this );

		if ( is_array( $filtered ) && ( ! empty( $filtered['found'] ) || ! empty( $filtered['changed'] ) ) ) {
			$counts['found']    += (int) ( $filtered['found'] ?? 0 );
			$counts['migrated'] += (int) ( $filtered['migrated'] ?? 0 );

			if ( ! empty( $filtered['changed'] ) && isset( $filtered['element'] ) && is_array( $filtered['element'] ) ) {
				$changed = true;
				return $filtered['element'];
			}

			return $element;
		}

		// A core Video widget set to another source can still store a
		// Vimeo URL from before the source was switched; it doesn't play.
		if ( self::VIDEO_WIDGET === $widget_type ) {
			unset( $settings['vimeo_url'] );
		}

		if ( self::settings_contain_vimeo_url( $settings ) ) {
			++$counts['found'];
		}

		return $element;
	}

	/**
	 * Read the literal Vimeo URL of a core Video widget.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $settings Widget settings.
	 *
	 * @return string The Vimeo URL, or '' when it comes from a dynamic tag or isn't a Vimeo URL.
	 */
	private static function get_literal_vimeo_url( array $settings ): string {
		// A dynamic tag (e.g. an ACF field) supplies the URL at render time.
		if ( ! empty( $settings['__dynamic__']['vimeo_url'] ) ) {
			return '';
		}

		$vimeo_url = isset( $settings['vimeo_url'] ) && is_string( $settings['vimeo_url'] ) ? trim( $settings['vimeo_url'] ) : self::DEFAULT_VIMEO_URL;

		return Vimeo_Url::is_vimeo_url( $vimeo_url ) ? $vimeo_url : '';
	}

	/**
	 * Build the GoDAM Video widget that replaces a core Video widget.
	 *
	 * Keeps the element's ID, so per-element custom CSS still applies, and
	 * its Advanced-tab settings. Maps the playback settings the GoDAM widget
	 * has, and drops the Vimeo-only ones (start/end time, title, portrait,
	 * byline, color).
	 *
	 * @since n.e.x.t
	 *
	 * @param array $element Core Video widget element.
	 * @param array $video   GoDAM video, see Vimeo_Resolver::resolve().
	 *
	 * @return array The GoDAM Video widget element.
	 */
	public static function build_godam_video_element( array $element, array $video ): array {
		$settings = isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : array();

		// Same shape the GoDAM media control saves when a video is picked in the
		// editor; the player builds its sources from the attachment ID.
		$url_path   = wp_parse_url( (string) $video['url'], PHP_URL_PATH );
		$video_file = array(
			'id'    => (int) $video['id'],
			'url'   => (string) $video['url'],
			'title' => (string) ( $video['title'] ?? '' ),
			'name'  => is_string( $url_path ) ? basename( $url_path ) : '',
			'icon'  => '',
		);

		$new_settings = array(
			'video-file' => $video_file,
		);

		foreach ( array(
			'autoplay' => 'autoplay',
			'mute'     => 'muted',
			'loop'     => 'loop',
			'lightbox' => 'show_in_lightbox',
		) as $from => $to ) {
			if ( 'yes' === ( $settings[ $from ] ?? '' ) ) {
				$new_settings[ $to ] = 'yes';
			}
		}

		// Elementor's Video widget defaults to 16:9; the GoDAM widget offers 16:9 or the video's own ratio.
		$aspect_ratio                 = $settings['aspect_ratio'] ?? '169';
		$new_settings['aspect_ratio'] = '169' === $aspect_ratio ? '16:9' : 'responsive';

		if ( 'yes' === ( $settings['show_image_overlay'] ?? '' ) && ! empty( $settings['image_overlay']['url'] ) ) {
			$new_settings['poster'] = array(
				'id'  => isset( $settings['image_overlay']['id'] ) ? (int) $settings['image_overlay']['id'] : '',
				'url' => (string) $settings['image_overlay']['url'],
			);
		}

		foreach ( $settings as $key => $value ) {
			$key = (string) $key;

			if ( '__dynamic__' === $key || '__globals__' === $key ) {
				$value = is_array( $value ) ? self::filter_advanced_keys( $value ) : array();

				if ( ! empty( $value ) ) {
					$new_settings[ $key ] = $value;
				}

				continue;
			}

			if ( self::is_advanced_key( $key ) ) {
				$new_settings[ $key ] = $value;
			}
		}

		$new_element = array(
			'id'         => $element['id'] ?? '',
			'elType'     => 'widget',
			'settings'   => $new_settings,
			'elements'   => array(),
			'widgetType' => self::GODAM_VIDEO_WIDGET,
		);

		if ( isset( $element['isInner'] ) ) {
			$new_element['isInner'] = $element['isInner'];
		}

		return $new_element;
	}

	/**
	 * Whether a setting belongs to the Advanced tab every widget shares.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $key Setting key.
	 *
	 * @return bool
	 */
	private static function is_advanced_key( string $key ): bool {
		return 0 === strpos( $key, '_' )
			|| 0 === strpos( $key, 'motion_fx_' )
			|| 0 === strpos( $key, 'sticky' )
			|| in_array( $key, self::CARRIED_SETTINGS, true );
	}

	/**
	 * Keep only the Advanced-tab keys of a `__dynamic__` or `__globals__` map.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $map Setting key => dynamic tag or global reference.
	 *
	 * @return array
	 */
	private static function filter_advanced_keys( array $map ): array {
		$kept = array();

		foreach ( $map as $key => $value ) {
			if ( self::is_advanced_key( (string) $key ) ) {
				$kept[ $key ] = $value;
			}
		}

		return $kept;
	}

	/**
	 * Whether any setting value holds a Vimeo URL.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $settings Element settings.
	 *
	 * @return bool
	 */
	private static function settings_contain_vimeo_url( array $settings ): bool {
		foreach ( $settings as $value ) {
			if ( is_array( $value ) && self::settings_contain_vimeo_url( $value ) ) {
				return true;
			}

			if ( is_string( $value ) && 1 === preg_match( '#(?:https?:)?//(?:www\.|player\.)?vimeo\.com/#i', $value ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Refresh what Elementor and GoDAM derive from a post's Elementor data.
	 *
	 * The new data is written straight to post meta, so `save_post` doesn't
	 * fire: clear Elementor's generated CSS and element caches so they
	 * rebuild from the new widgets, and update GoDAM's video SEO schema and
	 * media usage for the post.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $post_id Post ID.
	 *
	 * @return void
	 */
	private function refresh_derived_data( int $post_id ): void {
		if ( class_exists( '\Elementor\Core\Files\CSS\Post' ) ) {
			\Elementor\Core\Files\CSS\Post::create( $post_id )->delete();
		}

		delete_post_meta( $post_id, '_elementor_css' ); // godam-coverage-ignore -- refresh_derived_data(): clears the host post's own Elementor CSS cache meta, never attachment data.
		delete_post_meta( $post_id, '_elementor_element_cache' ); // godam-coverage-ignore -- refresh_derived_data(): clears the host post's own Elementor element cache meta, never attachment data.
		delete_post_meta( $post_id, '_elementor_page_assets' ); // godam-coverage-ignore -- refresh_derived_data(): clears the host post's own Elementor page assets meta, never attachment data.

		if ( class_exists( Seo::class ) ) {
			Seo::get_instance()->elementor_save_seo_data_as_postmeta( $post_id );
		}

		$post = get_post( $post_id ); // godam-coverage-ignore -- refresh_derived_data(): loads the host post to rescan its media usage, never an attachment.

		if ( $post instanceof \WP_Post && class_exists( Media_Usage_Tracker::class ) ) {
			Media_Usage_Tracker::get_instance()->on_save_post( $post_id, $post );
		}
	}
}
