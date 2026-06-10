<?php
/**
 * Register Custom Widget - GoDAM Gallery
 *
 * Mirrors the godam/gallery-v2 Gutenberg block. Widget controls map 1-to-1
 * to block attributes and render() delegates to the [godam_video_gallery]
 * shortcode, which itself renders through inc/templates/godam-video-gallery.php
 * — so block, shortcode, and widget share one template and JS contract.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Elementor_Widgets;

use Elementor\Controls_Manager;
use Elementor\Repeater;

/**
 * GoDAM Gallery Widget.
 */
class Godam_Gallery extends Base {

	/**
	 * Default config for GoDAM Gallery Widget.
	 *
	 * @return array
	 */
	public function set_default_config() {
		return array(
			'name'            => 'godam-gallery',
			'title'           => esc_html_x( 'GoDAM Gallery', 'Widget Title', 'godam' ),
			'icon'            => 'eicon-gallery-grid',
			'categories'      => array( 'godam' ),
			'keywords'        => array( 'godam', 'gallery', 'video' ),
			'depended_script' => array( 'godam-player-frontend-script', 'godam-player-analytics-script', 'godam-gallery-v2-view-script', 'godam-elementor-frontend' ),
			'depended_styles' => array( 'godam-player-style', 'godam-gallery-v2-style' ),
		);
	}

