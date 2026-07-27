<?php
/**
 * Register Custom Widget - GoDAM Image
 *
 * Mirrors the godam/image Gutenberg block: pick an image attachment and toggle
 * whether the hotspot / product layers authored in the GoDAM image editor are
 * overlaid. render() reuses the block's render.php (the single source of truth
 * shared by the block, the [godam_image] shortcode and the WPBakery element),
 * so block, shortcode, WPBakery, and widget all produce identical markup.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Elementor_Widgets;

use Elementor\Controls_Manager;

/**
 * GoDAM Image Widget.
 */
class Godam_Image extends Base {

	/**
	 * Default config for GoDAM Image Widget.
	 *
	 * @return array
	 */
	public function set_default_config() {
		return array(
			'name'            => 'godam-image',
			'title'           => _x( 'GoDAM Image', 'Widget Title', 'godam' ),
			'icon'            => 'godam-eicon-image',
			'categories'      => array( 'godam' ),
			'keywords'        => array( 'godam', 'image', 'hotspot', 'shoppable' ),
			// The block's hotspot/product layers front-end script is registered
			// lazily by render.php (only when the image actually has layers); the
			// styles below are the block's own registered handles.
			'depended_styles' => array( 'godam-image-style', 'godam-player-style' ),
		);
	}

	/**
	 * Register Widget Controls.
	 *
	 * Mirrors the block's "Image Selection" inspector panel: the media picker and
	 * the "Show image layers" toggle.
	 *
	 * @access protected
	 */
	protected function register_controls() {
		$this->start_controls_section(
			'section_image_settings',
			array(
				'label' => esc_html__( 'Image Selection', 'godam' ),
			)
		);

		$this->add_control(
			'image-file',
			array(
				'label'       => esc_html__( 'Image', 'godam' ),
				'type'        => 'godam-media',
				'media_type'  => 'image',
				'label_block' => true,
				'description' => esc_html__( 'Select an image. Hotspot and product layers authored in the GoDAM image editor are overlaid on the front end.', 'godam' ),
			)
		);

		$this->add_control(
			'show_image_layers',
			array(
				'label'        => esc_html__( 'Show image layers', 'godam' ),
				'type'         => Controls_Manager::SWITCHER,
				'default'      => 'yes',
				// Be explicit about the stored value rather than relying on the
				// implicit Elementor default, so render() reads a stable 'yes'/''.
				'return_value' => 'yes',
				'description'  => esc_html__( 'Overlays the hotspot / product layers authored in the GoDAM image editor.', 'godam' ),
				'condition'    => array(
					'image-file[url]!' => '',
				),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Render GoDAM Image widget output on the frontend.
	 *
	 * Delegates to the [godam_image] shortcode's renderer (the single mapping /
	 * enqueue / render.php entry point shared with the WPBakery element), matching
	 * the GoDAM Document widget. The alt text is pulled from the attachment
	 * (mirroring the block, which seeds `alt` from the media on selection); there
	 * is no alt control because it is not author-editable in the block inspector.
	 * URL and alt are sanitized here as defense-in-depth before they reach the
	 * shared renderer.
	 *
	 * @access protected
	 */
	protected function render() {
		$image_file = $this->get_settings_for_display( 'image-file' );

		$image_id  = isset( $image_file['id'] ) ? absint( $image_file['id'] ) : 0;
		$image_url = isset( $image_file['url'] ) ? $image_file['url'] : '';

		// A GoDAM Image needs either an attachment ID or a source URL.
		if ( empty( $image_id ) && empty( $image_url ) ) {
			$this->render_empty_state();
			return;
		}

		// Mirror the block: alt comes from the attachment's stored alt text.
		$alt = $image_id ? (string) get_post_meta( $image_id, '_wp_attachment_image_alt', true ) : '';

		$shortcode_atts = array(
			'id'                => $image_id,
			'url'               => esc_url_raw( $image_url ),
			'alt'               => sanitize_text_field( $alt ),
			'show_image_layers' => 'yes' === $this->get_settings_for_display( 'show_image_layers' ) ? 'true' : 'false',
		);

		// render() maps the atts, enqueues its own script/style, and returns
		// escaped HTML — so no extra enqueues or render.php include are needed here.
		echo \RTGODAM\Inc\Shortcodes\GoDAM_Image::get_instance()->render( $shortcode_atts ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- render() returns escaped HTML.
	}

	/**
	 * Editor-only empty-state placeholder.
	 *
	 * Mirrors the Gutenberg block's empty state so an image-less widget reads
	 * clearly in the editor instead of showing a bare, confusing box. The widget
	 * preview renders inside Elementor's preview iframe where the plugin's editor
	 * stylesheet isn't loaded, so the styling ships as a small self-contained
	 * <style> block (printed once per request, scoped to the placeholder's
	 * classes). Nothing renders on the front end.
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

		// Print the scoped stylesheet only once per request even if several empty
		// image widgets render on the same page.
		static $style_printed = false;
		if ( ! $style_printed ) {
			$style_printed = true;
			$icon_url      = RTGODAM_URL . 'assets/src/images/godam-image-filled.svg';
			?>
			<style>
				.godam-image-elementor-empty {
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					text-align: center;
					gap: 6px;
					padding: 40px 24px;
					border: 1px dashed #c3c4c7;
					border-radius: 8px;
					background: #f6f7f7;
					color: #1e1e1e;
				}
				/* Dummy image preview: a framed box with a faint image glyph, echoing the block's placeholder. */
				.godam-image-elementor-empty__preview {
					width: 180px;
					max-width: 60%;
					aspect-ratio: 16 / 10;
					margin-bottom: 12px;
					border-radius: 6px;
					background-color: #e6e7e9;
					background-image: url('<?php echo esc_url( $icon_url ); ?>');
					background-repeat: no-repeat;
					background-position: center;
					background-size: 44px auto;
					box-shadow: inset 0 0 0 1px rgba( 0, 0, 0, .06 );
				}
				.godam-image-elementor-empty__title {
					margin: 0;
					font-size: 15px;
					font-weight: 600;
					line-height: 1.3;
				}
				.godam-image-elementor-empty__desc {
					margin: 0;
					max-width: 340px;
					font-size: 13px;
					color: #646970;
					line-height: 1.5;
				}
			</style>
			<?php
		}
		?>
		<div class="godam-image-elementor-empty" data-test-id="godam-image-elementor-empty">
			<div class="godam-image-elementor-empty__preview" aria-hidden="true"></div>
			<h3 class="godam-image-elementor-empty__title">
				<?php esc_html_e( 'Add Image Here', 'godam' ); ?>
			</h3>
			<p class="godam-image-elementor-empty__desc">
				<?php esc_html_e( 'Select an image in the Image Selection panel to get started.', 'godam' ); ?>
			</p>
		</div>
		<?php
	}
}
