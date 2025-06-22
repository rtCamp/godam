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
	 * Default config for GoDAM Gallery Widget.
	 *
	 * @return array
	 */
	public function set_default_config() {
		return [
			'name'            => 'godam-gallery',
			'title'           => esc_html_x( 'GoDAM Gallery', 'Widget Title', 'godam' ),
			'icon'            => 'eicon-gallery-grid',
			'categories'      => [ 'godam' ],
			'keywords'        => [ 'godam', 'gallery', 'video' ],
			'depended_script' => [ 'godam-player-frontend-script', 'godam-player-analytics-script', 'godam-gallery-script' ],
			'depended_styles' => [ 'godam-player-frontend-style', 'godam-player-style', 'godam-gallery-style' ],
		];
	}

	/**
	 * Register Widget Controls.
	 *
	 * @access protected
	 */
	protected function register_controls() {

		$this->start_controls_section(
			'section_gallery_settings',
			[
				'label' => esc_html__( 'Gallery Settings', 'godam' ),
			]
		);

		$this->add_control(
			'infinite_scroll',
			[
				'label'   => esc_html__( 'Enable Infinite Scroll', 'godam' ),
				'type'    => Controls_Manager::SWITCHER,
				'default' => 'no',
			]
		);

		$this->add_control(
			'show_title',
			[
				'label'     => esc_html__( 'Show Video Titles and Dates', 'godam' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'yes',
				'condition' => [
					'layout' => 'grid',
				],
			]
		);

		$this->add_control(
			'layout',
			[
				'label'   => esc_html__( 'Layout', 'godam' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'grid',
				'options' => [
					'grid' => esc_html__( 'Grid', 'godam' ),
					'list' => esc_html__( 'List', 'godam' ),
				],
			]
		);

		$this->add_control(
			'count',
			[
				'label'   => esc_html__( 'Number of videos', 'godam' ),
				'type'    => Controls_Manager::SLIDER,
				'range'   => [
					'videos' => [
						'min'  => 1,
						'max'  => 30,
						'step' => 1,
					],
				],
				'default' => [
					'unit' => 'videos',
					'size' => 6,
				],
			]
		);

		$this->add_control(
			'columns',
			[
				'label'     => esc_html__( 'Number of columns', 'godam' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => [
					'columns' => [
						'min'  => 1,
						'max'  => 6,
						'step' => 1,
					],
				],
				'default'   => [
					'unit' => 'columns',
					'size' => 3,
				],
				'condition' => [
					'layout' => 'grid',
				],
			]
		);

		$this->add_control(
			'orderby',
			[
				'label'   => __( 'Order By', 'godam' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'date',
				'options' => [
					'date'     => esc_html__( 'Date', 'godam' ),
					'title'    => esc_html__( 'Title', 'godam' ),
					'duration' => esc_html__( 'Duration', 'godam' ),
					'size'     => esc_html__( 'Size', 'godam' ),
				],
			]
		);

		$this->add_control(
			'order',
			[
				'label'   => __( 'Order', 'godam' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'DESC',
				'options' => [
					'DESC' => esc_html__( 'Descending', 'godam' ),
					'ASC'  => esc_html__( 'Ascending', 'godam' ),
				],
			]
		);

		// Fetch the available categories and add to control options.
		$categories       = get_categories();
		$category_options = [
			'' => esc_html__( 'All Categories', 'godam' ),
		];

		foreach ( $categories as $category ) {
			$category_options[ strval( $category->term_id ) ] = $category->name;
		}

		$this->add_control(
			'category',
			[
				'label'   => esc_html__( 'Category', 'godam' ),
				'type'    => Controls_Manager::SELECT2,
				'default' => '',
				'options' => $category_options,
			]
		);

		// Fetch the available tags and add to control options.
		$tags        = get_tags();
		$tag_options = [
			'' => esc_html__( 'All Tags', 'godam' ),
		];

		foreach ( $tags as $tag ) {
			$tag_options[ strval( $tag->term_id ) ] = $tag->name;
		}

		$this->add_control(
			'tag',
			[
				'label'   => esc_html__( 'Tags', 'godam' ),
				'type'    => Controls_Manager::SELECT2,
				'default' => '',
				'options' => $tag_options,
			]
		);

		// Fetch the available authors and add to control options.
		$users        = get_users( [ 'who' => 'authors' ] );
		$user_options = [
			'' => esc_html__( 'All Users', 'godam' ),
		];

		foreach ( $users as $user ) {
			$user_options[ strval( $user->ID ) ] = $user->display_name;
		}

		$this->add_control(
			'author',
			[
				'label'   => esc_html__( 'Author', 'godam' ),
				'type'    => Controls_Manager::SELECT2,
				'default' => '',
				'options' => $user_options,
			]
		);

		$this->add_control(
			'date_range',
			[
				'label'   => esc_html__( 'Date Range', 'godam' ),
				'type'    => Controls_Manager::SELECT,
				'default' => '',
				'options' => [
					''       => esc_html__( 'All Time', 'godam' ),
					'7days'  => esc_html__( 'Last 7 Days', 'godam' ),
					'30days' => esc_html__( 'Last 30 Days', 'godam' ),
					'90days' => esc_html__( 'Last 90 Days', 'godam' ),
					'custom' => esc_html__( 'Custom Range', 'godam' ),
				],
			]
		);

		$this->add_control(
			'custom_date_start',
			[
				'label'          => esc_html__( 'Start Date', 'godam' ),
				'type'           => Controls_Manager::DATE_TIME,
				'picker_options' => [
					'enableTime' => false,
				],
				'condition'      => [
					'date_range' => 'custom',
				],
			]
		);

		$this->add_control(
			'custom_date_end',
			[
				'label'          => esc_html__( 'End Date', 'godam' ),
				'type'           => Controls_Manager::DATE_TIME,
				'picker_options' => [
					'enableTime' => false,
				],
				'condition'      => [
					'date_range' => 'custom',
				],
			]
		);

		$this->add_control(
			'include',
			[
				'label'         => esc_html__( 'Include Video IDs', 'godam' ),
				'type'          => Controls_Manager::REPEATER,
				'description'   => esc_html__( 'Comma-separated list of video IDs to include', 'godam' ),
				'fields'        => [
					[
						'name'        => 'video_id',
						'label'       => esc_html__( 'Video ID', 'godam' ),
						'type'        => Controls_Manager::TEXT,
						'default'     => esc_html__( '0', 'godam' ),
						'label_block' => true,
					],
				],
				'default'       => [],
				'prevent_empty' => false,
				'title_field'   => '{{{ video_id }}}', // phpcs:ignore WordPressVIPMinimum.Security.Mustache.OutputNotation
			]
		);

		$this->add_control(
			'search',
			[
				'label'       => esc_html__( 'Search', 'godam' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
				'description' => esc_html__( 'Search in video titles and descriptions', 'godam' ),
			]
		);

		$this->end_controls_section();
	}

	/**
	 * Render GoDAM Gallery widget output on the frontend.
	 *
	 * @access protected
	 */
	protected function render() {
		$columns           = $this->get_settings_for_display( 'columns' );
		$count             = $this->get_settings_for_display( 'count' );
		$order_by          = $this->get_settings_for_display( 'order_by' );
		$order             = $this->get_settings_for_display( 'order' );
		$infinite_scroll   = 'yes' === $this->get_settings_for_display( 'infinite_scroll' );
		$show_title        = 'yes' === $this->get_settings_for_display( 'show_title' );
		$layout            = $this->get_settings_for_display( 'layout' );
		$category          = $this->get_settings_for_display( 'category' );
		$tag               = $this->get_settings_for_display( 'tag' );
		$author            = $this->get_settings_for_display( 'author' );
		$date_range        = $this->get_settings_for_display( 'date_range' );
		$custom_date_start = $this->get_settings_for_display( 'custom_date_start' );
		$custom_date_end   = $this->get_settings_for_display( 'custom_date_end' );
		$include_id_field  = $this->get_settings_for_display( 'include' );
		$search            = sanitize_text_field( $this->get_settings_for_display( 'search' ) );
		$include_ids       = [];

		// Concatenating the included ids in comma separated format.
		foreach ( $include_id_field as $id_field ) {
			$include_ids[] = $id_field['video_id'];
		}

		$include = implode( ',', $include_ids );

		// Setting the show_title to true in case of list view.
		if ( 'list' === $layout ) {
			$show_title = true;
		}

		$shortcode_atts = [
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
		];

		// Convert settings to shortcode string.
		$shortcode_atts_string = '';
		foreach ( $shortcode_atts as $key => $value ) {
			$shortcode_atts_string .= sprintf( ' %s="%s"', $key, esc_attr( $value ) );
		}

		echo do_shortcode( '[godam_video_gallery' . $shortcode_atts_string . ']' );
	}
}
