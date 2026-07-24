<?php
/**
 * Register Custom Widget - GoDAM Audio
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Elementor_Widgets;

use Elementor\Controls_Manager;

/**
 * GoDAM Gallery Widget.
 */
class Godam_Audio extends Base {

	/**
	 * Default config for GoDAM Audio Widget.
	 *
	 * @return array
	 */
	public function set_default_config() {
		return array(
			'name'            => 'godam-audio',
			'title'           => _x( 'GoDAM Audio', 'Widget Title', 'godam' ),
			'icon'            => 'godam-eicon-audio',
			'categories'      => array( 'godam' ),
			'keywords'        => array( 'godam', 'audio', 'podcast', 'sound' ),
			// The redesigned player + Chapters/Transcript panel is driven by the
			// block's own view script and stylesheet (registered by
			// register_block_type()), so the widget reuses them instead of the old
			// bare-<audio> stylesheet — this keeps it visually identical to the
			// Gutenberg block and the WPBakery element.
			'depended_script' => array( 'godam-audio-view-script' ),
			'depended_styles' => array( 'godam-audio-style' ),
		);
	}

	/**
	 * Register Widget Controls.
	 *
	 * Mirrors the redesigned godam/audio block inspector (and the WPBakery
	 * element): media selection, optional title/description/cover overrides, the
	 * playback switches, and the Chapters/Transcript panel toggles.
	 *
	 * @access protected
	 */
	protected function register_controls() {
		$this->start_controls_section(
			'section_audio_settings',
			array(
				'label' => __( 'Player Settings', 'godam' ),
			)
		);

		$this->add_control(
			'audio-file',
			array(
				'label'       => __( 'Audio File', 'godam' ),
				'type'        => 'godam-media',
				'label_block' => true,
				'media_type'  => 'audio',
				'description' => __( 'Select the audio file', 'godam' ),
			)
		);

		$this->add_control(
			'audio_title',
			array(
				'label'       => __( 'Audio Title', 'godam' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
				'description' => __( 'Title shown in the player. Leave empty to use the attachment title.', 'godam' ),
				'condition'   => array(
					'audio-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'description',
			array(
				'label'       => __( 'Description', 'godam' ),
				'type'        => Controls_Manager::TEXTAREA,
				'description' => __( 'Short description shown beneath the title.', 'godam' ),
				'condition'   => array(
					'audio-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'thumbnail',
			array(
				'label'       => __( 'Thumbnail', 'godam' ),
				'type'        => 'godam-media',
				'media_type'  => 'image',
				'label_block' => true,
				'description' => __( 'Cover image for the player. Leave empty to use the GoDAM-generated cover.', 'godam' ),
				'condition'   => array(
					'audio-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'autoplay',
			array(
				'label'       => __( 'Autoplay', 'godam' ),
				'type'        => Controls_Manager::SWITCHER,
				'default'     => 'no',
				'description' => __( 'Autoplay may cause usability issues for some users.', 'godam' ),
				'condition'   => array(
					'audio-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'loop',
			array(
				'label'     => __( 'Loop', 'godam' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'no',
				'condition' => array(
					'audio-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'preload',
			array(
				'label'     => __( 'Preload', 'godam' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => 'metadata',
				'options'   => array(
					''         => esc_html__( 'Browser default', 'godam' ),
					'auto'     => esc_html__( 'Auto', 'godam' ),
					'metadata' => esc_html__( 'Metadata', 'godam' ),
					'none'     => esc_html_x( 'None', 'Preload value', 'godam' ),
				),
				'condition' => array(
					'audio-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'show_transcript',
			array(
				'label'       => __( 'Show Transcript', 'godam' ),
				'type'        => Controls_Manager::SWITCHER,
				'default'     => 'yes',
				'description' => __( 'Show the transcript panel (when a transcript is available).', 'godam' ),
				'condition'   => array(
					'audio-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'show_chapters',
			array(
				'label'       => __( 'Show Chapters', 'godam' ),
				'type'        => Controls_Manager::SWITCHER,
				'default'     => 'yes',
				'description' => __( 'Show the chapters panel (when chapters are available).', 'godam' ),
				'condition'   => array(
					'audio-file[url]!' => '',
				),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Render GoDAM Audio widget output on the frontend.
	 *
	 * Reuses the audio block's render.php (the single source of truth shared by
	 * the block, the [godam_audio] shortcode and the WPBakery element) so the
	 * widget outputs the same custom player and Chapters/Transcript panel. The
	 * widget settings are mapped into the block's camelCase attribute shape that
	 * render.php consumes; title/cover/transcript/chapters fall back to the
	 * attachment's own data when left empty.
	 *
	 * @access protected
	 */
	protected function render() {
		$audio_file = $this->get_settings_for_display( 'audio-file' );

		// A GoDAM Audio needs a source; nothing to render without one.
		if ( empty( $audio_file['url'] ) ) {
			$this->render_empty_state();
			return;
		}

		$thumbnail = $this->get_settings_for_display( 'thumbnail' );

		// Map widget settings to the block attribute shape render.php reads.
		$attributes = array(
			'id'             => isset( $audio_file['id'] ) ? $audio_file['id'] : '',
			'src'            => $audio_file['url'],
			'autoplay'       => 'yes' === $this->get_settings_for_display( 'autoplay' ),
			'loop'           => 'yes' === $this->get_settings_for_display( 'loop' ),
			'preload'        => $this->get_settings_for_display( 'preload' ) ?? 'metadata',
			'audioTitle'     => $this->get_settings_for_display( 'audio_title' ) ?? '',
			'description'    => $this->get_settings_for_display( 'description' ) ?? '',
			'thumbnail'      => isset( $thumbnail['url'] ) ? $thumbnail['url'] : '',
			'showTranscript' => 'yes' === $this->get_settings_for_display( 'show_transcript' ),
			'showChapters'   => 'yes' === $this->get_settings_for_display( 'show_chapters' ),
		);

		// Enqueue the block's front-end script + styles so the widget gets the
		// same custom player and Chapters/Transcript panel as the block. These
		// handles are registered by register_block_type() (see class-blocks.php);
		// WordPress auto-enqueues them for the block, but not when the shared
		// render.php is included directly here.
		wp_enqueue_script( 'godam-audio-view-script' );
		wp_enqueue_style( 'godam-audio-style' );

		// Tells the shared render.php it runs outside block context, so it skips
		// get_block_wrapper_attributes() (which warns without a block) and still
		// emits the stable `godam-audio` hook class that view.js targets.
		$godam_is_shortcode = true;

		require RTGODAM_PATH . 'assets/build/blocks/godam-audio/render.php';
	}

	/**
	 * Editor-only empty-state placeholder.
	 *
	 * Mirrors the Gutenberg block's empty state (a titled prompt) so an
	 * audio-less widget reads clearly in the editor instead of showing a bare,
	 * confusing box. The widget preview renders inside Elementor's preview iframe
	 * where the plugin's editor stylesheet isn't loaded, so the styling is kept
	 * self-contained inline. Nothing is output on the front end — an unset widget
	 * renders nothing there.
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

		$icon_url = RTGODAM_URL . 'assets/images/godam-audio-filled.svg';
		?>
		<div
			class="godam-audio-elementor-empty"
			data-test-id="godam-audio-elementor-empty"
			style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px;padding:40px 24px;border:1px dashed #c3c4c7;border-radius:8px;background:#f6f7f7;color:#1e1e1e;"
		>
			<span
				aria-hidden="true"
				style="width:40px;height:40px;margin-bottom:4px;opacity:.55;background:url('<?php echo esc_url( $icon_url ); ?>') center/contain no-repeat;"
			></span>
			<h3 style="margin:0;font-size:15px;font-weight:600;line-height:1.3;">
				<?php esc_html_e( 'Add an audio file', 'godam' ); ?>
			</h3>
			<p style="margin:0;max-width:320px;font-size:13px;color:#646970;line-height:1.5;">
				<?php esc_html_e( 'Select an audio file in the Player Settings panel to embed a player on your page or post.', 'godam' ); ?>
			</p>
		</div>
		<?php
	}
}
