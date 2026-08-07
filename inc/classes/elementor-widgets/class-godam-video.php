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
			'title'           => _x( 'Video', 'Widget Title', 'godam' ),
			'icon'            => 'godam-eicon-video',
			'categories'      => array( 'godam' ),
			'keywords'        => array( 'godam', 'video' ),
			'depended_script' => array( 'godam-player-frontend-script', 'godam-player-analytics-script', 'godam-player-frontend-script', 'godam-elementor-frontend' ),
			'depended_styles' => array( 'godam-player-style', 'godam-player-minimal-skin', 'godam-player-pills-skin', 'godam-player-bubble-skin', 'godam-player-classic-skin' ),
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
			'seo_override',
			array(
				'label'       => esc_html__( 'Override default SEO', 'godam' ),
				'type'        => Controls_Manager::SWITCHER,
				'description' => esc_html__( 'Enable to customize SEO for this specific widget. When disabled, SEO data is synced from the media library.', 'godam' ),
				'default'     => '',
				'classes'     => 'godam-seo-override-toggle',
			)
		);

		$this->add_control(
			'seo_override_notice',
			array(
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => '<div class="godam-seo-notice godam-seo-notice--info">' . esc_html__( 'SEO data is automatically synced from the media library. Any changes made to the video in the media library will be reflected on the frontend.', 'godam' ) . '</div>',
				'content_classes' => 'godam-seo-notice-wrapper',
				'condition'       => array(
					'seo_override!' => 'yes',
				),
			)
		);

		$this->add_control(
			'seo_override_warning',
			array(
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => '<div class="godam-seo-notice godam-seo-notice--warning">' . esc_html__( 'You have overridden the default SEO. Changes to this video in the media library will not update the SEO for this widget.', 'godam' ) . '</div>',
				'content_classes' => 'godam-seo-notice-wrapper',
				'condition'       => array(
					'seo_override' => 'yes',
				),
			)
		);

		$this->add_control(
			'seo_content_url',
			array(
				'label'       => esc_html__( 'Content URL', 'godam' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
				'description' => esc_html__( 'URL of the video content can be MOV, MP4, MPD. Example: https://www.example.com/video.mp4', 'godam' ),
				'classes'     => 'godam-readonly-field',
				'attributes'  => array(
					'readonly' => 'readonly',
				),
			)
		);

		$this->add_control(
			'seo_content_headline',
			array(
				'label'       => esc_html__( 'Headline', 'godam' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
				'description' => esc_html__( 'Title of the video', 'godam' ),
				'classes'     => 'godam-seo-field',
			)
		);

		$this->add_control(
			'seo_content_description',
			array(
				'label'       => esc_html__( 'Description', 'godam' ),
				'type'        => Controls_Manager::TEXTAREA,
				'label_block' => true,
				'description' => '<span class="godam-seo-description-help"></span>',
				'classes'     => 'godam-seo-description-field godam-seo-field',
			)
		);

		$this->add_control(
			'seo_content_upload_date',
			array(
				'label'          => esc_html__( 'Upload Date', 'godam' ),
				'type'           => Controls_Manager::DATE_TIME,
				'picker_options' => array(
					'enableTime' => false,
					'clickOpens' => false,
				),
				'classes'        => 'godam-readonly-field',
				'attributes'     => array(
					'readonly' => 'readonly',
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
				'classes'     => 'godam-readonly-field',
				'attributes'  => array(
					'readonly' => 'readonly',
				),
			)
		);

		$this->add_control(
			'seo_content_video_thumbnail_url',
			array(
				'label'       => esc_html__( 'Video Thumbnail URL', 'godam' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
				'classes'     => 'godam-readonly-field',
				'attributes'  => array(
					'readonly' => 'readonly',
				),
			)
		);

		$this->add_control(
			'seo_content_family_friendly',
			array(
				'label'       => esc_html__( 'Is Family Friendly', 'godam' ),
				'type'        => Controls_Manager::SWITCHER,
				'description' => esc_html__( 'Is the video suitable for all audiences?', 'godam' ),
				'default'     => 'yes',
				'classes'     => 'godam-seo-field',
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
				'label'       => esc_html__( 'Muted', 'godam' ),
				'type'        => Controls_Manager::SWITCHER,
				'default'     => 'no',
				'description' => esc_html__( 'Forced on when Autoplay is enabled — most browsers block autoplay with sound.', 'godam' ),
				// Visual disable when autoplay is on is applied by editor.js
				// (mirrors the block, which disables rather than hides).
				'classes'     => 'godam-elementor-autoplay-locked',
				'condition'   => array(
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
			'show_in_lightbox',
			array(
				'label'       => esc_html__( 'Show in lightbox', 'godam' ),
				'type'        => Controls_Manager::SWITCHER,
				'default'     => '',
				'description' => esc_html__( 'Open the video in a lightbox when clicked.', 'godam' ),
				'condition'   => array(
					'video-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'performance_mode',
			array(
				'label'     => esc_html__( 'Performance Mode', 'godam' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => 'balanced',
				'options'   => array(
					'balanced' => esc_html__( 'Balanced', 'godam' ),
					'priority' => esc_html__( 'Priority', 'godam' ),
				),
				'condition' => array(
					'video-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'hover_select',
			array(
				'label'       => esc_html__( 'Hover Option', 'godam' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'none',
				'options'     => array(
					'none'                 => esc_html__( 'None', 'godam' ),
					'show-player-controls' => esc_html__( 'Show Player Controls', 'godam' ),
					'start-preview'        => esc_html__( 'Start Preview', 'godam' ),
				),
				'description' => esc_html__( 'Choose the action to perform on video hover. Disabled when Autoplay is on.', 'godam' ),
				// Visual disable when autoplay is on is applied by editor.js
				// (mirrors the block, which disables rather than hides).
				'classes'     => 'godam-elementor-autoplay-locked',
				'condition'   => array(
					'video-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'show_share_button',
			array(
				'label'     => esc_html__( 'Show Share Button', 'godam' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => '',
				'condition' => array(
					'video-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'show_transcription',
			array(
				'label'       => esc_html__( 'Show Transcription', 'godam' ),
				'type'        => Controls_Manager::SWITCHER,
				'default'     => '',
				'description' => esc_html__( 'Show the transcript panel toggle on the player (when a transcript is available).', 'godam' ),
				'condition'   => array(
					'video-file[url]!' => '',
				),
			)
		);

		if ( rtgodam_is_engagement_feature_enabled() ) {
			$this->add_control(
				'engagements',
				array(
					'label'     => esc_html__( 'Enable Engagements', 'godam' ),
					'type'      => Controls_Manager::SWITCHER,
					'default'   => '',
					'condition' => array(
						'video-file[url]!' => '',
					),
				)
			);
		}

		$this->add_control(
			'aspect_ratio',
			array(
				'label'       => esc_html__( 'Aspect Ratio', 'godam' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'responsive',
				'options'     => array(
					'responsive' => esc_html__( 'Original', 'godam' ),
					'16:9'       => esc_html__( '16:9 (Standard)', 'godam' ),
				),
				'description' => esc_html__( 'Choose the aspect ratio for the video player.', 'godam' ),
				'condition'   => array(
					'video-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'player_height',
			array(
				'label'       => esc_html__( 'Player Height', 'godam' ),
				'type'        => Controls_Manager::TEXT,
				'placeholder' => '400px',
				'description' => esc_html__( 'Constrain player height (e.g. 400px, 50vh). Width is derived from aspect ratio.', 'godam' ),
				'condition'   => array(
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

		// Container for the JS-rendered thumbnail grid (auto-generated and
		// custom thumbnails for the selected video). Hydrated by
		// assets/src/js/elementor/editor.js — see the
		// `panel/open_editor/widget/godam-video` handler.
		$this->add_control(
			'godam_thumbnail_picker',
			array(
				'type'      => Controls_Manager::RAW_HTML,
				'raw'       => '<div class="godam-elementor-thumbnail-picker" data-godam-thumbnail-picker>'
					. '<p class="godam-elementor-thumbnail-picker__label">' . esc_html__( 'Or pick an auto-generated thumbnail', 'godam' ) . '</p>'
					. '<div class="godam-elementor-thumbnail-picker__grid" data-godam-thumbnail-grid></div>'
					. '<p class="godam-elementor-thumbnail-picker__empty" data-godam-thumbnail-empty hidden>' . esc_html__( 'No auto-generated thumbnails available for this video.', 'godam' ) . '</p>'
					. '</div>',
				'condition' => array(
					'video-file[url]!' => '',
					'video-file[id]!'  => '',
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
		$widget_video_file         = $this->get_settings_for_display( 'video-file' );
		$widget_poster_file        = $this->get_settings_for_display( 'poster' );
		$widget_autoplay           = 'yes' === $this->get_settings_for_display( 'autoplay' ) ? true : false;
		$widget_controls           = 'yes' === $this->get_settings_for_display( 'controls' ) ? true : false;
		$widget_muted              = 'yes' === $this->get_settings_for_display( 'muted' ) ? true : false;
		$widget_loop               = 'yes' === $this->get_settings_for_display( 'loop' ) ? true : false;
		$widget_show_caption       = 'yes' === $this->get_settings_for_display( 'enable_caption' );
		$widget_caption            = $this->get_settings_for_display( 'caption' ) ?? '';
		$widget_text_tracks        = $this->get_settings_for_display( 'text_tracks' ) ?? '';
		$widget_performance_mode   = $this->get_settings_for_display( 'performance_mode' ) ?? 'balanced';
		$widget_hover_select       = $this->get_settings_for_display( 'hover_select' ) ?? 'none';
		$widget_show_share_button  = 'yes' === $this->get_settings_for_display( 'show_share_button' );
		$widget_show_transcription = 'yes' === $this->get_settings_for_display( 'show_transcription' );
		$widget_show_in_lightbox   = 'yes' === $this->get_settings_for_display( 'show_in_lightbox' );
		$widget_engagements        = rtgodam_is_engagement_feature_enabled() && 'yes' === $this->get_settings_for_display( 'engagements' );
		$widget_player_height      = $this->get_settings_for_display( 'player_height' ) ?? '';
		$widget_aspect_ratio       = $this->get_settings_for_display( 'aspect_ratio' ) ?? 'responsive';
		$widget_seo_override       = 'yes' === $this->get_settings_for_display( 'seo_override' );
		$widget_seo                = array(
			'contentUrl'       => $this->get_settings_for_display( 'seo_content_url' ) ?? '',
			'headline'         => $this->get_settings_for_display( 'seo_content_headline' ) ?? '',
			'description'      => $this->get_settings_for_display( 'seo_content_description' ) ?? '',
			'uploadDate'       => $this->get_settings_for_display( 'seo_content_upload_date' ) ?? '',
			'duration'         => $this->get_settings_for_display( 'seo_content_duration' ) ?? '',
			'thumbnailUrl'     => $this->get_settings_for_display( 'seo_content_video_thumbnail_url' ) ?? '',
			'isFamilyFriendly' => 'yes' === ( $this->get_settings_for_display( 'seo_content_family_friendly' ) ?? 'yes' ),
		);

		// Mirror the block: hoverSelect is mutually exclusive with autoplay.
		if ( $widget_autoplay ) {
			$widget_hover_select = 'none';
		}

		// Mirror the block: autoplay must be muted (browser policies block
		// autoplay-with-sound), so force muted on whenever autoplay is enabled.
		if ( $widget_autoplay ) {
			$widget_muted = true;
		}

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
			$this->render_empty_state();
			return;
		}

		// Always pass the attachment ID when available so the template can fall
		// back to the media-library default thumbnail (rtgodam_media_video_thumbnail
		// meta) when no explicit poster is set — matching the block's behavior.
		$widget_attachment_id = isset( $widget_video_file['id'] ) ? $widget_video_file['id'] : null;

		$attributes = array(
			'id'                => $widget_attachment_id,
			'sources'           => isset( $widget_video_file['sources'] ) ? $widget_video_file['sources'] : array(),
			'src'               => $widget_video_file['url'],
			'transcoded_url'    => '',
			'poster'            => isset( $widget_poster_file['url'] ) ? $widget_poster_file['url'] : '',
			'aspectRatio'       => $widget_aspect_ratio,
			'autoplay'          => $widget_autoplay,
			'controls'          => $widget_controls,
			'muted'             => $widget_muted,
			'loop'              => $widget_loop,
			'caption'           => $widget_caption,
			'tracks'            => $formatted_tracks,
			'performanceMode'   => $widget_performance_mode,
			'hoverSelect'       => $widget_hover_select,
			'showShareButton'   => $widget_show_share_button,
			'showTranscription' => $widget_show_transcription,
			'showInLightbox'    => $widget_show_in_lightbox,
			'engagements'       => $widget_engagements,
			'playerHeight'      => $widget_player_height,
			'seo'               => $widget_seo,
			'seoOverride'       => $widget_seo_override,
		);

		$is_elementor_widget = true;

		// In the Elementor editor preview only, overlay static share / transcript
		// indicators on top of the player so they read as persistent top-right
		// icons — matching the Gutenberg block editor. The live player only adds
		// these to the video.js control bar and gates the transcript button on an
		// actual transcript, so they wouldn't reliably show while designing. The
		// published front end is unaffected (this branch never runs there).
		if ( $this->is_editor_preview() && ( $widget_show_share_button || $widget_show_transcription ) ) {
			ob_start();
			require RTGODAM_PATH . 'inc/templates/godam-player.php';
			$godam_player_html = ob_get_clean();
			$this->render_editor_button_overlay( $godam_player_html, $widget_show_share_button, $widget_show_transcription );
			return;
		}

		require RTGODAM_PATH . 'inc/templates/godam-player.php';
	}

	/**
	 * Whether we're rendering inside the Elementor editor or its preview iframe.
	 *
	 * @return bool
	 */
	protected function is_editor_preview() {
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return false;
		}
		$plugin = \Elementor\Plugin::$instance;
		return ( isset( $plugin->editor ) && $plugin->editor->is_edit_mode() )
			|| ( isset( $plugin->preview ) && $plugin->preview->is_preview_mode() );
	}

	/**
	 * Wrap the player markup with static top-right share / transcript icons for
	 * the editor preview (mirrors the Gutenberg block editor). Uses the same
	 * icons as the block; styling is self-contained (the preview iframe doesn't
	 * load the plugin's editor stylesheet) and printed once per request. The
	 * live player's own control-bar buttons are hidden within this wrapper so
	 * the two never duplicate.
	 *
	 * @param string $player_html        The rendered player markup.
	 * @param bool   $show_share         Whether the share indicator should show.
	 * @param bool   $show_transcription Whether the transcript indicator should show.
	 * @return void
	 */
	protected function render_editor_button_overlay( $player_html, $show_share, $show_transcription ) {
		$share_svg      = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" focusable="false"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" /></svg>';
		$transcript_svg = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false"><path d="M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z" stroke="currentColor" stroke-width="1.6" /><path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>';

		$overlay = '';
		// Transcript sits on top; share moves below it when both are shown
		// (mirrors the block editor's stacking order).
		if ( $show_transcription ) {
			$overlay .= '<span class="godam-elementor-video-overlay__btn godam-elementor-video-overlay__btn--transcript" aria-hidden="true">' . $transcript_svg . '</span>';
		}
		if ( $show_share ) {
			$below    = $show_transcription ? ' godam-elementor-video-overlay__btn--below' : '';
			$overlay .= '<span class="godam-elementor-video-overlay__btn godam-elementor-video-overlay__btn--share' . $below . '" aria-hidden="true">' . $share_svg . '</span>';
		}

		// Styling lives in the enqueued preview stylesheet
		// (assets/src/css/godam-elementor-preview.scss).
		echo '<div class="godam-elementor-video-overlay">' . $player_html . $overlay . '</div>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- $player_html is plugin-generated escaped markup; $overlay is static plugin markup.
	}

	/**
	 * Editor-only empty-state placeholder.
	 *
	 * Mirrors the Gutenberg block's empty state (a dummy video preview + prompt)
	 * so a video-less widget reads clearly in the editor instead of showing a
	 * bare, confusing box — consistent with the GoDAM Image / Audio / Gallery
	 * widgets. Styling is enqueued into the preview iframe (see
	 * Elementor_Widgets::enqueue_preview_styles / godam-elementor-preview.scss);
	 * only the dynamic icon URL is passed inline via a CSS custom property.
	 * Nothing renders on the front end.
	 *
	 * @access protected
	 * @return void
	 */
	protected function render_empty_state() {
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return;
		}

		$plugin        = \Elementor\Plugin::$instance;
		$is_editing    = isset( $plugin->editor ) && $plugin->editor->is_edit_mode();
		$is_previewing = isset( $plugin->preview ) && $plugin->preview->is_preview_mode();
		if ( ! $is_editing && ! $is_previewing ) {
			return;
		}

		$icon_style = '--godam-preview-icon:url(' . esc_url( RTGODAM_URL . 'assets/images/godam-video-filled.svg' ) . ');';
		?>
		<div class="godam-video-elementor-empty" data-test-id="godam-video-elementor-empty">
			<div class="godam-video-elementor-empty__preview" aria-hidden="true" style="<?php echo esc_attr( $icon_style ); ?>"></div>
			<h3 class="godam-video-elementor-empty__title">
				<?php esc_html_e( 'Add Video Here', 'godam' ); ?>
			</h3>
			<p class="godam-video-elementor-empty__desc">
				<?php esc_html_e( 'Select a video in the Player Settings panel to get started.', 'godam' ); ?>
			</p>
		</div>
		<?php
	}
}