	/**
	 * Register Widget Controls.
	 *
	 * @access protected
	 */
	protected function register_controls() {

		// -----------------------------------------------------------------
		// Section 1 — Gallery Settings.
		// Everything that decides WHICH videos appear: mode toggle, the
		// handpicked Repeater, the query-mode filters, and performance
		// (since it affects how those items are loaded).
		// -----------------------------------------------------------------
		$this->start_controls_section(
			'section_gallery_settings',
			array(
				'label' => esc_html__( 'Gallery Settings', 'godam' ),
			)
		);

		$this->add_control(
			'mode',
			array(
				'label'       => esc_html__( 'Mode', 'godam' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'query',
				'options'     => array(
					'query'      => esc_html__( 'Query (filter videos)', 'godam' ),
					'handpicked' => esc_html__( 'Handpicked (pick videos)', 'godam' ),
				),
				'description' => esc_html__( 'Query: filter from the media library. Handpicked: choose specific videos in order.', 'godam' ),
			)
		);

		$handpicked_repeater = new Repeater();
		$handpicked_repeater->add_control(
			'video',
			array(
				'label'       => esc_html__( 'Video', 'godam' ),
				'type'        => 'godam-media',
				// `media_type` (singular) is what godam-media.js reads to set
				// the WP Media Library `library.type` filter when opening the
				// frame — restricting selection to video files only.
				// `media_types` (plural) is what the control's PHP template
				// uses to decide preview shape (video tag vs image div).
				'media_type'  => 'video',
				'media_types' => array( 'video' ),
				'default'     => array(
					'id'  => '',
					'url' => '',
				),
				'label_block' => true,
				'description' => esc_html__( 'Only video attachments can be picked. The Add button opens the WordPress media library filtered to videos.', 'godam' ),
			)
		);

		$this->add_control(
			'handpicked_items',
			array(
				'label'         => esc_html__( 'Videos', 'godam' ),
				'type'          => Controls_Manager::REPEATER,
				'fields'        => $handpicked_repeater->get_controls(),
				'default'       => array(),
				'prevent_empty' => false,
				'title_field'   => '{{{ video && video.id ? "Video #" + video.id : "No video selected" }}}', // phpcs:ignore WordPressVIPMinimum.Security.Mustache.OutputNotation
				'description'   => esc_html__( 'Add rows and pick a video for each. Order in the list determines display order. Rows with no video are skipped on the frontend.', 'godam' ),
				'condition'     => array(
					'mode' => 'handpicked',
				),
			)
		);

		$this->add_control(
			'count',
			array(
				'label'     => esc_html__( 'Number of videos', 'godam' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array(
					'videos' => array(
						'min'  => 1,
						'max'  => 30,
						'step' => 1,
					),
				),
				'default'   => array(
					'unit' => 'videos',
					'size' => 6,
				),
				'condition' => array(
					'mode' => 'query',
				),
			)
		);

		$this->add_control(
			'orderby',
			array(
				'label'     => __( 'Order By', 'godam' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => 'date',
				'options'   => array(
					'date'     => esc_html__( 'Date', 'godam' ),
					'title'    => esc_html__( 'Title', 'godam' ),
					'duration' => esc_html__( 'Duration', 'godam' ),
					'size'     => esc_html__( 'Size', 'godam' ),
				),
				'condition' => array(
					'mode' => 'query',
				),
			)
		);

		$this->add_control(
			'order',
			array(
				'label'     => __( 'Order', 'godam' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => 'desc',
				'options'   => array(
					'desc' => esc_html__( 'Descending', 'godam' ),
					'asc'  => esc_html__( 'Ascending', 'godam' ),
				),
				'condition' => array(
					'mode' => 'query',
				),
			)
		);

		$media_folder_options = array();
		$media_folder_terms   = get_terms(
			array(
				'taxonomy'   => 'media-folder',
				'hide_empty' => false,
			)
		);
		if ( ! is_wp_error( $media_folder_terms ) ) {
			foreach ( $media_folder_terms as $media_folder_term ) {
				$media_folder_options[ strval( $media_folder_term->term_id ) ] = $media_folder_term->name;
			}
		}

		$this->add_control(
			'media_folder',
			array(
				'label'       => esc_html__( 'Media Folder', 'godam' ),
				'type'        => Controls_Manager::SELECT2,
				'default'     => array(),
				'multiple'    => true,
				'options'     => $media_folder_options,
				'description' => esc_html__( 'Limit results to the selected media folders.', 'godam' ),
				'condition'   => array(
					'mode' => 'query',
				),
			)
		);

		$users        = get_users( array( 'who' => 'authors' ) );
		$user_options = array();

		foreach ( $users as $user ) {
			$user_options[ strval( $user->ID ) ] = $user->display_name;
		}

		$this->add_control(
			'author',
			array(
				'label'     => esc_html__( 'Author', 'godam' ),
				'type'      => Controls_Manager::SELECT2,
				'default'   => array(),
				'multiple'  => true,
				'options'   => $user_options,
				'condition' => array(
					'mode' => 'query',
				),
			)
		);

		$this->add_control(
			'date_range',
			array(
				'label'     => esc_html__( 'Date Range', 'godam' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => array(
					''       => esc_html__( 'All Time', 'godam' ),
					'7days'  => esc_html__( 'Last 7 Days', 'godam' ),
					'30days' => esc_html__( 'Last 30 Days', 'godam' ),
					'90days' => esc_html__( 'Last 90 Days', 'godam' ),
					'custom' => esc_html__( 'Custom Range', 'godam' ),
				),
				'condition' => array(
					'mode' => 'query',
				),
			)
		);

		$this->add_control(
			'custom_date_start',
			array(
				'label'          => esc_html__( 'Start Date', 'godam' ),
				'type'           => Controls_Manager::DATE_TIME,
				'picker_options' => array(
					'enableTime' => false,
				),
				'condition'      => array(
					'mode'       => 'query',
					'date_range' => 'custom',
				),
			)
		);

		$this->add_control(
			'custom_date_end',
			array(
				'label'          => esc_html__( 'End Date', 'godam' ),
				'type'           => Controls_Manager::DATE_TIME,
				'picker_options' => array(
					'enableTime' => false,
				),
				'condition'      => array(
					'mode'       => 'query',
					'date_range' => 'custom',
				),
			)
		);

		$this->add_control(
			'performance_mode',
			array(
				'label'       => esc_html__( 'Performance Mode', 'godam' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'balanced',
				'options'     => array(
					'balanced' => esc_html__( 'Balanced', 'godam' ),
					'priority' => esc_html__( 'Priority', 'godam' ),
				),
				'description' => esc_html__( 'Priority preloads leading thumbnails with fetchpriority="high".', 'godam' ),
			)
		);

		$this->end_controls_section();

		// -----------------------------------------------------------------
		// Section 2 — Display Settings.
		// How the picked/queried items LOOK and behave: layout, sizing,
		// title visibility, and the load-more switches.
		// -----------------------------------------------------------------
		$this->start_controls_section(
			'section_display_settings',
			array(
				'label' => esc_html__( 'Display Settings', 'godam' ),
			)
		);

		$this->add_control(
			'layout',
			array(
				'label'   => esc_html__( 'Layout', 'godam' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'grid',
				'options' => array(
					'grid'     => esc_html__( 'Grid', 'godam' ),
					'carousel' => esc_html__( 'Carousel', 'godam' ),
				),
			)
		);

		$this->add_control(
			'item_width',
			array(
				'label'   => esc_html__( 'Item Width', 'godam' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'S',
				'options' => array(
					'S' => esc_html__( 'Small (200px)', 'godam' ),
					'M' => esc_html__( 'Medium (260px)', 'godam' ),
					'L' => esc_html__( 'Large (320px)', 'godam' ),
				),
			)
		);

		$this->add_control(
			'view_ratio',
			array(
				'label'   => esc_html__( 'View Ratio', 'godam' ),
				'type'    => Controls_Manager::SELECT,
				'default' => '16:9',
				'options' => array(
					'16:9' => esc_html__( '16:9', 'godam' ),
					'4:3'  => esc_html__( '4:3', 'godam' ),
					'9:16' => esc_html__( '9:16', 'godam' ),
					'3:4'  => esc_html__( '3:4', 'godam' ),
					'1:1'  => esc_html__( '1:1', 'godam' ),
				),
			)
		);

		$this->add_control(
			'show_title',
			array(
				'label'   => esc_html__( 'Show Video Titles and Dates', 'godam' ),
				'type'    => Controls_Manager::SWITCHER,
				'default' => 'yes',
			)
		);

		$this->add_control(
			'enable_more_items',
			array(
				'label'     => esc_html__( 'Enable More Items', 'godam' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => '',
				'condition' => array(
					'mode' => 'query',
				),
			)
		);

		$this->add_control(
			'more_items_behavior',
			array(
				'label'     => esc_html__( 'More Items Behavior', 'godam' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => 'button',
				'options'   => array(
					'button'   => esc_html__( 'Load More button', 'godam' ),
					'infinite' => esc_html__( 'Infinite scroll', 'godam' ),
				),
				'condition' => array(
					'mode'              => 'query',
					'enable_more_items' => 'yes',
				),
			)
		);

		// Match the godam/video Elementor widget and the block's editor: only
		// register the engagements toggle when the global feature is enabled.
		// Template/render also defends via rtgodam_is_engagement_feature_enabled().
		if ( rtgodam_is_engagement_feature_enabled() ) {
			$this->add_control(
				'engagements',
				array(
					'label'   => esc_html__( 'Show Engagements', 'godam' ),
					'type'    => Controls_Manager::SWITCHER,
					'default' => 'yes',
				)
			);
		}

		$this->end_controls_section();
	}

	/**
	 * Render GoDAM Gallery widget output on the frontend.
	 *
	 * @access protected
	 */
	protected function render() {
		$mode             = 'handpicked' === $this->get_settings_for_display( 'mode' ) ? 'handpicked' : 'query';
		$layout           = $this->get_settings_for_display( 'layout' );
		$item_width       = $this->get_settings_for_display( 'item_width' );
		$view_ratio       = $this->get_settings_for_display( 'view_ratio' );
		$show_title       = 'yes' === $this->get_settings_for_display( 'show_title' );
		$performance_mode = $this->get_settings_for_display( 'performance_mode' );
		$engagements      = rtgodam_is_engagement_feature_enabled()
			&& 'yes' === $this->get_settings_for_display( 'engagements' );

		// Attributes shared by both modes.
		$shortcode_atts = array(
			'mode'             => $mode,
			'layout'           => $layout,
			'item_width'       => $item_width,
			'view_ratio'       => $view_ratio,
			'show_title'       => $show_title ? 'true' : 'false',
			'performance_mode' => $performance_mode,
			'engagements'      => $engagements ? 'true' : 'false',
		);

		if ( 'handpicked' === $mode ) {
			$handpicked_items = $this->get_settings_for_display( 'handpicked_items' );
			$ids              = array();

			if ( is_array( $handpicked_items ) ) {
				foreach ( $handpicked_items as $row ) {
					$row_id = isset( $row['video']['id'] ) ? absint( $row['video']['id'] ) : 0;
					if ( $row_id > 0 ) {
						$ids[] = $row_id;
					}
				}
			}

			$shortcode_atts['ids'] = implode( ',', $ids );
		} else {
			$count               = $this->get_settings_for_display( 'count' );
			$orderby             = $this->get_settings_for_display( 'orderby' );
			$order               = $this->get_settings_for_display( 'order' );
			$media_folder        = $this->get_settings_for_display( 'media_folder' );
			$author              = $this->get_settings_for_display( 'author' );
			$date_range          = $this->get_settings_for_display( 'date_range' );
			$custom_date_start   = $this->get_settings_for_display( 'custom_date_start' );
			$custom_date_end     = $this->get_settings_for_display( 'custom_date_end' );
			$enable_more_items   = 'yes' === $this->get_settings_for_display( 'enable_more_items' );
			$more_items_behavior = $this->get_settings_for_display( 'more_items_behavior' );

			$shortcode_atts = array_merge(
				$shortcode_atts,
				array(
					'count'               => ! empty( $count ) && isset( $count['size'] ) ? $count['size'] : 6,
					'orderby'             => $orderby,
					'order'               => $order,
					'media_folder'        => is_array( $media_folder ) ? implode( ',', array_filter( $media_folder ) ) : (string) $media_folder,
					'author'              => is_array( $author ) ? implode( ',', array_filter( $author ) ) : (string) $author,
					'date_range'          => $date_range,
					'custom_date_start'   => $custom_date_start,
					'custom_date_end'     => $custom_date_end,
					'enable_more_items'   => $enable_more_items ? 'true' : 'false',
					'more_items_behavior' => $more_items_behavior,
				)
			);
		}

		$shortcode_atts_string = '';
		foreach ( $shortcode_atts as $key => $value ) {
			$shortcode_atts_string .= sprintf( ' %s="%s"', $key, esc_attr( $value ) );
		}

		echo do_shortcode( '[godam_video_gallery' . $shortcode_atts_string . ']' );
	}
}
