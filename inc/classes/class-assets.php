<?php
/**
 * Assets class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Assets
 */
class Assets {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * To setup action/filter.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		/**
		 * Action
		 */
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_scripts' ) );
	}

	/**
	 * To enqueue scripts and styles.
	 *
	 * @return void
	 */
	public function enqueue_scripts() {

		wp_register_script(
			'rtgodam-script',
			RTGODAM_URL . '/assets/build/js/main.js',
			array(),
			filemtime( RTGODAM_PATH . '/assets/build/js/main.js' ),
			true
		);

		wp_register_style(
			'rtgodam-style',
			RTGODAM_URL . '/assets/build/css/main.css',
			array(),
			filemtime( RTGODAM_PATH . '/assets/build/css/main.css' )
		);


		wp_enqueue_script(
			'analytics-library',
			RTGODAM_URL . '/assets/src/libs/analytics.min.js',
			array(),
			filemtime( RTGODAM_PATH . '/assets/src/libs/analytics.min.js' ),
			true
		);

		wp_localize_script(
			'rtgodam-script',
			'nonceData',
			array(
				'nonce' => wp_create_nonce( 'wp_rest' ),
			)
		);
		
		$localize_array = rtgodam_get_localize_array();

		wp_localize_script(
			'rtgodam-script',
			'videoAnalyticsParams',
			$localize_array
		);
		
		wp_localize_script(
			'rtgodam-script',
			'godamAPIKeyData',
			array(
				'valid_api_key' => rtgodam_is_api_key_valid(),
			)
		);

		wp_localize_script(
			'rtgodam-script',
			'godamRestRoute',
			array(
				'url' => get_rest_url( get_current_blog_id() ),
			)
		);

		$this->enqueue_godam_settings();

		wp_enqueue_script( 'rtgodam-script' );
		wp_enqueue_style( 'rtgodam-style' );

		// Register IMA SDK.
		wp_enqueue_script(
			'ima-sdk',
			RTGODAM_URL . '/assets/src/libs/ima3.js',
			array(),
			RTGODAM_VERSION,
			true
		);

		wp_enqueue_script(
			'godam-frontend-js',
			RTGODAM_URL . 'assets/build/blocks/godam-player/frontend.js',
			array(), 
			'1.0', 
			true
		);

		wp_localize_script(
			'godam-frontend-js',
			'godamData',
			array(
				'api_base' => RTGODAM_API_BASE,
			)
		);
	}

	/**
	 * To enqueue scripts and styles. in admin.
	 *
	 * @return void
	 */
	public function admin_enqueue_scripts() {

		$screen = get_current_screen();

		wp_register_script(
			'rtgodam-script',
			RTGODAM_URL . '/assets/build/js/admin.js',
			array(),
			filemtime( RTGODAM_PATH . '/assets/build/js/admin.js' ),
			true
		);

		wp_localize_script(
			'rtgodam-script',
			'pluginInfo',
			array(
				'version'   => RTGODAM_VERSION,
				'adminUrl'  => admin_url(),
				'uploadUrl' => wp_upload_dir()['baseurl'],
			)
		);

		wp_localize_script(
			'rtgodam-script',
			'godamRestRoute',
			array(
				'url'      => get_rest_url( get_current_blog_id() ),
				'home_url' => get_home_url( get_current_blog_id() ),
				'nonce'    => wp_create_nonce( 'wp_rest' ),
			)
		);

		wp_register_style(
			'rtgodam-style',
			RTGODAM_URL . '/assets/build/css/admin.css',
			array(),
			filemtime( RTGODAM_PATH . '/assets/build/css/admin.css' )
		);

		$this->enqueue_godam_settings();

		wp_enqueue_script( 'rtgodam-script' );
		wp_enqueue_style( 'rtgodam-style' );

		wp_register_script(
			'easydam-media-library',
			RTGODAM_URL . '/assets/build/js/media-library.js',
			array(),
			filemtime( RTGODAM_PATH . '/assets/build/js/media-library.js' ),
			true
		);

		wp_register_style(
			'easydam-media-library',
			RTGODAM_URL . '/assets/build/css/media-library.css',
			array(),
			filemtime( RTGODAM_PATH . '/assets/build/css/media-library.css' )
		);

		wp_localize_script(
			'easydam-media-library',
			'MediaLibraryTaxonomyFilterData',
			array(
				'terms' => get_terms(
					array(
						'taxonomy'   => 'media-folder',
						'hide_empty' => false,
					)
				),
			)
		);

		wp_localize_script(
			'easydam-media-library',
			'transcoderSettings',
			array(
				'restUrl' => esc_url_raw( rest_url( 'godam/v1/transcoding/transcoding-status' ) ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
			)
		);

		$enable_folder_organization = get_option( 'rtgodam-settings', array() )['general']['enable_folder_organization'] ?? true;

		wp_localize_script(
			'easydam-media-library',
			'easydamMediaLibrary',
			array(
				'ajaxUrl'                  => admin_url( 'admin-ajax.php' ),
				'nonce'                    => wp_create_nonce( 'easydam_media_library' ),
				'godamToolsNonce'          => wp_create_nonce( 'rtgodam_tools' ),
				'enableFolderOrganization' => $enable_folder_organization,
				'isPollPluginActive'       => is_plugin_active( 'wp-polls/wp-polls.php' ),
			)
		);

		if ( $screen && 'upload' === $screen->id ) {
			wp_enqueue_style( 'easydam-media-library' );
		}

		wp_enqueue_script( 'easydam-media-library' );

		/**
		 * Dependency library for date range picker.
		 */
		wp_enqueue_script( 'moment-js', RTGODAM_URL . '/assets/src/libs/moment-js.min.js', array(), filemtime( RTGODAM_PATH . '/assets/src/libs/moment-js.min.js' ), true );
		wp_enqueue_script( 'daterangepicker-js', RTGODAM_URL . '/assets/src/libs/daterangepicker.min.js', array( 'moment-js' ), filemtime( RTGODAM_PATH . '/assets/src/libs/daterangepicker.min.js' ), true );
		wp_enqueue_style( 'daterangepicker-css', RTGODAM_URL . '/assets/src/libs/daterangepicker.css', array(), filemtime( RTGODAM_PATH . '/assets/src/libs/daterangepicker.css' ) );
	}

	/**
	 * Enqueue GoDAM Settings JS localization.
	 *
	 * @return void
	 */
	private function enqueue_godam_settings() {
		$godam_settings = get_option( 'rtgodam-settings' );

		$brand_image = $godam_settings['general']['brand_image'] ?? '';
		$brand_color = $godam_settings['general']['brand_color'] ?? '';

		wp_localize_script(
			'rtgodam-script',
			'godamSettings',
			array(
				'brandImage' => $brand_image,
				'brandColor' => $brand_color,
			)
		);
	}
}
