<?php
/**
 * Register Custom Widget - GoDAM Gallery
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Elementor_Widgets;

use Elementor\Controls_Manager;

/**
 * GoDAM Gallery Widget.
 */
class Godam_Gallery extends Base {

	/**
	 * Default config for Calculate Savings Widget.
	 *
	 * @return array
	 */
	public function set_default_config() {
		return array(
			'name'            => 'godam-gallery',
			'title'           => _x( 'GoDAM Gallery', 'Widget Title', 'godam' ),
			'icon'            => 'eicon-gallery-grid',
			'categories'      => array( 'godam' ),
			'keywords'        => array( 'godam', 'gallery', 'video' ),
			'depended_script' => array( 'godam-player-frontend-script', 'godam-player-analytics-script', 'godam-gallery-script' ),
			'depended_styles' => array( 'godam-player-frontend-style', 'godam-player-style', 'godam-gallery-style' ),
		);
	}

	/**
	 * Register Calculate Savings Widget Controls.
	 *
	 * @access protected
	 */
	protected function register_controls() {

		$this->start_controls_section(
			'section_gallery_settings',
			array(
				'label' => __( 'Gallery Settings', 'godam' ),
			)
		);

		$this->add_control(
			'infinite_scroll',
			array(
				'label'   => __( 'Enable Infinite Scroll', 'godam' ),
				'type'    => Controls_Manager::SWITCHER,
				'default' => 'no',
			)
		);

		$this->add_control(
			'show_title',
			array(
				'label'     => __( 'Show Video Titles and Dates', 'godam' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'yes',
				'condition' => array(
					'layout' => 'grid',
				),
			)
		);

		$this->add_control(
			'layout',
			array(
				'label'   => __( 'Layout', 'godam' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'grid',
				'options' => array(
					'grid' => esc_html__( 'Grid', 'godam' ),
					'list' => esc_html__( 'List', 'godam' ),
				),
			)
		);

		$this->add_control(
			'count',
			array(
				'label'   => esc_html__( 'Number of videos', 'godam' ),
				'type'    => Controls_Manager::SLIDER,
				'range'   => array(
					'videos' => array(
						'min'  => 1,
						'max'  => 30,
						'step' => 1,
					),
				),
				'default' => array(
					'unit' => 'videos',
					'size' => 6,
				),
			)
		);

		$this->add_control(
			'columns',
			array(
				'label'     => esc_html__( 'Number of columns', 'godam' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array(
					'columns' => array(
						'min'  => 1,
						'max'  => 6,
						'step' => 1,
					),
				),
				'default'   => array(
					'unit' => 'columns',
					'size' => 3,
				),
				'condition' => array(
					'layout' => 'grid',
				),
			)
		);

		$this->add_control(
			'orderby',
			array(
				'label'   => __( 'Order By', 'godam' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'date',
				'options' => array(
					'date'     => esc_html__( 'Date', 'godam' ),
					'title'    => esc_html__( 'Title', 'godam' ),
					'duration' => esc_html__( 'Duration', 'godam' ),
					'size'     => esc_html__( 'Size', 'godam' ),
				),
			)
		);

		$this->add_control(
			'order',
			array(
				'label'   => __( 'Order', 'godam' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'DESC',
				'options' => array(
					'DESC' => esc_html__( 'Descending', 'godam' ),
					'ASC'  => esc_html__( 'Ascending', 'godam' ),
				),
			)
		);

		$categories       = get_categories();
		$category_options = array(
			'' => __( 'All Categories', 'godam' ),
		);

		foreach ( $categories as $category ) {
			$category_options[ strval( $category->term_id ) ] = $category->name;
		}

		$this->add_control(
			'category',
			array(
				'label'   => __( 'Category', 'godam' ),
				'type'    => Controls_Manager::SELECT2,
				'default' => '',
				'options' => $category_options,
			)
		);

		$tags        = get_tags();
		$tag_options = array(
			'' => __( 'All Tags', 'godam' ),
		);

		foreach ( $tags as $tag ) {
			$tag_options[ strval( $tag->term_id ) ] = $tag->name;
		}

		$this->add_control(
			'tag',
			array(
				'label'   => __( 'Tags', 'godam' ),
				'type'    => Controls_Manager::SELECT2,
				'default' => '',
				'options' => $tag_options,
			)
		);

		$users        = get_users( array( 'who' => 'authors' ) );
		$user_options = array(
			'' => __( 'All Users', 'godam' ),
		);

		foreach ( $users as $user ) {
			$user_options[ strval( $user->ID ) ] = $user->display_name;
		}

		$this->add_control(
			'author',
			array(
				'label'   => __( 'Author', 'godam' ),
				'type'    => Controls_Manager::SELECT2,
				'default' => '',
				'options' => $user_options,
			)
		);

		$this->add_control(
			'date_range',
			array(
				'label'   => __( 'Date Range', 'godam' ),
				'type'    => Controls_Manager::SELECT,
				'default' => '',
				'options' => array(
					''       => esc_html__( 'All Time', 'godam' ),
					'7days'  => esc_html__( 'Last 7 Days', 'godam' ),
					'30days' => esc_html__( 'Last 30 Days', 'godam' ),
					'90days' => esc_html__( 'Last 90 Days', 'godam' ),
					'custom' => esc_html__( 'Custom Range', 'godam' ),
				),
			)
		);

		$this->add_control(
			'custom_date_start',
			array(
				'label'          => __( 'Start Date', 'godam' ),
				'type'           => Controls_Manager::DATE_TIME,
				'picker_options' => array(
					'enableTime' => false,
				),
				'condition'      => array(
					'date_range' => 'custom',
				),
			)
		);

		$this->add_control(
			'custom_date_end',
			array(
				'label'          => __( 'End Date', 'godam' ),
				'type'           => Controls_Manager::DATE_TIME,
				'picker_options' => array(
					'enableTime' => false,
				),
				'condition'      => array(
					'date_range' => 'custom',
				),
			)
		);

		$this->add_control(
			'include',
			array(
				'label'         => esc_html__( 'Include Video IDs', 'godam' ),
				'type'          => Controls_Manager::REPEATER,
				'description'   => esc_html__( 'Comma-separated list of video IDs to include', 'godam' ),
				'fields'        => array(
					array(
						'name'        => 'video_id',
						'label'       => esc_html__( 'Video ID', 'godam' ),
						'type'        => Controls_Manager::TEXT,
						'default'     => esc_html__( '0', 'godam' ),
						'label_block' => true,
					),
				),
				'default'       => array(),
				'prevent_empty' => false,
				'title_field'   => '{{{ video_id }}}', // phpcs:ignore WordPressVIPMinimum.Security.Mustache.OutputNotation
			)
		);

		$this->add_control(
			'search',
			array(
				'label'       => esc_html__( 'Search', 'godam' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
				'description' => esc_html__( 'Search in video titles and descriptions', 'godam' ),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Render DT Nav Menu widget output on the frontend.
	 *
	 * @access protected
	 */
	protected function render() {
		$columns           = $this->get_settings_for_display( 'columns' );
		$count             = $this->get_settings_for_display( 'count' );
		$order_by          = $this->get_settings_for_display( 'order_by' );
		$order             = $this->get_settings_for_display( 'order' );
		$infinite_scroll   = $this->get_settings_for_display( 'infinite_scroll' );
		$show_title        = $this->get_settings_for_display( 'show_title' );
		$layout            = $this->get_settings_for_display( 'layout' );
		$category          = $this->get_settings_for_display( 'category' );
		$tag               = $this->get_settings_for_display( 'tag' );
		$author            = $this->get_settings_for_display( 'author' );
		$date_range        = $this->get_settings_for_display( 'date_range' );
		$custom_date_start = $this->get_settings_for_display( 'custom_date_start' );
		$custom_date_end   = $this->get_settings_for_display( 'custom_date_end' );
		$include_id_field  = $this->get_settings_for_display( 'include' );
		$search            = $this->get_settings_for_display( 'search' );
		$align             = $this->get_settings_for_display( 'align' );
		$include_ids       = array();

		foreach ( $include_id_field as $id_field ) {
			$include_ids[] = $id_field['video_id'];
		}

		$include = implode( ',', $include_ids );

		if ( 'list' === $layout ) {
			$show_title = true;
		}

		$shortcode_atts = array(
			'columns'           => $columns['size'] ?? 3,
			'count'             => $count['size'],
			'orderby'           => $order_by,
			'order'             => $order,
			'layout'            => $layout,
			'infinite_scroll'   => $infinite_scroll,
			'category'          => $category,
			'tag'               => $tag,
			'author'            => $author,
			'date_range'        => $date_range,
			'custom_date_start' => $custom_date_start,
			'custom_date_end'   => $custom_date_end,
			'include'           => $include,
			'search'            => $search,
			'show_title'        => $show_title,
			'align'             => $align,
		);

		// Convert settings to shortcode string.
		$shortcode_atts_string = '';
		foreach ( $shortcode_atts as $key => $value ) {
			$shortcode_atts_string .= sprintf( ' %s="%s"', $key, esc_attr( $value ) );
		}

		echo do_shortcode( '[godam_video_gallery' . $shortcode_atts_string . ']' );
	}
}
