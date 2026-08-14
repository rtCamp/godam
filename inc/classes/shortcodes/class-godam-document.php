<?php
/**
 * GoDAM Document Shortcode Class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Shortcodes;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class GoDAM_Document.
 *
 * This class handles the GoDAM document shortcode functionality. It powers the
 * WPBakery "Document" element by reusing the Document block's render template.
 */
class GoDAM_Document {
	use Singleton;

	/**
	 * Constructor.
	 */
	final protected function __construct() {
		add_shortcode( 'godam_document', array( $this, 'render' ) );
	}

	/**
	 * Render the GoDAM document shortcode.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output of the document embed.
	 */
	public function render( $atts ) {
		// NOTE: WordPress' shortcode_parse_atts() lowercases every attribute name,
		// so the WPBakery element uses lowercase/snake_case param names (doc_title,
		// preview_mode, show_cover, custom_cover). Defaults below match that casing;
		// they are then mapped to the block's camelCase attribute shape.
		$atts = shortcode_atts(
			array(
				'id'           => '',
				'src'          => '',
				'caption'      => '',
				'doc_title'    => '',
				'description'  => '',
				'preview_mode' => 'default',
				'height'       => 600,
				'show_cover'   => '0',
				'custom_cover' => '',
				'page_count'   => 0,
				'css'          => '',
			),
			$atts,
			'godam_document'
		);

		// A document requires either an attachment ID or a source URL.
		if ( empty( $atts['id'] ) && empty( $atts['src'] ) ) {
			return '';
		}

		// render.php emits nothing for an unsupported format. In WPBakery's front-end
		// editor that would leave a silently empty element, so show the author why.
		// Callers that own their own editor messaging (the Elementor widget) check
		// before reaching this point.
		if ( ! godam_is_supported_document( $atts['id'], $atts['src'] ) ) {
			if ( function_exists( 'vc_is_inline' ) && vc_is_inline() ) {
				// The notice is styled by the block's stylesheet, which is normally
				// enqueued further down, so enqueue it here too since we return early.
				wp_enqueue_style( 'godam-pdf-style' );

				return '<div class="godam-document-unsupported" data-test-id="godam-document-unsupported"><p>'
					. esc_html__( 'That file type is not supported. This file will not be shown on your page.', 'godam' )
					. '</p></div>';
			}

			return '';
		}

		// Map the flat shortcode atts to the block attribute shape expected by
		// the shared render.php (booleans / ints normalized).
		$attributes = array(
			'id'          => $atts['id'],
			'src'         => $atts['src'],
			'caption'     => $atts['caption'],
			'docTitle'    => $atts['doc_title'],
			'description' => $atts['description'],
			'previewMode' => $atts['preview_mode'],
			'height'      => intval( $atts['height'] ),
			'showCover'   => filter_var( $atts['show_cover'], FILTER_VALIDATE_BOOLEAN ),
			'customCover' => $atts['custom_cover'],
			'pageCount'   => intval( $atts['page_count'] ),
		);

		// Get WPBakery Design Options CSS class if available.
		$godam_css_class = '';
		if ( ! empty( $atts['css'] ) && function_exists( 'vc_shortcode_custom_css_class' ) ) {
			$godam_css_class = vc_shortcode_custom_css_class( $atts['css'], ' ' );
		}

		// Enqueue the block's front-end script + styles so the shortcode gets the
		// same behaviour and styling as the block. These handles are registered by
		// register_block_type() (see class-blocks.php); WordPress auto-enqueues them
		// for the block, but not when the shared render.php is included directly.
		wp_enqueue_script( 'godam-pdf-view-script' );
		wp_enqueue_style( 'godam-pdf-style' );

		// Tells the shared render.php it runs outside block context, so it skips
		// get_block_wrapper_attributes() (which warns without a block).
		$godam_is_shortcode = true;

		ob_start();
		require RTGODAM_PATH . 'assets/build/blocks/godam-pdf/render.php';
		return ob_get_clean();
	}
}
