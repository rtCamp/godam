<?php
/**
 * Register Custom Widget - GoDAM PDF
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Elementor_Widgets;

use Elementor\Controls_Manager;

/**
 * GoDAM PDF Widget.
 */
class GoDAM_PDF extends Base {

	/**
	 * Default config for GoDAM PDF Widget.
	 *
	 * @return array
	 */
	public function set_default_config() {
		return array(
			'name'       => 'godam-pdf',
			'title'      => _x( 'GoDAM PDF', 'Widget Title', 'godam' ),
			'icon'       => 'eicon-document-file',
			'categories' => array( 'godam' ),
			'keywords'   => array( 'godam', 'pdf', 'document' ),
		);
	}

	/**
	 * Register Widget Controls.
	 *
	 * @access protected
	 */
	protected function register_controls() {
		$this->start_controls_section(
			'section_pdf_settings',
			array(
				'label' => __( 'PDF Settings', 'godam' ),
			)
		);

		$this->add_control(
			'pdf-file',
			array(
				'label'       => __( 'PDF File', 'godam' ),
				'type'        => 'godam-media',
				'label_block' => true,
				'media_type'  => 'application/pdf',
				'description' => __( 'Select the PDF file', 'godam' ),
			)
		);

		$this->add_control(
			'height',
			array(
				'label'     => __( 'Height (px)', 'godam' ),
				'type'      => Controls_Manager::NUMBER,
				'default'   => 600,
				'condition' => array(
					'pdf-file[url]!' => '',
				),
			)
		);

		$this->add_control(
			'caption',
			array(
				'label'     => __( 'Caption', 'godam' ),
				'type'      => Controls_Manager::TEXTAREA,
				'condition' => array(
					'pdf-file[url]!' => '',
				),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Render GoDAM PDF widget output on the frontend.
	 *
	 * @access protected
	 */
	protected function render() {
		$pdf_file            = $this->get_settings_for_display( 'pdf-file' );
		$godam_attachment_id = ! empty( $pdf_file['id'] ) ? intval( $pdf_file['id'] ) : null;
		$godam_src           = ! empty( $pdf_file['url'] ) ? esc_url( $pdf_file['url'] ) : '';
		$godam_caption       = $this->get_settings_for_display( 'caption' ) ?? '';
		$godam_height        = $this->get_settings_for_display( 'height' ) ?? 600;

		if ( ! $godam_attachment_id && empty( $godam_src ) ) {
			return;
		}

		$godam_sources = array();
		if ( $godam_attachment_id ) {
			$godam_pdf_url            = wp_get_attachment_url( $godam_attachment_id );
			$godam_pdf_transcoded_url = get_post_meta( $godam_attachment_id, 'rtgodam_transcoded_url', true );
			if ( ! empty( $godam_pdf_transcoded_url ) ) {
				$godam_sources[] = $godam_pdf_transcoded_url;
			}
			if ( ! empty( $godam_pdf_url ) ) {
				$godam_sources[] = $godam_pdf_url;
			}
		} else {
			$godam_sources[] = $godam_src;
		}

		if ( empty( $godam_sources ) ) {
			return;
		}

		$is_elementor_widget = true;

		require RTGODAM_PATH . 'inc/templates/godam-pdf.php';
	}
}
