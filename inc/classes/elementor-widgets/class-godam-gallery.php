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
			'title'           => esc_html_x( 'GoDAM Gallery', 'Widget Title', 'godam' ),
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
				'label' => esc_html__( 'Gallery Settings', 'godam' ),
			)
		);

		$this->add_control(
			'infinite_scroll',
			array(
				'label'   => esc_html__( 'Enable Infinite Scroll', 'godam' ),
				'type'    => Controls_Manager::SWITCHER,
				'default' => 'no',
			)
		);

		$this->add_control(
			'show_title',
			array(
				'label'     => esc_html__( 'Show Video Titles and Dates', 'godam' ),
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
				'label'   => esc_html__( 'Layout', 'godam' ),
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

		// Fetch the available categories and add to control options.
		$categories       = get_categories();
		$category_options = array(
			'' => esc_html__( 'All Categories', 'godam' ),
		);

		foreach ( $categories as $category ) {
			$category_options[ strval( $category->term_id ) ] = $category->name;
		}

		$this->add_control(
			'category',
			array(
				'label'   => esc_html__( 'Category', 'godam' ),
				'type'    => Controls_Manager::SELECT2,
				'default' => '',
				'options' => $category_options,
			)
		);

		// Fetch the available tags and add to control options.
		$tags        = get_tags();
		$tag_options = array(
			'' => esc_html__( 'All Tags', 'godam' ),
		);

		foreach ( $tags as $tag ) {
			$tag_options[ strval( $tag->term_id ) ] = $tag->name;
		}

		$this->add_control(
			'tag',
			array(
				'label'   => esc_html__( 'Tags', 'godam' ),
				'type'    => Controls_Manager::SELECT2,
				'default' => '',
				'options' => $tag_options,
			)
		);

		// Fetch the available authors and add to control options.
		$users        = get_users( array( 'who' => 'authors' ) );
		$user_options = array(
			'' => esc_html__( 'All Users', 'godam' ),
		);

		foreach ( $users as $user ) {
			$user_options[ strval( $user->ID ) ] = $user->display_name;
		}

		$this->add_control(
			'author',
			array(
				'label'   => esc_html__( 'Author', 'godam' ),
				'type'    => Controls_Manager::SELECT2,
				'default' => '',
				'options' => $user_options,
			)
		);

		$this->add_control(
			'date_range',
			array(
				'label'   => esc_html__( 'Date Range', 'godam' ),
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
				'label'          => esc_html__( 'Start Date', 'godam' ),
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
				'label'          => esc_html__( 'End Date', 'godam' ),
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
		$search            = sanitize_text_field( $this->get_settings_for_display( 'search' ) );
		$align             = $this->get_settings_for_display( 'align' );
		$include_ids       = array();

		// Concatenating the included ids in comma separated format.
		foreach ( $include_id_field as $id_field ) {
			$include_ids[] = $id_field['video_id'];
		}

		$include = implode( ',', $include_ids );

		// Setting the show_title to true in case of list view.
		if ( 'list' === $layout ) {
			$show_title = true;
		}

		$shortcode_atts = array(
			'columns'           => ! empty( $columns ) && isset( $columns['size'] ) ? $columns['size'] : 3,
			'count'             => ! empty( $count ) && isset( $count['size'] ) ? $count['size'] : 6,
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
