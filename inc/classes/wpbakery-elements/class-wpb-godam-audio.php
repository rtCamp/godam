<?php
/**
 * WPBakery GoDAM Audio Element
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\WPBakery_Elements;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class WPB_GoDAM_Audio
 *
 * @package GoDAM
 */
class WPB_GoDAM_Audio {
	use Singleton;

	/**
	 * WPB_GoDAM_Audio constructor.
	 */
	protected function __construct() {
		$is_wpbakery_active = is_plugin_active( 'js_composer/js_composer.php' );

		if ( $is_wpbakery_active ) {
			$this->setup_hooks();
		}
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( 'vc_before_init', array( $this, 'godam_audio' ) );
	}

	/**
	 * Map audio element to WPBakery.
	 *
	 * @return void
	 */
	public function godam_audio() {
		if ( ! function_exists( 'vc_map' ) ) {
			return;
		}

		vc_map(
			array(
				'name'        => esc_html__( 'GoDAM Audio', 'godam' ),
				'base'        => 'godam_audio',
				'category'    => esc_html__( 'GoDAM', 'godam' ),
				'description' => esc_html__( 'Embed audio from GoDAM Media Library', 'godam' ),
				'icon'        => 'icon-wpb-music',
				'params'      => array(
					// Audio Selection.
					array(
						'type'        => 'textfield',
						'heading'     => esc_html__( 'Audio ID', 'godam' ),
						'param_name'  => 'id',
						'value'       => '',
						'description' => esc_html__( 'Enter the audio attachment ID from WordPress Media Library.', 'godam' ),
						'admin_label' => true,
						'save_always' => true,
					),
					
					// Audio Playback Controls.
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Autoplay', 'godam' ),
						'param_name'  => 'autoplay',
						'value'       => array(
							esc_html__( 'No', 'godam' )  => '0',
							esc_html__( 'Yes', 'godam' ) => '1',
						),
						'std'         => '0',
						'description' => esc_html__( 'Autoplay may cause usability issues for some users.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Loop', 'godam' ),
						'param_name'  => 'loop',
						'value'       => array(
							esc_html__( 'No', 'godam' )  => '0',
							esc_html__( 'Yes', 'godam' ) => '1',
						),
						'std'         => '0',
						'description' => esc_html__( 'Loop the audio playback continuously.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Preload', 'godam' ),
						'param_name'  => 'preload',
						'value'       => array(
							esc_html__( 'Browser default', 'godam' ) => '',
							esc_html__( 'Metadata', 'godam' ) => 'metadata',
							esc_html__( 'None', 'godam' ) => 'none',
							esc_html__( 'Auto', 'godam' ) => 'auto',
						),
						'std'         => '',
						'description' => esc_html__( 'Select the preload behavior for the audio.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),
					
					// Caption Settings.
					array(
						'type'        => 'textfield',
						'heading'     => esc_html__( 'Audio Caption', 'godam' ),
						'param_name'  => 'caption',
						'value'       => '',
						'description' => esc_html__( 'Add a caption for the audio player.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),
				),
			)
		);
	}
}
