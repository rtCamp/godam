<?php
/**
 * WPBakery GoDAM Video Gallery Element.
 *
 * Mirrors the godam/gallery-v2 Gutenberg block. Since `base => 'godam_video_gallery'`
 * tells WPBakery to render the element by emitting the underlying shortcode,
 * the element inherits the shortcode's aligned behaviour for free — the only
 * work here is exposing the right params in the editor.
 *
 * Param naming and groupings match the Elementor Godam_Gallery widget:
 *   - Section 1 "Gallery Settings": content selection + filters + performance.
 *   - Section 2 "Display Settings": layout / sizing / pagination / engagements.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\WPBakery_Elements;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class WPB_GoDAM_Video_Gallery
 *
 * @since 1.6.0
 *
 * @package GoDAM
 */
class WPB_GoDAM_Video_Gallery {
	use Singleton;

	/**
	 * Constructor.
	 *
	 * @since 1.6.0
	 */
	protected function __construct() {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		if ( is_plugin_active( 'js_composer/js_composer.php' ) ) {
			$this->setup_hooks();
		}
	}

	/**
	 * Setup hooks.
	 *
	 * @since 1.6.0
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( 'vc_before_init', array( $this, 'godam_video_gallery' ) );
	}

	/**
	 * Map the video gallery element to WPBakery.
	 *
	 * @since 1.6.0
	 *
	 * @return void
	 */
	public function godam_video_gallery() {
		if ( ! function_exists( 'vc_map' ) ) {
			return;
		}

		$gallery_group = esc_html__( 'Gallery Settings', 'godam' );
		$display_group = esc_html__( 'Display Settings', 'godam' );

		$params = array(
			// -----------------------------------------------------------------
			// Gallery Settings — content + filters + performance.
			// -----------------------------------------------------------------
			array(
				'type'        => 'dropdown',
				'heading'     => esc_html__( 'Mode', 'godam' ),
				'param_name'  => 'mode',
				'value'       => array(
					esc_html__( 'Query (filter videos)', 'godam' )      => 'query',
					esc_html__( 'Handpicked (pick videos)', 'godam' )   => 'handpicked',
				),
				'std'         => 'query',
				'description' => esc_html__( 'Query: filter from the media library. Handpicked: choose specific videos in order.', 'godam' ),
				'group'       => $gallery_group,
			),
			array(
				'type'        => 'param_group',
				'heading'     => esc_html__( 'Videos', 'godam' ),
				'param_name'  => 'handpicked_items',
				'description' => esc_html__( 'Pick one video per row. Order in the list determines display order.', 'godam' ),
				'group'       => $gallery_group,
				'dependency'  => array(
					'element' => 'mode',
					'value'   => 'handpicked',
				),
				'params'      => array(
					array(
						'type'        => 'video_selector',
						'heading'     => esc_html__( 'Video', 'godam' ),
						'param_name'  => 'video_id',
						'description' => esc_html__( 'Only video attachments are valid here.', 'godam' ),
					),
				),
			),
			array(
				'type'        => 'textfield',
				'heading'     => esc_html__( 'Number of Videos', 'godam' ),
				'param_name'  => 'count',
				'value'       => '6',
				'description' => esc_html__( 'Number of videos to display (1-30).', 'godam' ),
				'group'       => $gallery_group,
				'dependency'  => array(
					'element' => 'mode',
					'value'   => 'query',
				),
			),
			array(
				'type'        => 'dropdown',
				'heading'     => esc_html__( 'Order By', 'godam' ),
				'param_name'  => 'orderby',
				'value'       => array(
					esc_html__( 'Date', 'godam' )     => 'date',
					esc_html__( 'Title', 'godam' )    => 'title',
					esc_html__( 'Duration', 'godam' ) => 'duration',
					esc_html__( 'Size', 'godam' )     => 'size',
				),
				'std'         => 'date',
				'description' => esc_html__( 'Sort videos by.', 'godam' ),
				'group'       => $gallery_group,
				'dependency'  => array(
					'element' => 'mode',
					'value'   => 'query',
				),
			),
			array(
				'type'        => 'dropdown',
				'heading'     => esc_html__( 'Order', 'godam' ),
				'param_name'  => 'order',
				'value'       => array(
					esc_html__( 'Descending', 'godam' ) => 'desc',
					esc_html__( 'Ascending', 'godam' )  => 'asc',
				),
				'std'         => 'desc',
				'description' => esc_html__( 'Sort order.', 'godam' ),
				'group'       => $gallery_group,
				'dependency'  => array(
					'element' => 'mode',
					'value'   => 'query',
				),
			),
			array(
				'type'        => 'dropdown',
				'heading'     => esc_html__( 'Media Folder', 'godam' ),
				'param_name'  => 'media_folder',
				'value'       => $this->get_media_folders_for_dropdown(),
				'std'         => '',
				'description' => esc_html__( 'Limit results to a single media folder.', 'godam' ),
				'group'       => $gallery_group,
				'dependency'  => array(
					'element' => 'mode',
					'value'   => 'query',
				),
			),
			array(
				'type'        => 'dropdown',
				'heading'     => esc_html__( 'Author', 'godam' ),
				'param_name'  => 'author',
				'value'       => $this->get_authors_for_dropdown(),
				'std'         => '',
				'description' => esc_html__( 'Limit results to videos uploaded by one user.', 'godam' ),
				'group'       => $gallery_group,
				'dependency'  => array(
					'element' => 'mode',
					'value'   => 'query',
				),
			),
			array(
				'type'        => 'dropdown',
				'heading'     => esc_html__( 'Date Range', 'godam' ),
				'param_name'  => 'date_range',
				'value'       => array(
					esc_html__( 'All Time', 'godam' )     => '',
					esc_html__( 'Last 7 Days', 'godam' )  => '7days',
					esc_html__( 'Last 30 Days', 'godam' ) => '30days',
					esc_html__( 'Last 90 Days', 'godam' ) => '90days',
					esc_html__( 'Custom Range', 'godam' ) => 'custom',
				),
				'std'         => '',
				'description' => esc_html__( 'Filter by date range.', 'godam' ),
				'group'       => $gallery_group,
				'dependency'  => array(
					'element' => 'mode',
					'value'   => 'query',
				),
			),
			array(
				'type'        => 'textfield',
				'heading'     => esc_html__( 'Custom Start Date', 'godam' ),
				'param_name'  => 'custom_date_start',
				'description' => esc_html__( 'Start date in YYYY-MM-DD format.', 'godam' ),
				'group'       => $gallery_group,
				'dependency'  => array(
					'element' => 'date_range',
					'value'   => 'custom',
				),
			),
			array(
				'type'        => 'textfield',
				'heading'     => esc_html__( 'Custom End Date', 'godam' ),
				'param_name'  => 'custom_date_end',
				'description' => esc_html__( 'End date in YYYY-MM-DD format.', 'godam' ),
				'group'       => $gallery_group,
				'dependency'  => array(
					'element' => 'date_range',
					'value'   => 'custom',
				),
			),
			array(
				'type'        => 'dropdown',
				'heading'     => esc_html__( 'Performance Mode', 'godam' ),
				'param_name'  => 'performance_mode',
				'value'       => array(
					esc_html__( 'Balanced', 'godam' ) => 'balanced',
					esc_html__( 'Priority', 'godam' ) => 'priority',
				),
				'std'         => 'balanced',
				'description' => esc_html__( 'Priority preloads leading thumbnails with fetchpriority="high".', 'godam' ),
				'group'       => $gallery_group,
			),

			// -----------------------------------------------------------------
			// Display Settings — visual presentation + pagination.
			// -----------------------------------------------------------------
			array(
				'type'        => 'dropdown',
				'heading'     => esc_html__( 'Layout', 'godam' ),
				'param_name'  => 'layout',
				'value'       => array(
					esc_html__( 'Grid', 'godam' )     => 'grid',
					esc_html__( 'Carousel', 'godam' ) => 'carousel',
				),
				'std'         => 'grid',
				'description' => esc_html__( 'Choose the layout style for the gallery.', 'godam' ),
				'group'       => $display_group,
			),
			array(
				'type'        => 'dropdown',
				'heading'     => esc_html__( 'Item Width', 'godam' ),
				'param_name'  => 'item_width',
				'value'       => array(
					esc_html__( 'Small (200px)', 'godam' ) => 'S',
					esc_html__( 'Medium (260px)', 'godam' ) => 'M',
					esc_html__( 'Large (320px)', 'godam' ) => 'L',
				),
				'std'         => 'S',
				'description' => esc_html__( 'Tile width in pixels.', 'godam' ),
				'group'       => $display_group,
			),
			array(
				'type'        => 'dropdown',
				'heading'     => esc_html__( 'View Ratio', 'godam' ),
				'param_name'  => 'view_ratio',
				'value'       => array(
					'16:9' => '16:9',
					'4:3'  => '4:3',
					'9:16' => '9:16',
					'3:4'  => '3:4',
					'1:1'  => '1:1',
				),
				'std'         => '16:9',
				'description' => esc_html__( 'Thumbnail aspect ratio.', 'godam' ),
				'group'       => $display_group,
			),
			array(
				'type'        => 'checkbox',
				'heading'     => esc_html__( 'Show Video Titles and Dates', 'godam' ),
				'param_name'  => 'show_title',
				'value'       => array( esc_html__( 'Yes', 'godam' ) => 'true' ),
				'std'         => 'true',
				'description' => esc_html__( 'Display video titles and upload dates beneath each tile.', 'godam' ),
				'group'       => $display_group,
			),
			array(
				'type'        => 'checkbox',
				'heading'     => esc_html__( 'Enable More Items', 'godam' ),
				'param_name'  => 'enable_more_items',
				'value'       => array( esc_html__( 'Yes', 'godam' ) => 'true' ),
				'description' => esc_html__( 'Allow the gallery to load additional videos after the initial render.', 'godam' ),
				'group'       => $display_group,
				'dependency'  => array(
					'element' => 'mode',
					'value'   => 'query',
				),
			),
			array(
				'type'        => 'dropdown',
				'heading'     => esc_html__( 'More Items Behavior', 'godam' ),
				'param_name'  => 'more_items_behavior',
				'value'       => array(
					esc_html__( 'Load More button', 'godam' ) => 'button',
					esc_html__( 'Infinite scroll', 'godam' )  => 'infinite',
				),
				'std'         => 'button',
				'description' => esc_html__( 'How additional items appear once the initial set is shown.', 'godam' ),
				'group'       => $display_group,
				'dependency'  => array(
					'element' => 'enable_more_items',
					'value'   => 'true',
				),
			),
		);

		// Match the godam/video Elementor widget + block editor: only expose the
		// engagements toggle when the global feature is enabled. The template
		// also defends via rtgodam_is_engagement_feature_enabled().
		if ( function_exists( 'rtgodam_is_engagement_feature_enabled' ) && rtgodam_is_engagement_feature_enabled() ) {
			$params[] = array(
				'type'        => 'checkbox',
				'heading'     => esc_html__( 'Enable Likes & Comments', 'godam' ),
				'param_name'  => 'engagements',
				'value'       => array( esc_html__( 'Yes', 'godam' ) => 'true' ),
				'std'         => 'true',
				'description' => esc_html__( 'Engagement layers only render for transcoded videos.', 'godam' ),
				'group'       => $display_group,
			);
		}

		// Keep WPBakery's standard Design Options tab at the end so users can
		// still wrap the gallery in custom CSS / animations.
		$params[] = array(
			'type'       => 'css_editor',
			'heading'    => esc_html__( 'Design Options', 'godam' ),
			'param_name' => 'css',
			'group'      => esc_html__( 'Design Options', 'godam' ),
		);

		vc_map(
			array(
				'name'        => esc_html__( 'GoDAM Video Gallery', 'godam' ),
				'base'        => 'godam_video_gallery',
				'category'    => esc_html__( 'GoDAM', 'godam' ),
				'description' => esc_html__( 'Embed a video gallery from the GoDAM media library.', 'godam' ),
				'icon'        => RTGODAM_URL . 'assets/images/godam-gallery-filled.svg',
				'params'      => $params,
			)
		);
	}

