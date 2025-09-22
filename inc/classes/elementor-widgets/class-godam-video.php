<?php
/**
 * Register Custom Widget - GoDAM Video.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Elementor_Widgets;

use Elementor\Controls_Manager;

/**
 * GoDAM Video Widget.
 */
class GoDAM_Video extends Base {

	/**
	 * Default config for GoDAM Video Widget.
	 *
	 * @return array
	 */
	public function set_default_config() {
		return array(
			'name'            => 'godam-video',
			'title'           => _x( 'GoDAM Video', 'Widget Title', 'godam' ),
			'icon'            => 'eicon-video',
			'categories'      => array( 'godam' ),
			'keywords'        => array( 'godam', 'video' ),
			'depended_script' => array( 'godam-player-frontend-script', 'godam-player-analytics-script', 'godam-player-frontend-script', 'godam-elementor-frontend' ),
			'depended_styles' => array( 'godam-player-style', 'godam-player-frontend-style', 'godam-player-minimal-skin', 'godam-player-pills-skin', 'godam-player-bubble-skin', 'godam-player-classic-skin' ),
		);
	}

	/**
	 * Register Widget Controls.
	 *
	 * @access protected
	 */
	protected function register_controls() {
		$this->start_controls_section(
			'section_video_settings',
			array(
				'label'   => esc_html__( 'Player Settings', 'godam' ),
				'classes' => 'rtgodam-video-elementor-control-2',
			)
		);

		$this->add_control(
			'video-file',
			array(
				'label'       => esc_html__( 'Video File', 'godam' ),
				'type'        => 'godam-media',
				'description' => esc_html__( 'Select video file', 'godam' ),
				'label_block' => true,
				'media_type'  => 'video',
			)
		);

		$this->add_control(
			'text_track_settings_popover_toggle',
			array(
				'label'        => esc_html__( 'Add Video Caption', 'godam' ),
				'type'         => Controls_Manager::POPOVER_TOGGLE,
				'label_off'    => esc_html__( 'Default', 'godam' ),
				'label_on'     => esc_html__( 'Custom', 'godam' ),
				'return_value' => 'yes',
				'default'      => 'yes',
				'condition'    => array(
					'video-file[url]!' => '',
				),
			)
		);

		$this->start_popover();

		$this->add_control(
			'text_tracks',
			array(
				'label'         => esc_html__( 'Text track', 'godam' ),
				'type'          => Controls_Manager::REPEATER,
				'fields'        => array(
					array(
						'name'        => 'text_track',
						'label'       => esc_html__( 'Text track file', 'godam' ),
						'type'        => 'godam-media',
						'label_block' => true,
					),
					array(
						'name'        => 'text_track_title',
						'label'       => esc_html__( 'Label', 'godam' ),
						'description' => esc_html__( 'Title of track', 'godam' ),
						'type'        => Controls_Manager::TEXT,
						'label_block' => true,
					),
					array(
						'name'        => 'text_track_lang',
						'label'       => esc_html__( 'Source Language', 'godam' ),
						'description' => esc_html__( 'Language tag (en, fr, etc.)', 'godam' ),
						'type'        => Controls_Manager::TEXT,
						'label_block' => true,
					),
					array(
						'name'    => 'text_track_kind',
						'label'   => esc_html__( 'Kind', 'godam' ),
						'type'    => Controls_Manager::SELECT,
						'options' => array(
							'subtitles'    => esc_html__( 'Subtitles', 'godam' ),
							'captions'     => esc_html__( 'Captions', 'godam' ),
							'descriptions' => esc_html__( 'Descriptions', 'godam' ),
							'chapters'     => esc_html__( 'Chapters', 'godam' ),
							'metadata'     => esc_html__( 'Metadata', 'godam' ),
						),
					),
				),
				'prevent_empty' => false,
			)
		);

		$this->end_popover();

		$this->add_control(
			'seo_settings_popover_toggle',
			array(
				'label'        => esc_html__( 'SEO Settings', 'godam' ),
				'type'         => Controls_Manager::POPOVER_TOGGLE,
				'label_off'    => esc_html__( 'Default', 'godam' ),
				'label_on'     => esc_html__( 'Custom', 'godam' ),
				'return_value' => 'yes',
				'default'      => 'yes',
				'condition'    => array(
					'video-file[url]!' => '',
				),
			)
		);

		$this->start_popover();

		$this->add_control(
			'seo_content_url',
			array(
				'label'       => esc_html__( 'Content URL', 'godam' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
				'description' => esc_html__( 'URL of the video content can be MOV, MP4, MPD. Example: https://www.example.com/video.mp4', 'godam' ),
			)
		);

		$this->add_control(
			'seo_content_headline',
			array(
				'label'       => esc_html__( 'Headline', 'godam' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
				'description' => esc_html__( 'Title of the video', 'godam' ),
			)
		);

		$this->add_control(
			'seo_content_description',
			array(
				'label'       => esc_html__( 'Description', 'godam' ),
				'type'        => Controls_Manager::TEXTAREA,
				'label_block' => true,
				'description' => esc_html__( 'Description of the video', 'godam' ),
			)
		);

		$this->add_control(
			'seo_content_upload_date',
			array(
				'label'          => esc_html__( 'Upload Date', 'godam' ),
				'type'           => Controls_Manager::DATE_TIME,
				'picker_options' => array(
					'enableTime' => false,
				),
			)
		);

		$this->add_control(
			'seo_content_duration',
			array(
				'label'       => esc_html__( 'Duration', 'godam' ),
				'type'        => Controls_Manager::TEXT,
				'description' => esc_html__( 'ISO 8601 format. Example: PT1H30M', 'godam' ),
				'label_block' => true,
			)
		);

		$this->add_control(
			'seo_content_video_thumbnail_url',
			array(
				'label'       => esc_html__( 'Video Thumbnail URL', 'godam' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
			)
		);

		$this->add_control(
			'seo_content_family_friendly',
			array(
				'label'       => esc_html__( 'Is Family Friendly', 'godam' ),
				'type'        => Controls_Manager::SWITCHER,
				'description' => esc_html__( 'Is the video suitable for all audiences?', 'godam' ),
				'default'     => 'yes',
			)
		);

		$this->end_popover();

		$this->add_control(
			'autoplay',
			array(
				'label'     => esc_html__( 'Autoplay', 'godam' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'no',
				'condition' => array(
					'video-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'loop',
			array(
				'label'     => esc_html__( 'Loop', 'godam' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'no',
				'condition' => array(
					'video-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'muted',
			array(
				'label'     => esc_html__( 'Muted', 'godam' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'no',
				'condition' => array(
					'video-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'controls',
			array(
				'label'     => esc_html__( 'Playback controls', 'godam' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'yes',
				'condition' => array(
					'video-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'preload',
			array(
				'label'     => esc_html__( 'Preload', 'godam' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => 'metadata',
				'options'   => array(
					'auto'     => esc_html__( 'Auto', 'godam' ),
					'metadata' => esc_html__( 'Metadata', 'godam' ),
					'none'     => esc_html_x( 'None', 'Preload value', 'godam' ),
				),
				'condition' => array(
					'video-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'poster',
			array(
				'label'       => esc_html__( 'Video Thumbnail', 'godam' ),
				'type'        => 'godam-media',
				'media_type'  => 'image',
				'description' => esc_html__( 'Select the video thumbnail.', 'godam' ),
				'label_block' => true,
				'condition'   => array(
					'video-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'enable_caption',
			array(
				'label'     => esc_html__( 'Show caption', 'godam' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'yes',
				'condition' => array(
					'video-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'caption',
			array(
				'label'     => esc_html__( 'Caption', 'godam' ),
				'type'      => Controls_Manager::TEXTAREA,
				'condition' => array(
					'video-file[url]!' => '',
					'enable_caption'   => 'yes',
				),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Render GoDAM Video widget output on the frontend.
	 *
	 * @access protected
	 */
	protected function render() {
		$widget_video_file   = $this->get_settings_for_display( 'video-file' );
		$widget_poster_file  = $this->get_settings_for_display( 'poster' );
		$widget_autoplay     = 'yes' === $this->get_settings_for_display( 'autoplay' ) ? true : false;
		$widget_controls     = 'yes' === $this->get_settings_for_display( 'controls' ) ? true : false;
		$widget_muted        = 'yes' === $this->get_settings_for_display( 'muted' ) ? true : false;
		$widget_loop         = 'yes' === $this->get_settings_for_display( 'loop' ) ? true : false;
		$widget_preload      = $this->get_settings_for_display( 'preload' ) ?? 'auto';
		$widget_show_caption = 'yes' === $this->get_settings_for_display( 'enable_caption' );
		$widget_caption      = $this->get_settings_for_display( 'caption' ) ?? '';
		$widget_text_tracks  = $this->get_settings_for_display( 'text_tracks' ) ?? '';

		$formatted_tracks = array();

		foreach ( $widget_text_tracks as $track ) {
			$single_track            = array();
			$single_track['src']     = $track['text_track']['url'];
			$single_track['kind']    = $track['text_track_kind'];
			$single_track['label']   = $track['text_track_title'];
			$single_track['srclang'] = $track['text_track_lang'];

			array_push( $formatted_tracks, $single_track );
		}

		if ( ! $widget_show_caption ) {
			$widget_caption = '';
		}

		if ( ! isset( $widget_video_file['url'] ) || empty( $widget_video_file['url'] ) ) {
			return;
		}

		$attributes = array(
			'id'             => ! isset( $widget_video_file['sources'] ) ? $widget_video_file['id'] : null,
			'sources'        => isset( $widget_video_file['sources'] ) ? $widget_video_file['sources'] : array(),
			'src'            => $widget_video_file['url'],
			'transcoded_url' => '',
			'poster'         => $widget_poster_file['url'],
			'aspectRatio'    => '',
			'autoplay'       => $widget_autoplay,
			'controls'       => $widget_controls,
			'muted'          => $widget_muted,
			'loop'           => $widget_loop,
			'preload'        => $widget_preload,
			'caption'        => $widget_caption,
			'tracks'         => $formatted_tracks,
		);

		$is_elementor_widget = true;

		require RTGODAM_PATH . 'inc/templates/godam-player.php';
	}
}
