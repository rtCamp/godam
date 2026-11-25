<?php
/**
 * Vimeo migration source: WPBakery.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Vimeo_Migration;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Seo;

/**
 * Class WPBakery_Source
 *
 * Replaces WPBakery's Video Player element (`[vc_video]`), when its link is a
 * Vimeo URL, with the GoDAM Video element (`[godam_video]`).
 *
 * @since n.e.x.t
 */
class WPBakery_Source {

	/**
	 * Source slug used in the migration status.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const SLUG = 'wpbakery';

	/**
	 * Shortcode tag of WPBakery's Video Player element.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const VIDEO_TAG = 'vc_video';

	/**
	 * Shortcode tag of the GoDAM Video element.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const GODAM_VIDEO_TAG = 'godam_video';

	/**
	 * Callable that resolves a Vimeo URL to its GoDAM video, see Vimeo_Resolver::resolve().
	 *
	 * @since n.e.x.t
	 *
	 * @var callable
	 */
	private $resolve;

	/**
	 * Vimeo videos found and replaced by the last migrate_content() call.
	 *
	 * @since n.e.x.t
	 *
	 * @var array{found: int, migrated: int}
	 */
	private $counts = array(
		'found'    => 0,
		'migrated' => 0,
	);

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
	 * Whether WPBakery is active on this site.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public static function is_active(): bool {
		if ( defined( 'WPB_VC_VERSION' ) ) {
			return true;
		}

		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		return is_plugin_active( 'js_composer/js_composer.php' );
	}

	/**
	 * Find the posts whose content has a WPBakery Video Player element with a Vimeo link.
	 *
	 * The LIKEs are a coarse prefilter; migrate_content() decides what to change.
	 *
	 * @since n.e.x.t
	 *
	 * @return int[] Post IDs, ascending.
	 */
	public static function find_post_ids(): array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$ids = $wpdb->get_col( // godam-coverage-ignore -- find_post_ids(): discovery query over host posts' own post_content; attachments and revisions are excluded by post_type.
			$wpdb->prepare(
				"SELECT ID
				 FROM {$wpdb->posts}
				 WHERE post_content LIKE %s
				   AND post_content LIKE %s
				   AND post_type NOT IN ('revision', 'attachment')
				   AND post_status NOT IN ('auto-draft', 'trash', 'inherit')
				 ORDER BY ID ASC",
				'%' . $wpdb->esc_like( '[' . self::VIDEO_TAG ) . '%',
				'%' . $wpdb->esc_like( 'vimeo' ) . '%'
			)
		);

		return array_map( 'intval', is_array( $ids ) ? $ids : array() );
	}

	/**
	 * Replace every Vimeo `[vc_video]` in the content with `[godam_video]`.
	 *
	 * Content without a replaceable element comes back byte-identical.
	 * Read the counts with get_counts() afterwards.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $content Post content.
	 *
	 * @return string The migrated content.
	 */
	public function migrate_content( string $content ): string {
		$this->counts = array(
			'found'    => 0,
			'migrated' => 0,
		);

		if ( false === strpos( $content, '[' . self::VIDEO_TAG ) ) {
			return $content;
		}

		$pattern = '/' . get_shortcode_regex( array( self::VIDEO_TAG ) ) . '/s';
		$result  = preg_replace_callback( $pattern, array( $this, 'rewrite_match' ), $content );

		return null !== $result ? $result : $content;
	}

	/**
	 * Vimeo videos found and replaced by the last migrate_content() call.
	 *
	 * @since n.e.x.t
	 *
	 * @return array{found: int, migrated: int}
	 */
	public function get_counts(): array {
		return $this->counts;
	}

	/**
	 * Rewrite a single `[vc_video]` match.
	 *
	 * Capture groups from get_shortcode_regex(): 1 and 6 are the extra
	 * brackets of an escaped `[[vc_video]]`, 3 is the attribute string.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $matches Regex match.
	 *
	 * @return string The replacement, or the original shortcode.
	 */
	private function rewrite_match( array $matches ): string {
		$original = $matches[0];

		// An escaped [[vc_video]] is shown as text, not rendered: leave it.
		if ( '[' === ( $matches[1] ?? '' ) && ']' === ( $matches[6] ?? '' ) ) {
			return $original;
		}

		$attrs = shortcode_parse_atts( $matches[3] ?? '' );
		$attrs = is_array( $attrs ) ? $attrs : array();
		$link  = isset( $attrs['link'] ) ? Seo::decode_wpbakery_param( $attrs['link'] ) : '';

		if ( ! Vimeo_Url::is_vimeo_url( $link ) ) {
			return $original;
		}

		++$this->counts['found'];

		$video = call_user_func( $this->resolve, trim( $link ) );

		if ( ! is_array( $video ) || empty( $video['id'] ) ) {
			return $original;
		}

		++$this->counts['migrated'];

		return self::build_godam_video_shortcode( $attrs, $video );
	}

	/**
	 * Build the `[godam_video]` shortcode that replaces a `[vc_video]`.
	 *
	 * Keeps the Design Options (`css`), so its `.vc_custom_*` rule in
	 * `_wpb_shortcodes_custom_css` still applies. The GoDAM element has no
	 * title, width, alignment, CSS animation, extra class or element ID, so
	 * those are dropped.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $attrs Attributes of the `[vc_video]`.
	 * @param array $video GoDAM video, see Vimeo_Resolver::resolve().
	 *
	 * @return string
	 */
	public static function build_godam_video_shortcode( array $attrs, array $video ): string {
		// WPBakery's Video Player defaults to 16:9; the GoDAM element offers 16:9 or the video's own ratio.
		$aspect = isset( $attrs['el_aspect'] ) ? (string) $attrs['el_aspect'] : '169';

		$new_attrs = array(
			'id'           => (string) (int) $video['id'],
			'aspect_ratio' => '169' === $aspect ? '16:9' : 'responsive',
		);

		if ( ! empty( $attrs['css'] ) ) {
			$new_attrs['css'] = (string) $attrs['css'];
		}

		$attr_string = '';

		foreach ( $new_attrs as $key => $value ) {
			$attr_string .= ' ' . $key . '="' . str_replace( '"', '``', $value ) . '"';
		}

		return '[' . self::GODAM_VIDEO_TAG . $attr_string . ']';
	}
}
