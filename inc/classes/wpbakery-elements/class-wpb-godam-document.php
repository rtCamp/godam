<?php
/**
 * WPBakery GoDAM Document Element
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\WPBakery_Elements;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class WPB_GoDAM_Document
 *
 * @since 2.0.0
 *
 * @package GoDAM
 */
class WPB_GoDAM_Document {
	use Singleton;

	/**
	 * WPB_GoDAM_Document constructor.
	 *
	 * @since 2.0.0
	 */
	protected function __construct() {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$is_wpbakery_active = is_plugin_active( 'js_composer/js_composer.php' );

		if ( $is_wpbakery_active ) {
			$this->setup_hooks();
		}
	}

	/**
	 * Setup hooks.
	 *
	 * @since 2.0.0
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( 'vc_before_init', array( $this, 'godam_document' ) );
	}

	/**
	 * Map document element to WPBakery.
	 *
	 * @since 2.0.0
	 *
	 * @return void
	 */
	public function godam_document() {
		if ( ! function_exists( 'vc_map' ) ) {
			return;
		}

		vc_map(
			array(
				'name'        => esc_html__( 'Document', 'godam' ),
				'base'        => 'godam_document',
				'category'    => esc_html__( 'GoDAM', 'godam' ),
				'description' => esc_html__( 'Embed a PDF document from GoDAM Media Library', 'godam' ),
				'icon'        => RTGODAM_URL . 'assets/images/godam-pdf.svg',
				'params'      => array(
					// Document Selection.
					array(
						'type'        => 'document_selector',
						'heading'     => esc_html__( 'Select Document', 'godam' ),
						'param_name'  => 'id',
						'value'       => '',
						'description' => esc_html__( 'Select a PDF document from the WordPress Media Library.', 'godam' ),
						'admin_label' => true,
						'save_always' => true,
					),

					// Source URL (auto-filled by the document selector).
					array(
						'type'        => 'textfield_hidden',
						'heading'     => esc_html__( 'Source URL', 'godam' ),
						'param_name'  => 'src',
						'value'       => '',
						'admin_label' => true,
						'description' => esc_html__( 'The source URL for the document file.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),

					// Document Title.
					array(
						'type'        => 'textfield',
						'heading'     => esc_html__( 'Doc Title', 'godam' ),
						'param_name'  => 'doc_title',
						'value'       => '',
						'description' => esc_html__( 'Add a title for the document. Leave empty to use the attachment title.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),

					// Description.
					array(
						'type'        => 'textarea',
						'heading'     => esc_html__( 'Description', 'godam' ),
						'param_name'  => 'description',
						'value'       => '',
						'description' => esc_html__( 'Add a document description (shown in card view).', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),

					// Preview Mode.
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'View', 'godam' ),
						'param_name'  => 'preview_mode',
						'value'       => array(
							esc_html__( 'Default View', 'godam' ) => 'default',
							esc_html__( 'Card View', 'godam' )    => 'card',
						),
						'std'         => 'default',
						'description' => esc_html__( 'Choose how the document is displayed: an embedded PDF viewer or a card with a cover image.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),

					// Height (Default View only).
					array(
						'type'        => 'textfield',
						'heading'     => esc_html__( 'Height (px)', 'godam' ),
						'param_name'  => 'height',
						'value'       => '600',
						'description' => esc_html__( 'Height of the embedded PDF viewer in pixels.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element' => 'preview_mode',
							'value'   => 'default',
						),
					),

					// Show Cover (Card View only).
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Show Cover', 'godam' ),
						'param_name'  => 'show_cover',
						'value'       => array(
							esc_html__( 'No', 'godam' )  => '0',
							esc_html__( 'Yes', 'godam' ) => '1',
						),
						'std'         => '0',
						'description' => esc_html__( 'Show a cover image on the document card.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element' => 'preview_mode',
							'value'   => 'card',
						),
					),

					// Custom Cover (Card View + Show Cover only).
					// Uses a dedicated selector that also previews the attachment's
					// auto-generated cover (mirroring the block's first cover tile).
					array(
						'type'        => 'document_cover_selector',
						'heading'     => esc_html__( 'Cover Image', 'godam' ),
						'param_name'  => 'custom_cover',
						'value'       => '',
						'description' => esc_html__( 'Leave on the auto-generated cover, or select a custom image. Recommended aspect ratio: 16:9.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element' => 'show_cover',
							'value'   => '1',
						),
					),

					// Caption.
					array(
						'type'        => 'textfield',
						'heading'     => esc_html__( 'Caption', 'godam' ),
						'param_name'  => 'caption',
						'value'       => '',
						'description' => esc_html__( 'Add a caption for the document.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),

					// WPBakery Design Options tab.
					array(
						'type'       => 'css_editor',
						'heading'    => esc_html__( 'Design Options', 'godam' ),
						'param_name' => 'css',
						'group'      => esc_html__( 'Design Options', 'godam' ),
					),
				),
			)
		);
	}
}
