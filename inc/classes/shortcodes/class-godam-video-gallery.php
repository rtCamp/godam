<?php
/**
 * GoDAM Video Gallery Shortcode Class.
 *
 * Delegates to inc/templates/godam-video-gallery.php so the shortcode produces
 * the same markup and JS contract as the `godam/gallery-v2` block. The
 * shortcode-specific attribute names are mapped to the block-shaped camelCase
 * keys the template expects.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Shortcodes;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class GoDAM_Video_Gallery.
 *
 * Handles [godam_video_gallery] shortcode.
 */
class GoDAM_Video_Gallery {
	use Singleton;

	/**
	 * Constructor.
	 */
	final protected function __construct() {
		add_shortcode( 'godam_video_gallery', array( $this, 'render' ) );
	}

	/**
	 * Render the video gallery shortcode.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output of the gallery.
	 */
	public function render( $atts ) {
		$atts = shortcode_atts(
			array(
				'mode'                => 'query',
				'ids'                 => '',
				'count'               => 6,
				'orderby'             => 'date',
				'order'               => 'desc',
				'layout'              => 'grid',
				'item_width'          => 'S',
				'view_ratio'          => '16:9',
				'infinite_scroll'     => false,
				'enable_more_items'   => false,
				'more_items_behavior' => 'button',
				'media_folder'        => '',
				'author'              => '',
				'date_range'          => '',
				'custom_date_start'   => '',
				'custom_date_end'     => '',
				'show_title'          => true,
				'performance_mode'    => 'balanced',
				'engagements'         => true,
			),
			$atts,
			'godam_video_gallery'
		);

		foreach ( array( 'infinite_scroll', 'enable_more_items', 'show_title', 'engagements' ) as $bool_key ) {
			$atts[ $bool_key ] = filter_var( $atts[ $bool_key ], FILTER_VALIDATE_BOOLEAN );
		}

		// Load the template now (no-op render — $attributes is not in scope yet)
		// so the rtgodam_gallery_v2_* helpers are available for the handpicked
		// IDs parse below. The actual render happens at the bottom of this
		// method via a second `require`.
		require_once RTGODAM_PATH . 'inc/templates/godam-video-gallery.php';

		$mode = 'handpicked' === sanitize_key( $atts['mode'] ) ? 'handpicked' : 'query';

		// itemWidth is case-sensitive in the template's S/M/L → pixel map.
		// sanitize_key() lowercases, so it must be uppercased back and clamped
		// to a known token — otherwise every non-S value silently fell back to S.
		$item_width = strtoupper( (string) $atts['item_width'] );
		if ( ! in_array( $item_width, array( 'S', 'M', 'L' ), true ) ) {
			$item_width = 'S';
		}

		// Map snake_case shortcode keys to the block-shaped camelCase keys the
		// shared template consumes. Drops nothing: shortcode_atts has already
		// constrained the attribute set to the block-aligned list above.
		$attributes = array(
			'mode'              => $mode,
			'count'             => max( 1, absint( $atts['count'] ) ),
			'orderby'           => sanitize_key( $atts['orderby'] ),
			'order'             => strtolower( sanitize_key( $atts['order'] ) ),
			'layout'            => sanitize_key( $atts['layout'] ),
			'itemWidth'         => $item_width,
			'viewRatio'         => $atts['view_ratio'],
			'infiniteScroll'    => $atts['infinite_scroll'],
			'enableMoreItems'   => $atts['enable_more_items'],
			'moreItemsBehavior' => sanitize_key( $atts['more_items_behavior'] ),
			'mediaFolder'       => $atts['media_folder'],
			'author'            => $atts['author'],
			'dateRange'         => sanitize_key( $atts['date_range'] ),
			'customDateStart'   => $atts['custom_date_start'],
			'customDateEnd'     => $atts['custom_date_end'],
			'showTitle'         => $atts['show_title'],
			'performanceMode'   => sanitize_key( $atts['performance_mode'] ),
			'engagements'       => $atts['engagements'],
		);

		// Enqueue the block's frontend assets so the shortcode reuses the same
		// view.js / style-index.css as the godam/gallery-v2 block.
		wp_enqueue_script( 'godam-gallery-v2-view-script' );
		wp_enqueue_style( 'godam-gallery-v2-style' );

		if ( ! is_admin() ) {
			wp_enqueue_script( 'godam-player-frontend-script' );
			wp_enqueue_script( 'godam-player-analytics-script' );
			wp_enqueue_style( 'godam-player-style' );
		}

		$is_shortcode = true;

		// In handpicked mode, route the comma-separated `ids` attr through the
		// same $inner_block_video_ids path the block uses for its inner
		// godam/gallery-v2-item blocks.
		$inner_block_video_ids = 'handpicked' === $mode
			? rtgodam_gallery_v2_parse_id_list( $atts['ids'] )
			: array();

		ob_start();
		require RTGODAM_PATH . 'inc/templates/godam-video-gallery.php';
		return ob_get_clean();
	}
}