	/**
	 * Build the Media Folder dropdown options.
	 *
	 * Mirrors the Elementor widget's `get_media_folder_options()` and the
	 * block editor's mediaFolders query (all terms, including empty ones).
	 *
	 * @since n.e.x.t
	 *
	 * @return array<string, string>
	 */
	private function get_media_folders_for_dropdown() {
		$options = array(
			esc_html__( 'All folders', 'godam' ) => '',
		);

		$terms = get_terms(
			array(
				'taxonomy'   => 'media-folder',
				'hide_empty' => false,
			)
		);

		if ( ! is_wp_error( $terms ) && ! empty( $terms ) ) {
			$name_counts = array();
			foreach ( $terms as $term ) {
				$name_counts[ $term->name ] = ( $name_counts[ $term->name ] ?? 0 ) + 1;
			}

			foreach ( $terms as $term ) {
				$label = $term->name;
				if ( ( $name_counts[ $term->name ] ?? 0 ) > 1 ) {
					/* translators: 1: taxonomy term name, 2: term ID. */
					$label = sprintf( __( '%1$s (#%2$d)', 'godam' ), $term->name, (int) $term->term_id );
				}
				$options[ $label ] = (string) $term->term_id;
			}
		}

		return $options;
	}

	/**
	 * Build the Author dropdown options.
	 *
	 * Drops the deprecated `who => authors` arg (removed from the public
	 * API in WP 5.9; also excluded users on roles without the legacy
	 * `level_2` capability on modern sites). Same fix as the Elementor
	 * widget's `get_author_options()`.
	 *
	 * @since 1.6.0
	 *
	 * @return array<string, string>
	 */
	private function get_authors_for_dropdown() {
		$options = array(
			esc_html__( 'All authors', 'godam' ) => '',
		);

		$users = get_users(
			array(
				'fields'  => array( 'ID', 'display_name' ),
				'orderby' => 'display_name',
				'order'   => 'ASC',
			)
		);

		foreach ( $users as $user ) {
			$options[ $user->display_name ] = (string) $user->ID;
		}

		return $options;
	}
}
