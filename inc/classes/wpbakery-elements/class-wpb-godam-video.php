<?php
/**
 * WPBakery GoDAM Video Element
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\WPBakery_Elements;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class WPB_GoDAM_Video
 *
 * @package GoDAM
 */
class WPB_GoDAM_Video {
	use Singleton;

	/**
	 * WPB_GoDAM_Video constructor.
	 *
	 * @since 1.6.0
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
	 * @since 1.6.0
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( 'vc_before_init', array( $this, 'godam_video' ) );
	}

	/**
	 * Map video element to WPBakery.
	 *
	 * @since 1.6.0
	 *
	 * @return void
	 */
	public function godam_video() {
		if ( ! function_exists( 'vc_map' ) ) {
			return;
		}

		vc_map(
			array(
				'name'        => esc_html__( 'GoDAM Video', 'godam' ),
				'base'        => 'godam_video',
				'category'    => esc_html__( 'GoDAM', 'godam' ),
				'description' => esc_html__( 'Embed video from GoDAM Media Library', 'godam' ),
				'icon'        => RTGODAM_URL . 'assets/images/godam-video-filled.svg',
				'params'      => array(
					// Video Selection.
					array(
						'type'        => 'video_selector',
						'heading'     => esc_html__( 'Select Video', 'godam' ),
						'param_name'  => 'id',
						'value'       => '',
						'description' => esc_html__( 'Select a video from the WordPress Media Library.', 'godam' ),
						'admin_label' => true,
						'save_always' => true,
					),
					
					// Video Playback Controls.
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
						'description' => esc_html__( 'Loop the video playback.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Muted', 'godam' ),
						'param_name'  => 'muted',
						'value'       => array(
							esc_html__( 'No', 'godam' )  => '0',
							esc_html__( 'Yes', 'godam' ) => '1',
						),
						'std'         => '0',
						'description' => esc_html__( 'Mute the video by default.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Playback Controls', 'godam' ),
						'param_name'  => 'controls',
						'value'       => array(
							esc_html__( 'Yes', 'godam' ) => '1',
							esc_html__( 'No', 'godam' )  => '0',
						),
						'std'         => '1',
						'description' => esc_html__( 'Show video playback controls.', 'godam' ),
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
							esc_html__( 'Metadata', 'godam' ) => 'metadata',
							esc_html__( 'None', 'godam' ) => 'none',
							esc_html__( 'Auto', 'godam' ) => 'auto',
						),
						'std'         => 'metadata',
						'description' => esc_html__( 'Select the preload behavior for the video.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),

					array(
						'type'        => 'image_src_selector',
						'heading'     => esc_html__( 'Video Thumbnail', 'godam' ),
						'param_name'  => 'poster',
						'value'       => '',
						'description' => esc_html__( 'Select a custom thumbnail image for the video.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Hover Option', 'godam' ),
						'param_name'  => 'hover_select',
						'value'       => array(
							esc_html__( 'None', 'godam' ) => 'none',
							esc_html__( 'Show Player Controls', 'godam' ) => 'show-player-controls',
							esc_html__( 'Start Preview', 'godam' ) => 'start-preview',
							esc_html__( 'Shadow Overlay', 'godam' ) => 'shadow-overlay',
						),
						'std'         => 'none',
						'description' => esc_html__( 'Choose the action to perform on video hover.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),
					
					// Engagement Settings.
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Enable Likes & Comments', 'godam' ),
						'param_name'  => 'engagements',
						'value'       => array(
							esc_html__( 'No', 'godam' )  => '0',
							esc_html__( 'Yes', 'godam' ) => '1',
						),
						'std'         => '0',
						'description' => esc_html__( 'Engagement will only be visible for transcoded videos', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),
					array(
						'type'        => 'dropdown',
						'heading'     => esc_html__( 'Share Button', 'godam' ),
						'param_name'  => 'show_share_button',
						'value'       => array(
							esc_html__( 'No', 'godam' )  => '0',
							esc_html__( 'Yes', 'godam' ) => '1',
						),
						'std'         => '0',
						'description' => esc_html__( 'Show share button in the video player.', 'godam' ),
						'save_always' => true,
						'dependency'  => array(
							'element'   => 'id',
							'not_empty' => true,
						),
					),
					
					// Caption Settings.
					array(
						'type'        => 'textfield',
						'heading'     => esc_html__( 'Video Caption', 'godam' ),
						'param_name'  => 'caption',
						'value'       => '',
						'description' => esc_html__( 'Add a caption for the video.', 'godam' ),
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
