<?php
/**
 * Register Custom Widget - GoDAM Document
 *
 * Mirrors the godam/pdf ("Document") Gutenberg block and the WPBakery Document
 * element. Widget controls map to the [godam_document] shortcode, which itself
 * renders through assets/build/blocks/godam-pdf/render.php — so block,
 * shortcode, WPBakery element, and widget share one template and JS contract.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Elementor_Widgets;

use Elementor\Controls_Manager;

/**
 * GoDAM Document Widget.
 */
class Godam_Document extends Base {

	/**
	 * Default config for GoDAM Document Widget.
	 *
	 * @return array
	 */
	public function set_default_config() {
		return array(
			'name'            => 'godam-document',
			'title'           => _x( 'Document', 'Widget Title', 'godam' ),
			'icon'            => 'godam-eicon-document',
			'categories'      => array( 'godam' ),
			'keywords'        => array( 'godam', 'document', 'pdf', 'file' ),
			// The [godam_document] shortcode also enqueues these at render time;
			// declaring them lets Elementor account for the widget's assets.
			'depended_script' => array( 'godam-pdf-view-script' ),
			'depended_styles' => array( 'godam-pdf-style' ),
		);
	}

	/**
	 * Register Widget Controls.
	 *
	 * @access protected
	 */
	protected function register_controls() {
		$this->start_controls_section(
			'section_document_settings',
			array(
				'label' => esc_html__( 'Document Settings', 'godam' ),
			)
		);

		$this->add_control(
			'document-file',
			array(
				'label'       => esc_html__( 'Select Document', 'godam' ),
				'type'        => 'godam-media',
				// `media_type` (singular) is what godam-media.js reads to set the
				// WP Media Library `library.type` filter — restricting selection to
				// PDF files only. The control's file-picker branch renders for any
				// non-image/video type, so PDFs need no control changes.
				'media_type'  => 'application/pdf',
				'label_block' => true,
				'description' => esc_html__( 'Select a PDF document from the media library.', 'godam' ),
			)
		);

		$this->add_control(
			'doc_title',
			array(
				'label'       => esc_html__( 'Doc Title', 'godam' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
				'placeholder' => esc_html__( 'Add document title', 'godam' ),
				'description' => esc_html__( 'Leave empty to use the attachment title.', 'godam' ),
				'condition'   => array(
					'document-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'description',
			array(
				'label'       => esc_html__( 'Description', 'godam' ),
				'type'        => Controls_Manager::TEXTAREA,
				'label_block' => true,
				'description' => esc_html__( 'Shown in card view.', 'godam' ),
				'condition'   => array(
					'document-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'preview_mode',
			array(
				'label'       => esc_html__( 'View', 'godam' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'default',
				'options'     => array(
					'default' => esc_html__( 'Default View', 'godam' ),
					'card'    => esc_html__( 'Card View', 'godam' ),
				),
				'description' => esc_html__( 'Embedded PDF viewer, or a card with a cover image.', 'godam' ),
				'condition'   => array(
					'document-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'height',
			array(
				'label'      => esc_html__( 'Height (px)', 'godam' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px' ),
				'range'      => array(
					'px' => array(
						'min'  => 200,
						'max'  => 1200,
						'step' => 10,
					),
				),
				'default'    => array(
					'unit' => 'px',
					'size' => 600,
				),
				'condition'  => array(
					'document-file[url]!' => '',
					'preview_mode'        => 'default',
				),
			)
		);

		$this->add_control(
			'show_cover',
			array(
				'label'     => esc_html__( 'Show Cover', 'godam' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => '',
				'condition' => array(
					'document-file[url]!' => '',
					'preview_mode'        => 'card',
				),
			)
		);

		$this->add_control(
			'custom_cover',
			array(
				'label'       => esc_html__( 'Cover Image', 'godam' ),
				'type'        => 'godam-media',
				'media_type'  => 'image',
				'label_block' => true,
				'description' => esc_html__( 'Leave empty to use the auto-generated cover. Recommended aspect ratio: 16:9.', 'godam' ),
				'condition'   => array(
					'document-file[url]!' => '',
					'preview_mode'        => 'card',
					'show_cover'          => 'yes',
				),
			)
		);

		$this->add_control(
			'caption',
			array(
				'label'     => esc_html__( 'Caption', 'godam' ),
				'type'      => Controls_Manager::TEXTAREA,
				'condition' => array(
					'document-file[url]!' => '',
				),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Render GoDAM Document widget output on the frontend.
	 *
	 * @access protected
	 */
	protected function render() {
		$document_file = $this->get_settings_for_display( 'document-file' );

		if ( empty( $document_file['url'] ) ) {
			return;
		}

		// PDF is the only supported format. The shared render.php emits nothing for
		// anything else, which would leave a silently empty widget, so flag it in
		// the editor instead, where the author can act on it.
		if ( ! godam_is_supported_document( isset( $document_file['id'] ) ? $document_file['id'] : 0, $document_file['url'] ) ) {
			$this->render_unsupported_state();
			return;
		}

		$doc_title    = $this->get_settings_for_display( 'doc_title' ) ?? '';
		$description  = $this->get_settings_for_display( 'description' ) ?? '';
		$preview_mode = $this->get_settings_for_display( 'preview_mode' ) ?? 'default';
		$height       = $this->get_settings_for_display( 'height' );
		$show_cover   = 'yes' === $this->get_settings_for_display( 'show_cover' );
		$custom_cover = $this->get_settings_for_display( 'custom_cover' );
		$caption      = $this->get_settings_for_display( 'caption' ) ?? '';

		$shortcode_atts = array(
			'id'           => isset( $document_file['id'] ) ? $document_file['id'] : '',
			'src'          => $document_file['url'],
			'doc_title'    => $doc_title,
			'description'  => $description,
			'preview_mode' => $preview_mode,
			'height'       => ! empty( $height['size'] ) ? intval( $height['size'] ) : 600,
			'show_cover'   => $show_cover ? 'true' : 'false',
			'custom_cover' => isset( $custom_cover['url'] ) ? $custom_cover['url'] : '',
			'caption'      => $caption,
		);

		// Call the shortcode renderer directly with the raw attributes instead of
		// building a "[godam_document …]" string. Round-tripping the free-text
		// fields (doc_title/description/caption) through a shortcode string breaks
		// on a "]" (it truncates the tag, dropping every later attribute and
		// leaking the remainder as raw text), lets a "[…]" inject an unintended
		// shortcode, and double-encodes entities via esc_attr(). render() enqueues
		// its own script/style and returns escaped HTML.
		echo \RTGODAM\Inc\Shortcodes\GoDAM_Document::get_instance()->render( $shortcode_atts ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- render() returns escaped HTML.
	}

	/**
	 * Show an "unsupported format" notice for a non-PDF document.
	 *
	 * Only rendered while editing or previewing in Elementor: on the published page
	 * the widget outputs nothing at all, so visitors never see this.
	 *
	 * @since 2.1.0
	 *
	 * @access protected
	 */
	protected function render_unsupported_state() {
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return;
		}

		$plugin        = \Elementor\Plugin::$instance;
		$is_editing    = isset( $plugin->editor ) && $plugin->editor->is_edit_mode();
		$is_previewing = isset( $plugin->preview ) && $plugin->preview->is_preview_mode();
		if ( ! $is_editing && ! $is_previewing ) {
			return;
		}

		$icon_style = '--godam-preview-icon:url(' . esc_url( RTGODAM_URL . 'assets/images/godam-pdf.svg' ) . ');';
		?>
		<div class="godam-document-elementor-unsupported" data-test-id="godam-document-elementor-unsupported">
			<span class="godam-document-elementor-unsupported__icon" aria-hidden="true" style="<?php echo esc_attr( $icon_style ); ?>"></span>
			<h3 class="godam-document-elementor-unsupported__title">
				<?php esc_html_e( 'Unsupported file format', 'godam' ); ?>
			</h3>
			<p class="godam-document-elementor-unsupported__desc">
				<?php esc_html_e( 'Only PDF files are supported. Select a PDF in the Document Settings panel; the current file will not be shown on your page.', 'godam' ); ?>
			</p>
		</div>
		<?php
	}
}
