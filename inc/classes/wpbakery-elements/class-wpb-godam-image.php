<?php
/**
 * WPBakery GoDAM Image Element
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\WPBakery_Elements;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class WPB_GoDAM_Image
 *
 * @since 2.0.0
 *
 * @package GoDAM
 */
class WPB_GoDAM_Image {
	use Singleton;

	/**
	 * WPB_GoDAM_Image constructor.
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
		add_action( 'vc_before_init', array( $this, 'godam_image' ) );
	}

	/**
	 * Map image element to WPBakery.
	 *
	 * @since 2.0.0
	 *
	 * @return void
	 */
	public function godam_image() {
		if ( ! function_exists( 'vc_map' ) ) {
			return;
		}

		vc_map(
			array(
				'name'        => esc_html__( 'GoDAM Image', 'godam' ),
				'base'        => 'godam_image',
				'category'    => esc_html__( 'GoDAM', 'godam' ),
				'description' => esc_html__( 'Image with interactive GoDAM hotspot & product layers', 'godam' ),
				'icon'        => RTGODAM_URL . 'assets/src/images/godam-image-filled.svg',
				'params'      => array(
					// Image Selection (stores the attachment ID).
					array(
						'type'        => 'image_selector',
						'heading'     => esc_html__( 'Select Image', 'godam' ),
						'param_name'  => 'id',
						'value'       => '',
						'description' => esc_html__( 'Select an image from the WordPress Media Library.', 'godam' ),
						'admin_label' => true,
						'save_always' => true,
					),

					// Source URL (auto-filled by the image selector).
					array(
						'type'        => 'textfield_hidden',
						'heading'     => esc_html__( 'Source URL', 'godam' ),
						'param_name'  => 'url',
						'value'       => '',
						'admin_label' => true,
						'description' => esc_html__( 'The source URL for the image.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),

					// Alt text (auto-filled by the image selector).
					array(
						'type'        => 'textfield_hidden',
						'heading'     => esc_html__( 'Alt Text', 'godam' ),
						'param_name'  => 'alt',
						'value'       => '',
						'description' => esc_html__( 'Alternative text for the image.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),

					// Show Image Layers toggle.
					array(
						'type'        => 'checkbox',
						'heading'     => esc_html__( 'Show Image Layers', 'godam' ),
						'param_name'  => 'show_image_layers',
						'value'       => array( esc_html__( 'Yes', 'godam' ) => 'true' ),
						'std'         => 'true',
						'description' => esc_html__( 'Display the authored hotspot & product layers over the image.', 'godam' ),
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
