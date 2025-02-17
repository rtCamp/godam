<?php
/**
 * Assets class.
 *
 * @package transcoder
 */

namespace Transcoder\Inc;

use Transcoder\Inc\Traits\Singleton;

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
			'easydam-script',
			RT_TRANSCODER_URL . '/assets/build/js/main.js',
			array(),
			filemtime( RT_TRANSCODER_PATH . '/assets/build/js/main.js' ),
			true
		);

		wp_register_style(
			'easydam-style',
			RT_TRANSCODER_URL . '/assets/build/css/main.css',
			array(),
			filemtime( RT_TRANSCODER_PATH . '/assets/build/css/main.css' )
		);


		wp_enqueue_script(
			'analytics-library',
			'https://unpkg.com/analytics/dist/analytics.min.js',
			array(),
			RT_TRANSCODER_VERSION,
			true
		);

		wp_localize_script(
			'easydam-script',
			'nonceData',
			array(
				'nonce' => wp_create_nonce( 'wp_rest' ),
			)
		);
		
		wp_enqueue_script( 'easydam-script' );
		wp_enqueue_style( 'easydam-style' );

		// Register IMA SDK.
		wp_enqueue_script( 'ima-sdk', 'https://imasdk.googleapis.com/js/sdkloader/ima3.js', RT_TRANSCODER_VERSION, true );
	}

	/**
	 * To enqueue scripts and styles. in admin.
	 *
	 * @return void
	 */
	public function admin_enqueue_scripts() {

		$screen = get_current_screen();

		wp_register_script(
			'easydam-script',
			RT_TRANSCODER_URL . '/assets/build/js/admin.js',
			array(),
			filemtime( RT_TRANSCODER_PATH . '/assets/build/js/admin.js' ),
			true
		);

		wp_register_script(
			'easydam-media-library',
			RT_TRANSCODER_URL . '/assets/build/js/media-library.js',
			array(),
			filemtime( RT_TRANSCODER_PATH . '/assets/build/js/media-library.js' ),
			true
		);

		wp_register_style(
			'easydam-media-library',
			RT_TRANSCODER_URL . '/assets/build/css/media-library.css',
			array(),
			filemtime( RT_TRANSCODER_PATH . '/assets/build/css/media-library.css' )
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
				'restUrl' => esc_url_raw( rest_url( 'easydam/v1/transcoding/transcoding-status' ) ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
			)
		);

		wp_register_style(
			'easydam-style',
			RT_TRANSCODER_URL . '/assets/build/css/admin.css',
			array(),
			filemtime( RT_TRANSCODER_PATH . '/assets/build/css/admin.css' )
		);

		wp_enqueue_script( 'easydam-script' );
		wp_enqueue_style( 'easydam-style' );

		if ( $screen && 'upload' === $screen->id ) {
			wp_enqueue_style( 'easydam-media-library' );
		}

		wp_enqueue_script( 'easydam-media-library' );

		/**
		 * Dependency library for date range picker.
		 */
		wp_enqueue_script( 'moment-js', 'https://cdn.jsdelivr.net/momentjs/latest/moment.min.js', array(), '1.0.0', true );
		wp_enqueue_script( 'daterangepicker-js', 'https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.min.js', array( 'moment-js' ), '1.0.0', true );
		wp_enqueue_style( 'daterangepicker-css', 'https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.css', array(), '1.0.0' );

		wp_localize_script(
			'easydam-media-library',
			'easydamMediaLibrary',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'easydam_media_library' ),
			)
		);

		wp_localize_script(
			'easydam-script',
			'pluginInfo',
			array(
				'version' => RT_TRANSCODER_VERSION,
			)
		);
	}
}
