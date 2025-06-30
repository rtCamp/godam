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
			RTGODAM_URL . 'assets/build/js/main.min.js',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/js/main.min.js' ),
			true
		);

		wp_register_style(
			'rtgodam-style',
			RTGODAM_URL . 'assets/build/css/main.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/main.css' )
		);

		wp_enqueue_script(
			'analytics-library',
			RTGODAM_URL . 'assets/src/libs/analytics.min.js',
			array(),
			filemtime( RTGODAM_PATH . 'assets/src/libs/analytics.min.js' ),
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

		include_once ABSPATH . 'wp-admin/includes/plugin.php';
		$is_gf_active       = is_plugin_active( 'gravityforms/gravityforms.php' );
		$is_wp_polls_active = is_plugin_active( 'wp-polls/wp-polls.php' );
		$is_woo_active      = is_plugin_active( 'woocommerce/woocommerce.php' );

		$is_cf7_active             = is_plugin_active( 'contact-form-7/wp-contact-form-7.php' );
		$is_wpforms_active         = is_plugin_active( 'wpforms-lite/wpforms.php' );
		$is_jetpack_active         = is_plugin_active( 'jetpack/jetpack.php' );
		$is_sure_form_active       = is_plugin_active( 'sureforms/sureforms.php' );
		$is_forminator_form_active = is_plugin_active( 'forminator/forminator.php' );
		$is_fluent_forms_active    = is_plugin_active( 'fluentform/fluentform.php' );
		
		wp_localize_script(
			'rtgodam-script',
			'godamPluginDependencies',
			array(
				'gravityforms' => $is_gf_active,
				'wp_polls'     => $is_wp_polls_active,
				'woocommerce'  => $is_woo_active,
				'cf7'          => $is_cf7_active,
				'wpforms'      => $is_wpforms_active,
				'jetpack'      => $is_jetpack_active,
				'sureforms'    => $is_sure_form_active,
				'forminator'   => $is_forminator_form_active,
				'fluentForms'  => $is_fluent_forms_active,
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

		wp_set_script_translations( 'rtgodam-script', 'godam', RTGODAM_PATH . 'languages' );
		wp_enqueue_script( 'rtgodam-script' );
		wp_enqueue_style( 'rtgodam-style' );

		// Add Jetpack form script.
		wp_register_script(
			'rtgodam-jetpack-form',
			RTGODAM_URL . 'assets/build/js/jetpack-form.min.js',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/js/jetpack-form.min.js' ),
			true
		);

		wp_localize_script(
			'rtgodam-jetpack-form',
			'godamJetpackFormData',
			array(
				'submittingText'      => __( 'Submitting...', 'godam' ),
				'successHeading'      => __( 'Success!', 'godam' ),
				'successMessage'      => __( 'Your message has been sent successfully.', 'godam' ),
				'errorMessage'        => __( 'An error occurred. Please try again.', 'godam' ),
				'networkErrorMessage' => __( 'Network error. Please try again.', 'godam' ),
			)
		);

		wp_localize_script(
			'rtgodam-jetpack-form',
			'wpAjax',
			array(
				'ajaxurl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'jetpack_form_nonce' ),
			) 
		);

		wp_enqueue_script( 'rtgodam-jetpack-form' );

		// Register IMA SDK.
		wp_enqueue_script(
			'ima-sdk',
			'https://imasdk.googleapis.com/js/sdkloader/ima3.js', // It is required to load the IMA SDK from the Google CDN, else it will show console error.
			array(),
			RTGODAM_VERSION,
			true
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
			RTGODAM_URL . 'assets/build/js/admin.min.js',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/js/admin.min.js' ),
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
				'api_base' => RTGODAM_API_BASE,
			)
		);

		wp_register_style(
			'rtgodam-style',
			RTGODAM_URL . 'assets/build/css/admin.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/admin.css' )
		);

		$this->enqueue_godam_settings();

		wp_enqueue_script( 'rtgodam-script' );
		wp_enqueue_style( 'rtgodam-style' );

		wp_register_script(
			'easydam-media-library',
			RTGODAM_URL . 'assets/build/js/media-library.min.js',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/js/media-library.min.js' ),
			true
		);

		wp_register_style(
			'easydam-media-library',
			RTGODAM_URL . 'assets/build/css/media-library.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/media-library.css' )
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
				'isWooActive'              => is_plugin_active( 'woocommerce/woocommerce.php' ),
				'page'                     => $screen ? $screen->id : '',
			)
		);

		if ( $screen && 'upload' === $screen->id ) {
			wp_enqueue_style( 'easydam-media-library' );
		}

		wp_set_script_translations( 'easydam-media-library', 'godam', RTGODAM_PATH . 'languages' );
		wp_enqueue_script( 'easydam-media-library' );

		/**
		 * Dependency library for date range picker.
		 */
		wp_enqueue_script( 'moment-js', RTGODAM_URL . 'assets/src/libs/moment-js.min.js', array(), filemtime( RTGODAM_PATH . 'assets/src/libs/moment-js.min.js' ), true );
		wp_enqueue_script( 'daterangepicker-js', RTGODAM_URL . 'assets/src/libs/daterangepicker.min.js', array( 'moment-js' ), filemtime( RTGODAM_PATH . 'assets/src/libs/daterangepicker.min.js' ), true );
		wp_enqueue_style( 'daterangepicker-css', RTGODAM_URL . 'assets/src/libs/daterangepicker.css', array(), filemtime( RTGODAM_PATH . 'assets/src/libs/daterangepicker.css' ) );
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
