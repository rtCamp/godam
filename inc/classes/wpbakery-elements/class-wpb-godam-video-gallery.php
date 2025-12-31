<?php
/**
 * WPBakery GoDAM Video Gallery Element
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\WPBakery_Elements;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class WPB_GoDAM_Video_Gallery
 * 
 * @since n.e.x.t
 *
 * @package GoDAM
 */
class WPB_GoDAM_Video_Gallery {
	use Singleton;

	/**
	 * WPB_GoDAM_Video_Gallery constructor.
	 * 
	 * @since n.e.x.t
	 */
	protected function __construct() {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$is_wpbakery_active = is_plugin_active( 'js_composer/js_composer.php' );

		if ( $is_wpbakery_active ) {
			$this->setup_hooks();
		}
	}

	/**
	 * Setup hooks.
	 * 
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( 'vc_before_init', array( $this, 'godam_video_gallery' ) );
	}

	/**
	 * Map video gallery element to WPBakery.
	 * 
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function godam_video_gallery() {
		if ( ! function_exists( 'vc_map' ) ) {
			return;
		}

		vc_map(
			array(
				'name'        => esc_html__( 'GoDAM Video Gallery', 'godam' ),
				'base'        => 'godam_video_gallery',
				'category'    => esc_html__( 'GoDAM', 'godam' ),
				'description' => esc_html__( 'Embed video gallery from GoDAM Media Library', 'godam' ),
				'icon'        => RTGODAM_URL . 'assets/src/images/godam-gallery-filled.svg',
				'params'      => array(
					// Layout Settings.
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Layout', 'godam' ),
						'param_name'  => 'layout',
						'value'       => array(
							esc_html__( 'Grid', 'godam' ) => 'grid',
							esc_html__( 'List', 'godam' ) => 'list',
						),
						'std'         => 'grid',
						'description' => esc_html__( 'Choose the layout style for the gallery', 'godam' ),
						'group'       => esc_html__( 'Layout', 'godam' ),
					),
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Number of Columns', 'godam' ),
						'param_name'  => 'columns',
						'value'       => array(
							'1' => '1',
							'2' => '2',
							'3' => '3',
							'4' => '4',
							'5' => '5',
							'6' => '6',
						),
						'std'         => '3',
						'description' => esc_html__( 'Number of columns in grid layout', 'godam' ),
						'dependency'  => array(
							'element' => 'layout',
							'value'   => 'grid',
						),
						'group'       => esc_html__( 'Layout', 'godam' ),
					),
					array(
						'type'        => 'checkbox',
						'heading'     => esc_html__( 'Show Video Titles and Dates', 'godam' ),
						'param_name'  => 'show_title',
						'value'       => array( esc_html__( 'Yes', 'godam' ) => 'true' ),
						'std'         => 'true',
						'description' => esc_html__( 'Display video titles and upload dates', 'godam' ),
						'dependency'  => array(
							'element' => 'layout',
							'value'   => 'grid',
						),
						'group'       => esc_html__( 'Layout', 'godam' ),
					),
					array(
						'type'        => 'checkbox',
						'heading'     => esc_html__( 'Enable Infinite Scroll', 'godam' ),
						'param_name'  => 'infinite_scroll',
						'value'       => array( esc_html__( 'Yes', 'godam' ) => 'true' ),
						'description' => esc_html__( 'Automatically load more videos when scrolling', 'godam' ),
						'group'       => esc_html__( 'Layout', 'godam' ),
					),
					array(
						'type'        => 'checkbox',
						'heading'     => esc_html__( 'Enable Likes & Comments', 'godam' ),
						'param_name'  => 'engagements',
						'value'       => array( esc_html__( 'Yes', 'godam' ) => 'true' ),
						'std'         => 'true',
						'description' => esc_html__( 'Engagement will only be visible for transcoded videos', 'godam' ),
						'group'       => esc_html__( 'Layout', 'godam' ),
					),

					// Query Settings.
					array(
						'type'        => 'textfield',
						'heading'     => esc_html__( 'Number of Videos', 'godam' ),
						'param_name'  => 'count',
						'value'       => '6',
						'description' => esc_html__( 'Number of videos to display (1-30)', 'godam' ),
						'group'       => esc_html__( 'Query', 'godam' ),
					),
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Order By', 'godam' ),
						'param_name'  => 'orderby',
						'value'       => array(
							esc_html__( 'Date', 'godam' )  => 'date',
							esc_html__( 'Title', 'godam' ) => 'title',
							esc_html__( 'Duration', 'godam' ) => 'duration',
							esc_html__( 'Size', 'godam' )  => 'size',
						),
						'std'         => 'date',
						'description' => esc_html__( 'Sort videos by', 'godam' ),
						'group'       => esc_html__( 'Query', 'godam' ),
					),
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Order', 'godam' ),
						'param_name'  => 'order',
						'value'       => array(
							esc_html__( 'Descending', 'godam' ) => 'DESC',
							esc_html__( 'Ascending', 'godam' )  => 'ASC',
						),
						'std'         => 'DESC',
						'description' => esc_html__( 'Sort order', 'godam' ),
						'group'       => esc_html__( 'Query', 'godam' ),
					),
					array(
						'type'        => 'textfield',
						'heading'     => esc_html__( 'Search', 'godam' ),
						'param_name'  => 'search',
						'description' => esc_html__( 'Search in video titles and descriptions', 'godam' ),
						'group'       => esc_html__( 'Query', 'godam' ),
					),
					array(
						'type'        => 'textfield',
						'heading'     => esc_html__( 'Include Video IDs', 'godam' ),
						'param_name'  => 'include',
						'description' => esc_html__( 'Comma-separated list of video IDs to include', 'godam' ),
						'group'       => esc_html__( 'Query', 'godam' ),
					),

					// Filter Settings.
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Category', 'godam' ),
						'param_name'  => 'category',
						'value'       => $this->get_categories_for_dropdown(),
						'description' => esc_html__( 'Filter by category', 'godam' ),
						'group'       => esc_html__( 'Filters', 'godam' ),
					),
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Tag', 'godam' ),
						'param_name'  => 'tag',
						'value'       => $this->get_tags_for_dropdown(),
						'description' => esc_html__( 'Filter by tag', 'godam' ),
						'group'       => esc_html__( 'Filters', 'godam' ),
					),
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Author', 'godam' ),
						'param_name'  => 'author',
						'value'       => $this->get_authors_for_dropdown(),
						'description' => esc_html__( 'Filter by author', 'godam' ),
						'group'       => esc_html__( 'Filters', 'godam' ),
					),
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Date Range', 'godam' ),
						'param_name'  => 'date_range',
						'value'       => array(
							esc_html__( 'All Time', 'godam' )      => '',
							esc_html__( 'Last 7 Days', 'godam' )   => '7days',
							esc_html__( 'Last 30 Days', 'godam' )  => '30days',
							esc_html__( 'Last 90 Days', 'godam' )  => '90days',
							esc_html__( 'Custom Range', 'godam' ) => 'custom',
						),
						'std'         => '',
						'description' => esc_html__( 'Filter by date range', 'godam' ),
						'group'       => esc_html__( 'Filters', 'godam' ),
					),
					array(
						'type'        => 'textfield',
						'heading'     => esc_html__( 'Custom Start Date', 'godam' ),
						'param_name'  => 'custom_date_start',
						'description' => esc_html__( 'Start date in YYYY-MM-DD format', 'godam' ),
						'dependency'  => array(
							'element' => 'date_range',
							'value'   => 'custom',
						),
						'group'       => esc_html__( 'Filters', 'godam' ),
					),
					array(
						'type'        => 'textfield',
						'heading'     => esc_html__( 'Custom End Date', 'godam' ),
						'param_name'  => 'custom_date_end',
						'description' => esc_html__( 'End date in YYYY-MM-DD format', 'godam' ),
						'dependency'  => array(
							'element' => 'date_range',
							'value'   => 'custom',
						),
						'group'       => esc_html__( 'Filters', 'godam' ),
					),
					
					// WPBakery Design Options tab.
					array(
						'type'       => 'css_editor',
						'heading'    => esc_html__( 'Design Options', 'godam' ),
						'param_name' => 'css',
						'group'      => esc_html__( 'Design Options', 'godam' ),
					),
				),
			)
		);
	}

	/**
	 * Get categories for dropdown.
	 * 
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	private function get_categories_for_dropdown() {
		$categories = \get_categories(
			array(
				'hide_empty' => false,
			)
		);

		$options = array(
			esc_html__( 'All Categories', 'godam' ) => '',
		);

		if ( ! empty( $categories ) ) {
			foreach ( $categories as $category ) {
				$options[ $category->name ] = $category->term_id;
			}
		}

		return $options;
	}

	/**
	 * Get tags for dropdown.
	 * 
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	private function get_tags_for_dropdown() {
		$tags = \get_tags(
			array(
				'hide_empty' => false,
			)
		);

		$options = array(
			esc_html__( 'All Tags', 'godam' ) => '',
		);

		if ( ! empty( $tags ) ) {
			foreach ( $tags as $tag ) {
				$options[ $tag->name ] = $tag->term_id;
			}
		}

		return $options;
	}

	/**
	 * Get authors for dropdown.
	 * 
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	private function get_authors_for_dropdown() {
		$authors = \get_users(
			array(
				'who' => 'authors',
			)
		);

		$options = array(
			esc_html__( 'All Authors', 'godam' ) => '0',
		);

		if ( ! empty( $authors ) ) {
			foreach ( $authors as $author ) {
				$options[ $author->display_name ] = $author->ID;
			}
		}

		return $options;
	}
}
